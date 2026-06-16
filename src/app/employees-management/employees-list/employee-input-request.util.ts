import { EmployeeInputRequestField } from '../../../../shared/employee-input-request';
import { EmployeeListColumnKey } from './employee-list-columns';

const PERSONAL_INPUT_COLUMNS = new Set<EmployeeListColumnKey>([
  'myNumber',
  'basicPensionNumber',
  'birthDate',
  'age',
  'hasDependents',
]);

export function isPersonalInputColumn(column: EmployeeListColumnKey): column is EmployeeListColumnKey {
  return PERSONAL_INPUT_COLUMNS.has(column);
}

export function columnToInputRequestField(
  column: EmployeeListColumnKey,
): EmployeeInputRequestField | null {
  if (column === 'age') return 'birthDate';
  if (
    column === 'myNumber'
    || column === 'basicPensionNumber'
    || column === 'birthDate'
    || column === 'hasDependents'
  ) {
    return column;
  }
  return null;
}
