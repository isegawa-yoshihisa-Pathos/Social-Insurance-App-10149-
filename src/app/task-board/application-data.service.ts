import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
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
import { FunctionsService } from '../functions.service';

export type PendingApplication = { id: string } & ApplicationDocument;

@Injectable({ providedIn: 'root' })
export class ApplicationDataService {
  private readonly firestore = inject(Firestore);
  private readonly tenant = inject(CurrentTenantService);
  private readonly authService = inject(AuthService);
  private readonly functionsService = inject(FunctionsService);

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
  }

  async listPendingLeaveApplications(tid: string): Promise<PendingApplication[]> {
    return this.listPendingApplicationsByType(tid, 'leave');
  }

  async listPendingResignApplications(tid: string): Promise<PendingApplication[]> {
    return this.listPendingApplicationsByType(tid, 'resign');
  }

  async listApplications(tid: string, eid: string): Promise<ApplicationDocument[]> {
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

  private async listPendingApplicationsByType(
    tid: string,
    type: ApplicationDocument['type'],
  ): Promise<PendingApplication[]> {
    const snap = await getDocs(
      query(
        this.applicationsRef(tid),
        where('type', '==', type),
        where('status', '==', 'pending'),
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

    const resignAt = toFirestoreTimestamp(
      toFormDate(application.resignDetails.resignAt),
    );
    if (!resignAt) throw new Error('退職日がありません。');

    const resignDate = resignAt.toDate();
    const nextDayDate = new Date(resignDate);
    nextDayDate.setDate(resignDate.getDate() + 1);
    const licenseEndAt = toFirestoreTimestamp(nextDayDate);

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
}
