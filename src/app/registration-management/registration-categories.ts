import type { RegistrationFormType } from '../../../shared/registration-filing-document';

export interface RegistrationFormItem {
  formType: RegistrationFormType;
  label: string;
  requiresEmployeeSelection: boolean;
  batchOfficeForm: boolean;
}

export interface RegistrationCategory {
  id: number;
  label: string;
  description: string;
  forms: RegistrationFormItem[];
}

export const REGISTRATION_CATEGORIES: RegistrationCategory[] = [
  {
    id: 1,
    label: '従業員の入退社',
    description: '従業員の入退社の届出を提出します。',
    forms: [
      { formType: 'qualification_acquisition', label: '被保険者資格取得届', requiresEmployeeSelection: true, batchOfficeForm: false },
      { formType: 'qualification_loss', label: '被保険者資格喪失届', requiresEmployeeSelection: true, batchOfficeForm: false },
    ],
  },
  {
    id: 2,
    label: '家族・扶養の変更',
    description: '家族・扶養の変更の届出を提出します。',
    forms: [
      { formType: 'dependent_change', label: '被扶養者(異動)届', requiresEmployeeSelection: true, batchOfficeForm: false },
      { formType: 'national_pension_type3', label: '国民年金第3号被保険者関係届', requiresEmployeeSelection: true, batchOfficeForm: false },
    ],
  },
  {
    id: 3,
    label: '給与・報酬の変動',
    description: '給与・報酬の変動の届出を提出します。',
    forms: [
      { formType: 'teiji_santei', label: '算定基礎届', requiresEmployeeSelection: true, batchOfficeForm: false },
      { formType: 'monthly_change', label: '月額変更届', requiresEmployeeSelection: true, batchOfficeForm: false },
      { formType: 'bonus_payment', label: '賞与支払届', requiresEmployeeSelection: true, batchOfficeForm: false },
    ],
  },
  {
    id: 4,
    label: '産休・育休手続き',
    description: '産休・育休手続きの届出を提出します。',
    forms: [
      { formType: 'maternity_leave', label: '産前産後休業取得届', requiresEmployeeSelection: true, batchOfficeForm: false },
      { formType: 'childcare_leave', label: '育児休業等取得届', requiresEmployeeSelection: true, batchOfficeForm: false },
    ],
  },
];

export function findRegistrationForm(
  categoryId: number,
  formType: RegistrationFormType,
): RegistrationFormItem | undefined {
  const category = REGISTRATION_CATEGORIES.find((item) => item.id === categoryId);
  return category?.forms.find((form) => form.formType === formType);
}
