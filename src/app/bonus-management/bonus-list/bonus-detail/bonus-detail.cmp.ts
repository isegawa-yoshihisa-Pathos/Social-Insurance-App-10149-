import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { map } from 'rxjs';
import { CurrentTenantService } from '../../../current-tenant.service';
import { BonusManagementDataService } from '../../bonus-management-data.service';
import { BonusSettingDataService } from '../../bonus-setting/bonus-setting-data.service';
import { BonusDetailRow, BonusListDataService, EmployeeLookupEntry } from '../bonus-list-data.service';
import { BonusListColumnKey, getBonusListColumnLabel } from '../bonus-list-columns';
import {
  bonusDetailSearchText,
  bonusListSortValue,
  formatBonusListCellValue,
  type BonusDetailColumnKey,
} from '../bonus-list-row.mapper';
import { BonusListExportService } from '../bonus-list-export.service';
import { downloadCsvFile } from '../../../csv/csv-file.util';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { RoutesService } from '../../../routes.service';

@Component({
  selector: 'app-bonus-detail',
  imports: [
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    MatTooltipModule,
    MatMenuModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './bonus-detail.cmp.html',
  styleUrl: './bonus-detail.cmp.css',
})
export class BonusDetailCmp {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly bonusSettingDataService = inject(BonusSettingDataService);
  private readonly listDataService = inject(BonusListDataService);
  private readonly exportService = inject(BonusListExportService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  private loadToken = 0;
  private settingsLoadedTid: string | null = null;

  readonly eid = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('eid'))),
    { initialValue: null },
  );

  readonly employeeName = signal('');
  readonly employeeId = signal('');
  readonly employees = signal<EmployeeLookupEntry[]>([]);
  readonly loading = signal(true);

  dataSource = new MatTableDataSource<BonusDetailRow>([]);

  searchTargetColumn: BonusDetailColumnKey = 'yyyyMm';
  searchQuery = '';

  readonly isFilterActive = computed(() => !!this.searchQuery.trim());
  readonly hasFilteredResults = computed(() => this.dataSource.filteredData.length > 0);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  readonly visibleColumns = computed((): BonusDetailColumnKey[] => {
    const baseColumns = this.bonusSettingDataService.visibleColumns();
    const filtered = baseColumns.filter(
      (col) => col !== 'displayName' && col !== 'employeeId',
    );
    return ['yyyyMm', ...filtered];
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (row, property) => {
      if (property === 'yyyyMm') return row.yyyyMm;
      return bonusListSortValue(row, property as BonusListColumnKey);
    };

    this.dataSource.filterPredicate = (data, filter) => {
      const searchCondition = JSON.parse(filter) as {
        column: BonusDetailColumnKey;
        query: string;
      };
      const text = bonusDetailSearchText(data, searchCondition.column).toLowerCase();
      return text.includes(searchCondition.query);
    };

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      if (!tid || !eid) {
        this.dataSource.data = [];
        this.employeeName.set('');
        this.employeeId.set('');
        this.employees.set([]);
        this.settingsLoadedTid = null;
        this.loading.set(false);
        return;
      }

      const token = ++this.loadToken;
      void this.loadForEmployee(tid, eid, token);
    });
  }

  private async loadForEmployee(tid: string, eid: string, token: number): Promise<void> {
    this.loading.set(true);
    this.searchQuery = '';
    this.dataSource.filter = '';
    try {
      if (this.settingsLoadedTid !== tid) {
        await Promise.all([
          this.bonusManagementDataService.loadBonusSettings(tid),
          this.bonusSettingDataService.loadListSettings(tid),
        ]);
        if (token !== this.loadToken) return;
        this.settingsLoadedTid = tid;
      }

      const [result, employeeLookup] = await Promise.all([
        this.listDataService.loadEmployeeBonusHistory(tid, eid),
        this.listDataService.loadEmployeeLookup(tid),
      ]);
      if (token !== this.loadToken) return;

      this.employees.set(this.sortEmployees([...employeeLookup.values()]));
      this.employeeName.set(result.displayName);
      this.employeeId.set(result.employeeId);
      this.dataSource.data = result.rows;
    } catch (error) {
      if (token !== this.loadToken) return;
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      if (token === this.loadToken) {
        this.loading.set(false);
      }
    }
  }

  getColumnLabel(column: string): string {
    if (column === 'yyyyMm') return '対象月';
    return getBonusListColumnLabel(
      column as BonusListColumnKey,
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  formatCellValue(row: BonusDetailRow, col: string): string {
    if (col === 'yyyyMm') {
      const [year, month] = row.yyyyMm.split('-');
      return `${year}年${parseInt(month, 10)}月`;
    }
    return formatBonusListCellValue(row, col as BonusListColumnKey);
  }

  search(): void {
    this.dataSource.filter = JSON.stringify({
      column: this.searchTargetColumn,
      query: this.searchQuery.toLowerCase(),
    });
  }

  async exportData(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const eid = this.eid();
    if (!tid || !eid || this.dataSource.data.length === 0) return;

    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
    await this.bonusSettingDataService.loadSettings(tid, bonusDefinitions);
    const filtered = this.dataSource.filteredData;
    const sortedAndFilteredData = this.dataSource.sort
      ? this.dataSource.sortData(filtered, this.dataSource.sort)
      : filtered;

    const fileLabel = this.employeeId() || eid;
    const csv = this.exportService.buildEmployeeHistoryCsv(
      fileLabel,
      this.visibleColumns(),
      sortedAndFilteredData,
      this.bonusSettingDataService.importHeaders(),
      bonusDefinitions,
    );
    downloadCsvFile(`bonus-${fileLabel}.csv`, csv);
  }

  redirectToBonusManagement(): void {
    void this.routesService.redirectToBonusManagement();
  }

  switchEmployee(eid: string): void {
    if (!eid || eid === this.eid()) return;
    void this.router.navigate(['/bonus-management', 'detail', eid]);
  }

  private sortEmployees(employees: EmployeeLookupEntry[]): EmployeeLookupEntry[] {
    return employees.sort((a, b) => {
      const nameCompare = a.displayName.localeCompare(b.displayName, 'ja');
      if (nameCompare !== 0) return nameCompare;
      return a.employeeId.localeCompare(b.employeeId, 'ja');
    });
  }
}
