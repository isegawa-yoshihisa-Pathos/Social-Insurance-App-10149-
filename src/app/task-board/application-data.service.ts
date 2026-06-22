import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { ApplicationDocument } from './application-document';
import {
  EmployeeDocument,
  EmployeeLeaveRecord,
  EmployeeLeaveFormData,
  EmployeeResignFormData,
} from '../employee-document';
import { CurrentTenantService } from '../current-tenant.service';
import { AuthService } from '../auth.service';
import { leaveFormToRecord } from '../employee-leave.util';
import { toFirestoreTimestamp, toFormDate } from '../date-utils';
import { licenseEndAtFromResignAt } from '../../../shared/social-insurance/premium/insurance-period';
import { FunctionsService } from '../functions.service';
import {
  AllowanceApplicationFormData,
  validateAllowanceApplicationForm,
} from './allowance-application.util';
import { buildPersonalInfoApplicationDetails } from './personal-info-application.util';
import { employeeFormToSavePayload, type EmployeeFormData, type PersonalFormData } from '../personal-form-data';
import { AllowanceTypeDefinition } from '../payment-document';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  canManageDependents,
  createDefaultMultiWorkplaceSettings,
  normalizeMultiWorkplaceSettings,
} from '../../../shared/social-insurance/multi-workplace/multi-workplace-settings';

export type PendingApplication = { id: string } & ApplicationDocument;
export type ApplicationListItem = PendingApplication;

@Injectable({ providedIn: 'root' })
export class ApplicationDataService {
  private readonly firestore = inject(Firestore);
  private readonly tenant = inject(CurrentTenantService);
  private readonly authService = inject(AuthService);
  private readonly functionsService = inject(FunctionsService);
  private readonly auditLog = inject(AuditLogService);

  private applicationsRef(tid: string) {
    return collection(this.firestore, 'tenants', tid, 'applications');
  }

  async submitLeaveApplication(form: EmployeeLeaveFormData): Promise<void> {
    const tid = this.tenant.currentTid();
    const uid = this.authService.uid();
    if (!tid || !uid) throw new Error('申請に必要な情報が不足しています。');

    if (!form.startAt) throw new Error('休業開始日を入力してください。');

    const employee = await this.loadCurrentEmployee(tid, uid);
    if (!employee) throw new Error('従業員情報が見つかりません。');

    await addDoc(this.applicationsRef(tid), {
      eid: employee.eid,
      employeeId: employee.employeeId,
      displayName: employee.displayName,
      type: 'leave',
      status: 'pending',
      leaveDetails: {
        type: form.type,
        startAt: toFirestoreTimestamp(form.startAt),
        endAt: toFirestoreTimestamp(form.endAt),
        reason: form.reason.trim(),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordCreate({
      tid,
      category: 'application.leave',
      summary: '休暇申請を提出',
      target: this.auditLog.employeeTarget(
        employee.eid,
        employee.displayName,
        employee.employeeId,
      ),
      metadata: {
        leaveType: form.type,
        reason: form.reason.trim(),
      },
    });
  }

  async submitAllowanceApplication(
    form: AllowanceApplicationFormData,
    allowanceDefinitions: AllowanceTypeDefinition[],
  ): Promise<void> {
    const validationError = validateAllowanceApplicationForm(form);
    if (validationError) {
      throw new Error(validationError);
    }

    const tid = this.tenant.currentTid();
    const uid = this.authService.uid();
    if (!tid || !uid) throw new Error('申請に必要な情報が不足しています。');

    const definition = allowanceDefinitions.find((item) => item.type === form.allowanceType);
    if (!definition) {
      throw new Error('選択した手当の種類が見つかりません。');
    }

    const employee = await this.loadCurrentEmployee(tid, uid);
    if (!employee) throw new Error('従業員情報が見つかりません。');

    await addDoc(this.applicationsRef(tid), {
      eid: employee.eid,
      employeeId: employee.employeeId,
      displayName: employee.displayName,
      type: 'allowance',
      status: 'pending',
      allowanceDetails: {
        allowanceType: definition.type,
        allowanceTypeLabel: definition.label,
        applyYyyyMm: form.applyYyyyMm,
        amount: form.amount as number,
        reason: form.reason.trim(),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordCreate({
      tid,
      category: 'application.allowance',
      summary: '諸手当申請を提出',
      target: this.auditLog.employeeTarget(
        employee.eid,
        employee.displayName,
        employee.employeeId,
        form.applyYyyyMm,
      ),
      metadata: {
        allowanceType: definition.type,
        allowanceTypeLabel: definition.label,
        applyYyyyMm: form.applyYyyyMm,
        amount: form.amount,
        reason: form.reason.trim(),
      },
    });
  }

  async listLeaveApplications(tid: string): Promise<PendingApplication[]> {
    return this.listApplicationsByType(tid, 'leave');
  }

  async listResignApplications(tid: string): Promise<PendingApplication[]> {
    return this.listApplicationsByType(tid, 'resign');
  }

  async listAllowanceApplications(tid: string): Promise<PendingApplication[]> {
    return this.listApplicationsByType(tid, 'allowance');
  }

  async listPersonalInfoApplications(tid: string): Promise<PendingApplication[]> {
    return this.listApplicationsByType(tid, 'personal_info');
  }

  async listDependentsApplications(tid: string): Promise<PendingApplication[]> {
    return this.listApplicationsByType(tid, 'dependents');
  }

  async submitPersonalInfoApplication(
    personal: PersonalFormData,
    employee: EmployeeFormData,
    multipleAffiliations: boolean,
  ): Promise<void> {
    const tid = this.tenant.currentTid();
    const uid = this.authService.uid();
    if (!tid || !uid) throw new Error('申請に必要な情報が不足しています。');

    const employeeMeta = await this.loadCurrentEmployee(tid, uid);
    if (!employeeMeta) throw new Error('従業員情報が見つかりません。');

    await this.assertNoPendingApplication(tid, employeeMeta.eid, 'personal_info');

    const details = buildPersonalInfoApplicationDetails(
      personal,
      employee,
      multipleAffiliations,
    );

    await addDoc(this.applicationsRef(tid), {
      eid: employeeMeta.eid,
      employeeId: employeeMeta.employeeId,
      displayName: employeeMeta.displayName,
      type: 'personal_info',
      status: 'pending',
      personalInfoDetails: details,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordCreate({
      tid,
      category: 'application.personal_info',
      summary: '基本情報変更申請を提出',
      target: this.auditLog.employeeTarget(
        employeeMeta.eid,
        employeeMeta.displayName,
        employeeMeta.employeeId,
      ),
    });
  }

  async submitDependentsApplication(employee: EmployeeFormData): Promise<void> {
    const tid = this.tenant.currentTid();
    const uid = this.authService.uid();
    if (!tid || !uid) throw new Error('申請に必要な情報が不足しています。');

    const employeeMeta = await this.loadCurrentEmployee(tid, uid);
    if (!employeeMeta) throw new Error('従業員情報が見つかりません。');

    const employeeSnap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'employees', employeeMeta.eid),
    );
    const employeeDoc = employeeSnap.data() as Partial<EmployeeDocument> | undefined;
    const multiWorkplace = normalizeMultiWorkplaceSettings({
      ...createDefaultMultiWorkplaceSettings(),
      ...employeeDoc?.multiWorkplaceSettings,
    });
    if (!canManageDependents(multiWorkplace)) {
      throw new Error('選択事業所以外では扶養家族の変更申請はできません。');
    }

    await this.assertNoPendingApplication(tid, employeeMeta.eid, 'dependents');

    const personalPayload = employeeFormToSavePayload(employee);

    await addDoc(this.applicationsRef(tid), {
      eid: employeeMeta.eid,
      employeeId: employeeMeta.employeeId,
      displayName: employeeMeta.displayName,
      type: 'dependents',
      status: 'pending',
      dependentsDetails: {
        hasDependents: personalPayload.hasDependents,
        dependentsInfo: personalPayload.dependentsInfo,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordCreate({
      tid,
      category: 'application.dependents',
      summary: '扶養家族変更申請を提出',
      target: this.auditLog.employeeTarget(
        employeeMeta.eid,
        employeeMeta.displayName,
        employeeMeta.employeeId,
      ),
      metadata: {
        hasDependents: personalPayload.hasDependents,
        dependentsCount: personalPayload.dependentsInfo?.length ?? 0,
      },
    });
  }

  async approvePersonalInfoApplication(tid: string, applicationId: string): Promise<void> {
    const applicationRef = doc(this.applicationsRef(tid), applicationId);
    const applicationSnap = await getDoc(applicationRef);
    if (!applicationSnap.exists()) throw new Error('申請が見つかりません。');

    const application = applicationSnap.data() as ApplicationDocument;
    if (application.type !== 'personal_info' || application.status !== 'pending') {
      throw new Error('承認できない申請です。');
    }
    if (!application.personalInfoDetails) {
      throw new Error('基本情報申請の内容がありません。');
    }

    const employeeRef = doc(
      this.firestore,
      'tenants',
      tid,
      'employees',
      application.eid,
    );
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists()) throw new Error('従業員が見つかりません。');

    const employee = employeeSnap.data() as EmployeeDocument;
    const uid = employee.uid;
    if (!uid) throw new Error('従業員のアカウント情報が見つかりません。');

    const details = application.personalInfoDetails;
    const batch = writeBatch(this.firestore);
    const accountRef = doc(this.firestore, 'accounts', uid);

    batch.update(accountRef, {
      personalInfo: details.accountPersonalInfo,
      updatedAt: serverTimestamp(),
    });

    batch.update(employeeRef, {
      employeePersonalInfo: details.employeePersonalInfo,
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(this.firestore, 'affiliations', `${uid}_${tid}`), {
      displayName: details.affiliationDisplayName,
      updatedAt: serverTimestamp(),
    });

    const sharedUpdate = {
      'employeePersonalInfo.realName': details.employeePersonalInfo.realName,
      'employeePersonalInfo.myNumber': details.employeePersonalInfo.myNumber,
      'employeePersonalInfo.basicPensionNumber': details.employeePersonalInfo.basicPensionNumber,
      'employeePersonalInfo.birthDate': details.employeePersonalInfo.birthDate,
      updatedAt: serverTimestamp(),
    };

    const accountSnap = await getDoc(accountRef);
    const affiliations = accountSnap.data()?.['affiliations'] as Record<string, string> | undefined;
    if (affiliations) {
      for (const [affTid, affEid] of Object.entries(affiliations)) {
        if (affTid === tid && affEid === application.eid) {
          continue;
        }
        batch.update(doc(this.firestore, 'tenants', affTid, 'employees', affEid), sharedUpdate);
      }
    }

    batch.update(applicationRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await this.auditLog.record({
      tid,
      action: 'update',
      category: 'application.personal_info',
      summary: '基本情報変更申請を承認',
      target: this.auditLog.employeeTarget(
        application.eid,
        application.displayName,
        application.employeeId,
        applicationId,
      ),
      metadata: { applicationId, status: 'approved' },
    });
  }

  async approveDependentsApplication(tid: string, applicationId: string): Promise<void> {
    const applicationRef = doc(this.applicationsRef(tid), applicationId);
    const applicationSnap = await getDoc(applicationRef);
    if (!applicationSnap.exists()) throw new Error('申請が見つかりません。');

    const application = applicationSnap.data() as ApplicationDocument;
    if (application.type !== 'dependents' || application.status !== 'pending') {
      throw new Error('承認できない申請です。');
    }
    if (!application.dependentsDetails) {
      throw new Error('扶養家族申請の内容がありません。');
    }

    const employeeRef = doc(
      this.firestore,
      'tenants',
      tid,
      'employees',
      application.eid,
    );
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists()) throw new Error('従業員が見つかりません。');

    const beforePersonal = employeeSnap.data()?.['employeePersonalInfo'] as
      | Record<string, unknown>
      | undefined;

    await updateDoc(employeeRef, {
      'employeePersonalInfo.hasDependents': application.dependentsDetails.hasDependents,
      'employeePersonalInfo.dependentsInfo': application.dependentsDetails.dependentsInfo,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(applicationRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordUpdate({
      tid,
      category: 'application.dependents',
      summary: '扶養家族変更申請を承認',
      target: this.auditLog.employeeTarget(
        application.eid,
        application.displayName,
        application.employeeId,
        applicationId,
      ),
      before: beforePersonal
        ? {
            hasDependents: beforePersonal['hasDependents'],
            dependentsInfo: beforePersonal['dependentsInfo'],
          }
        : undefined,
      after: {
        hasDependents: application.dependentsDetails.hasDependents,
        dependentsInfo: application.dependentsDetails.dependentsInfo,
      },
      metadata: { applicationId, status: 'approved' },
    });
  }

  async listApplications(tid: string, eid: string): Promise<ApplicationListItem[]> {
    const snap = await getDocs(
      query(
        this.applicationsRef(tid),
        where('eid', '==', eid),
      ),
    );
    return snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as ApplicationDocument),
      }))
      .sort((a, b) => {
        const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
  }

  private async listApplicationsByType(
    tid: string,
    type: ApplicationDocument['type'],
  ): Promise<PendingApplication[]> {
    const snap = await getDocs(
      query(
        this.applicationsRef(tid),
        where('type', '==', type),
      ),
    );
    return snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as ApplicationDocument),
      }))
      .sort((a, b) => {
        const pendingOrder =
          (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1);
        if (pendingOrder !== 0) return pendingOrder;
        const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
  }

  async submitResignApplication(form: EmployeeResignFormData): Promise<void> {
    const tid = this.tenant.currentTid();
    const uid = this.authService.uid();
    if (!tid || !uid) throw new Error('申請に必要な情報が不足しています。');

    if (!form.resignAt) throw new Error('退職日を入力してください。');

    const employee = await this.loadCurrentEmployee(tid, uid);
    if (!employee) throw new Error('従業員情報が見つかりません。');

    await addDoc(this.applicationsRef(tid), {
      eid: employee.eid,
      employeeId: employee.employeeId,
      displayName: employee.displayName,
      type: 'resign',
      status: 'pending',
      resignDetails: {
        resignAt: toFirestoreTimestamp(form.resignAt),
        reason: form.reason.trim(),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordCreate({
      tid,
      category: 'application.resign',
      summary: '退職申請を提出',
      target: this.auditLog.employeeTarget(
        employee.eid,
        employee.displayName,
        employee.employeeId,
      ),
      metadata: {
        reason: form.reason.trim(),
      },
    });
  }

  /** 形式的な承認のみ。給与・手当データには反映しない。 */
  async approveAllowanceApplication(tid: string, applicationId: string): Promise<void> {
    const applicationRef = doc(this.applicationsRef(tid), applicationId);
    const applicationSnap = await getDoc(applicationRef);
    if (!applicationSnap.exists()) throw new Error('申請が見つかりません。');

    const application = applicationSnap.data() as ApplicationDocument;
    if (application.type !== 'allowance' || application.status !== 'pending') {
      throw new Error('承認できない申請です。');
    }

    await updateDoc(applicationRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.record({
      tid,
      action: 'update',
      category: 'application.allowance',
      summary: '諸手当申請を承認',
      target: this.auditLog.employeeTarget(
        application.eid,
        application.displayName,
        application.employeeId,
        application.allowanceDetails?.applyYyyyMm,
      ),
      metadata: {
        applicationId,
        status: 'approved',
        allowanceTypeLabel: application.allowanceDetails?.allowanceTypeLabel,
        amount: application.allowanceDetails?.amount,
      },
    });
  }

  async approveLeaveApplication(tid: string, applicationId: string): Promise<void> {
    const applicationRef = doc(this.applicationsRef(tid), applicationId);
    const applicationSnap = await getDoc(applicationRef);
    if (!applicationSnap.exists()) throw new Error('申請が見つかりません。');

    const application = applicationSnap.data() as ApplicationDocument;
    if (application.type !== 'leave' || application.status !== 'pending') {
      throw new Error('承認できない申請です。');
    }
    if (!application.leaveDetails) throw new Error('休暇申請の内容がありません。');

    const employeeRef = doc(
      this.firestore,
      'tenants',
      tid,
      'employees',
      application.eid,
    );
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists()) throw new Error('従業員が見つかりません。');

    const employee = employeeSnap.data() as EmployeeDocument;
    const leaveRecord: EmployeeLeaveRecord = leaveFormToRecord(
      {
        type: application.leaveDetails.type,
        startAt: toFormDate(application.leaveDetails.startAt),
        endAt: toFormDate(application.leaveDetails.endAt),
        reason: application.leaveDetails.reason ?? '',
      },
      applicationId,
    );

    const leaveInfo = [...(employee.leaveInfo ?? []), leaveRecord];

    await updateDoc(employeeRef, {
      leaveInfo,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(applicationRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.record({
      tid,
      action: 'update',
      category: 'application.leave',
      summary: '休暇申請を承認',
      target: this.auditLog.employeeTarget(
        application.eid,
        application.displayName,
        application.employeeId,
        applicationId,
      ),
      metadata: { applicationId, status: 'approved' },
    });
  }

  async approveResignApplication(tid: string, applicationId: string): Promise<void> {
    const applicationRef = doc(this.applicationsRef(tid), applicationId);
    const applicationSnap = await getDoc(applicationRef);
    if (!applicationSnap.exists()) throw new Error('申請が見つかりません。');

    const application = applicationSnap.data() as ApplicationDocument;
    if (application.type !== 'resign' || application.status !== 'pending') {
      throw new Error('承認できない申請です。');
    }
    if (!application.resignDetails) throw new Error('退職申請の内容がありません。');

    const resignCalendarDate = toFormDate(application.resignDetails.resignAt);
    if (!resignCalendarDate) throw new Error('退職日がありません。');

    const resignAt = toFirestoreTimestamp(resignCalendarDate);
    const licenseEndAt = toFirestoreTimestamp(
      licenseEndAtFromResignAt(resignCalendarDate),
    );

    const employeeRef = doc(
      this.firestore,
      'tenants',
      tid,
      'employees',
      application.eid,
    );
    const employeeSnap = await getDoc(employeeRef);
    if (!employeeSnap.exists()) throw new Error('従業員が見つかりません。');

    const employee = employeeSnap.data() as EmployeeDocument;
    const batch = writeBatch(this.firestore);

    batch.update(employeeRef, {
      'employeeEmployInfo.resignAt': resignAt,
      'employeeEmployInfo.licenseEndAt': licenseEndAt,
      updatedAt: serverTimestamp(),
    });
    
    batch.update(applicationRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    try {
      await this.functionsService.recalculatePremiumsAfterResign({
        tid,
        eid: application.eid,
      });
    } catch (error) {
      console.error('[approveResignApplication] premium recalculation failed', {
        tid,
        eid: application.eid,
        error,
      });
    }

    await this.auditLog.record({
      tid,
      action: 'update',
      category: 'application.resign',
      summary: '退職申請を承認',
      target: this.auditLog.employeeTarget(
        application.eid,
        application.displayName,
        application.employeeId,
        applicationId,
      ),
      metadata: { applicationId, status: 'approved' },
    });
  }

  async rejectApplication(tid: string, applicationId: string): Promise<void> {
    const applicationRef = doc(this.applicationsRef(tid), applicationId);
    const applicationSnap = await getDoc(applicationRef);
    if (!applicationSnap.exists()) throw new Error('申請が見つかりません。');

    const application = applicationSnap.data() as ApplicationDocument;
    if (application.status !== 'pending') throw new Error('却下できない申請です。');

    await updateDoc(applicationRef, {
      status: 'rejected',
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.record({
      tid,
      action: 'update',
      category: `application.${application.type}`,
      summary: '申請を却下',
      target: this.auditLog.employeeTarget(
        application.eid,
        application.displayName,
        application.employeeId,
        applicationId,
      ),
      metadata: { applicationId, status: 'rejected', type: application.type },
    });
  }

  async deleteApplication(tid: string, applicationId: string): Promise<void> {
    const applicationRef = doc(this.applicationsRef(tid), applicationId);
    const applicationSnap = await getDoc(applicationRef);
    if (!applicationSnap.exists()) throw new Error('申請が見つかりません。');

    const application = applicationSnap.data() as ApplicationDocument;
    await deleteDoc(applicationRef);

    await this.auditLog.recordDelete({
      tid,
      category: `application.${application.type}`,
      summary: '申請を削除',
      target: this.auditLog.employeeTarget(
        application.eid,
        application.displayName,
        application.employeeId,
        applicationId,
      ),
      metadata: { applicationId, type: application.type, status: application.status },
    });
  }

  private async loadCurrentEmployee(
    tid: string,
    uid: string,
  ): Promise<{ eid: string; employeeId: string; displayName: string } | null> {
    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    const eid = accountSnap.data()?.['affiliations']?.[tid] as string | undefined;
    if (!eid) return null;

    const employeeSnap = await getDoc(
      doc(this.firestore, 'tenants', tid, 'employees', eid),
    );
    if (!employeeSnap.exists()) return null;

    const data = employeeSnap.data() as EmployeeDocument;
    return {
      eid,
      employeeId: data.employeeEmployInfo?.employeeId ?? '',
      displayName: data.employeePersonalInfo?.displayName ?? '',
    };
  }

  private async assertNoPendingApplication(
    tid: string,
    eid: string,
    type: ApplicationDocument['type'],
  ): Promise<void> {
    const snap = await getDocs(
      query(
        this.applicationsRef(tid),
        where('eid', '==', eid),
        where('type', '==', type),
        where('status', '==', 'pending'),
      ),
    );
    if (!snap.empty) {
      throw new Error('同じ種類の未承認申請が既にあります。承認されるまでお待ちください。');
    }
  }
}
