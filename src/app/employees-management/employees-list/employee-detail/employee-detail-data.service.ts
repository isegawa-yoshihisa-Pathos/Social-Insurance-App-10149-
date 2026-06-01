import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { CurrentTenantService } from '../../../current-tenant.service';
import { AuthService } from '../../../auth.service';
import {
  EmployeeFormData,
  createEmptyEmployeeForm,
  employeePersonalInfoToForm,
} from '../../../personal-form-data';
import { EmployeeDocument, EmployeeEmployFormData } from '../../../employee-document';
import {
  createEmptyEmployForm,
  employFormToSavePayload,
  employeeEmployInfoToForm,
} from '../../../employee-employ-form-data';

@Injectable({
  providedIn: 'root',
})
export class EmployeeDetailDataService {
  private readonly firestore = inject(Firestore);
  private readonly tenant = inject(CurrentTenantService);
  private readonly authService = inject(AuthService);

  eid = '';
  loading = false;
  loaded = false;

  personalForm: EmployeeFormData = createEmptyEmployeeForm();
  employForm: EmployeeEmployFormData = createEmptyEmployForm();
  role: 'admin' | 'member' = 'member';

  async load(eid: string, force = false): Promise<void> {
    if (this.loaded && this.eid === eid && !force) return;

    const tid = this.tenant.currentTid();
    if (!tid) throw new Error('事業所が見つかりません。');

    this.loading = true;
    this.eid = eid;

    try {
      const snap = await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid));
      if (!snap.exists()) throw new Error('従業員が見つかりません。');

      const data = snap.data() as Partial<EmployeeDocument>;

      this.personalForm = employeePersonalInfoToForm(data.employeePersonalInfo);
      this.employForm = employeeEmployInfoToForm(data.employeeEmployInfo);
      this.role = data.role ?? 'member';
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  signOut(): void {
    this.reset();
  }

  private reset(): void {
    this.eid = '';
    this.loading = false;
    this.loaded = false;
    this.personalForm = createEmptyEmployeeForm();
    this.employForm = createEmptyEmployForm();
    this.role = 'member';
  }

  async saveEmploy(): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid || !this.eid) throw new Error('従業員情報の保存に必要な情報が不足しています。');

    await updateDoc(doc(this.firestore, 'tenants', tid, 'employees', this.eid), {
      ...employFormToSavePayload(this.employForm),
      updatedAt: serverTimestamp(),
    });

    const uid = this.authService.uid();
    if (uid) {
      const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
      const ownEid = accountSnap.data()?.['affiliations']?.[tid] as string | undefined;
      if (ownEid === this.eid) {
        await this.tenant.reloadCurrentEmployeeId(uid);
      }
    }
  }
}
