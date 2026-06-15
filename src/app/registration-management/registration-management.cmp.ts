import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../current-tenant.service';
import { AuthService } from '../auth.service';
import {
  REGISTRATION_CATEGORIES,
  RegistrationCategory,
  RegistrationFormItem,
} from './registration-categories';
import { RegistrationManagementDataService } from './registration-management-data.service';
import { RegistrationEmployeeRow } from './registration-eligibility.service';
import { isRegistrationCsvFormType } from '../../../shared/registration-filing-document';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../success-dialog/success-dialog.cmp';

type RegistrationView = 'categories' | 'formTypes' | 'create';

@Component({
  selector: 'app-registration-management',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './registration-management.cmp.html',
  styleUrl: './registration-management.cmp.css',
})
export class RegistrationManagementCmp {
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly authService = inject(AuthService);
  private readonly dataService = inject(RegistrationManagementDataService);
  private readonly dialog = inject(MatDialog);

  readonly categories = REGISTRATION_CATEGORIES;
  readonly view = signal<RegistrationView>('categories');
  readonly selectedCategory = signal<RegistrationCategory | null>(null);
  readonly selectedForm = signal<RegistrationFormItem | null>(null);
  readonly employees = signal<RegistrationEmployeeRow[]>([]);
  readonly selectedEids = signal<Set<string>>(new Set());
  readonly showEligibleOnly = signal(false);
  readonly loading = signal(false);
  readonly creating = signal(false);

  readonly displayedColumns = ['selected', 'eligibility', 'displayName', 'employeeId', 'detail'];

  readonly eligibleEmployees = computed(() =>
    this.employees().filter((row) => row.eligibility.eligible),
  );

  readonly displayedEmployees = computed(() => {
    const rows = this.employees();
    return this.showEligibleOnly() ? rows.filter((row) => row.eligibility.eligible) : rows;
  });

  readonly eligibilitySummary = computed(() => {
    const rows = this.employees();
    const eligible = rows.filter((row) => row.eligibility.eligible).length;
    return { eligible, ineligible: rows.length - eligible, total: rows.length };
  });

  constructor() {
    effect(async () => {
      const tid = this.currentTenantService.currentTid();
      const form = this.selectedForm();
      if (!tid || this.view() !== 'create' || !form?.requiresEmployeeSelection) {
        return;
      }
      await this.loadEmployees(tid, form);
    });
  }

  openCategory(category: RegistrationCategory): void {
    this.selectedCategory.set(category);
    this.view.set('formTypes');
  }

  openForm(form: RegistrationFormItem): void {
    const category = this.selectedCategory();
    if (!category) return;

    this.selectedForm.set(form);
    this.selectedEids.set(new Set());
    this.showEligibleOnly.set(false);
    this.view.set('create');
  }

  goBack(): void {
    const form = this.selectedForm();
    if (form) {
      this.selectedForm.set(null);
      this.selectedEids.set(new Set());
      this.showEligibleOnly.set(false);
      this.view.set('formTypes');
      return;
    }

    this.selectedCategory.set(null);
    this.view.set('categories');
  }

  isSelected(eid: string): boolean {
    return this.selectedEids().has(eid);
  }

  isEligible(row: RegistrationEmployeeRow): boolean {
    return row.eligibility.eligible;
  }

  toggleSelection(row: RegistrationEmployeeRow, checked: boolean): void {
    if (checked && !row.eligibility.eligible) {
      return;
    }
    const next = new Set(this.selectedEids());
    if (checked) {
      next.add(row.eid);
    } else {
      next.delete(row.eid);
    }
    this.selectedEids.set(next);
  }

  onRowClick(row: RegistrationEmployeeRow): void {
    if (!row.eligibility.eligible) {
      return;
    }
    this.toggleSelection(row, !this.isSelected(row.eid));
  }

  isAllSelected(): boolean {
    const rows = this.eligibleEmployees();
    return rows.length > 0 && rows.every((row) => this.selectedEids().has(row.eid));
  }

  isSomeSelected(): boolean {
    const rows = this.eligibleEmployees();
    const selectedCount = rows.filter((row) => this.selectedEids().has(row.eid)).length;
    return selectedCount > 0 && selectedCount < rows.length;
  }

  toggleAll(checked: boolean): void {
    if (checked) {
      this.selectedEids.set(new Set(this.eligibleEmployees().map((row) => row.eid)));
      return;
    }
    this.selectedEids.set(new Set());
  }

  canCreate(): boolean {
    const form = this.selectedForm();
    if (!form) return false;
    if (!form.requiresEmployeeSelection) return true;
    return this.selectedEids().size > 0;
  }

  async createDocuments(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const category = this.selectedCategory();
    const form = this.selectedForm();
    const uid = this.authService.uid();
    if (!tid || !category || !form || !uid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所またはログイン情報が見つかりません。' },
      });
      return;
    }
    if (!this.canCreate()) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '該当する従業員を1名以上選択してください。' },
      });
      return;
    }

    this.creating.set(true);
    try {
      const eids = form.requiresEmployeeSelection ? [...this.selectedEids()] : [];
      const filings = await this.dataService.createFilings(
        tid,
        category.id,
        form,
        eids,
        uid,
      );
      this.dataService.downloadFilings(filings, form.label);
      const fileKind = isRegistrationCsvFormType(form.formType) ? 'CSV' : 'JSON';
      this.dialog.open(SuccessDialogCmp, {
        data: {
          title: '書類作成完了',
          message: `${form.label}を${filings.length}件作成しました。${fileKind}ファイルをダウンロードしました。`,
        },
      });
      this.goBack();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.creating.set(false);
    }
  }

  currentFormLabel(): string {
    return this.selectedForm()?.label ?? '';
  }

  private async loadEmployees(tid: string, form: RegistrationFormItem): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.dataService.listEmployeesForForm(tid, form.formType);
      this.employees.set(rows);
      const eligibleEids = new Set(
        rows.filter((row) => row.eligibility.eligible).map((row) => row.eid),
      );
      this.selectedEids.set(
        new Set([...this.selectedEids()].filter((eid) => eligibleEids.has(eid))),
      );
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading.set(false);
    }
  }
}
