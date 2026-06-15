import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { formatJapaneseDate } from '../../date-utils';
import { DEPENDENT_RELATIONSHIP_LABELS } from '../../personal-document';
import {
  formatDependentDisplayName,
} from '../../personal-form-data';
import { PersonalSettingDataService } from '../personal-setting-data.service';
import { RoutesService } from '../../routes.service';
import { WORKPLACE_SELECTION_LABELS } from '../../employee-document';

@Component({
  selector: 'app-employee-info',
  imports: [MatButtonModule],
  templateUrl: './employee-info.cmp.html',
  styleUrls: ['./employee-info.cmp.css', '../personal-setting.cmp.css'],
})
export class EmployeeInfoCmp {
  readonly dataService = inject(PersonalSettingDataService);
  private readonly routesService = inject(RoutesService);

  readonly formatDate = formatJapaneseDate;
  readonly formatDependentName = formatDependentDisplayName;
  readonly relationshipLabel = (value: keyof typeof DEPENDENT_RELATIONSHIP_LABELS) =>
    DEPENDENT_RELATIONSHIP_LABELS[value] ?? '';
  readonly workplaceSelectionLabels = WORKPLACE_SELECTION_LABELS;

  multipleWorkplacesLabel(): string {
    return this.dataService.multiWorkplaceForm.hasMultipleWorkplaces ? 'あり' : 'なし';
  }

  workplaceSelectionLabel(): string {
    const selection = this.dataService.multiWorkplaceForm.workplaceSelection;
    if (!selection) return '—';
    return this.workplaceSelectionLabels[selection];
  }

  edit(): void {
    this.routesService.redirectToEmployeeSettingEdit();
  }
}