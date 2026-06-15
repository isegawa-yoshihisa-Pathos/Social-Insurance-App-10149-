import type { EmployeeDocument } from '../../employee-document';

export type WorkplaceSelectionType = 'selected' | 'non_selected';

export interface MultiWorkplaceSettings {
  /** 二以上事業所勤務の有無 */
  hasMultipleWorkplaces: boolean;
  /** hasMultipleWorkplaces が true のときのみ有効 */
  workplaceSelection?: WorkplaceSelectionType;
}

export function createDefaultMultiWorkplaceSettings(): MultiWorkplaceSettings {
  return {
    hasMultipleWorkplaces: false,
  };
}

export function hasMultipleWorkplacesEnabled(
  settings: MultiWorkplaceSettings | null | undefined,
): boolean {
  return settings?.hasMultipleWorkplaces === true;
}

export function isNonSelectedWorkplace(
  settings: MultiWorkplaceSettings | null | undefined,
): boolean {
  return (
    hasMultipleWorkplacesEnabled(settings) &&
    settings?.workplaceSelection === 'non_selected'
  );
}

export function canManageDependents(
  settings: MultiWorkplaceSettings | null | undefined,
): boolean {
  return !isNonSelectedWorkplace(settings);
}

export function hasMultipleWorkplacesEnabledForEmployee(
  employee: Pick<EmployeeDocument, 'multiWorkplaceSettings'> | null | undefined,
): boolean {
  return hasMultipleWorkplacesEnabled(employee?.multiWorkplaceSettings);
}

export function normalizeMultiWorkplaceSettings(
  settings: MultiWorkplaceSettings,
): MultiWorkplaceSettings {
  if (!settings.hasMultipleWorkplaces) {
    return { hasMultipleWorkplaces: false };
  }
  return {
    hasMultipleWorkplaces: true,
    workplaceSelection: settings.workplaceSelection ?? 'selected',
  };
}

export const WORKPLACE_SELECTION_LABELS: Record<WorkplaceSelectionType, string> = {
  selected: '選択事業所',
  non_selected: '非選択事業所',
};
