/** 監査ログ category の日本語表示名 */
export const AUDIT_LOG_CATEGORY_LABELS: Record<string, string> = {
  'application.leave': '休暇申請',
  'application.allowance': '諸手当申請',
  'application.personal_info': '基本情報変更申請',
  'application.dependents': '扶養家族変更申請',
  'application.resign': '退職申請',
  'employee.personal': '従業員個人情報',
  'employee.employ': '従業員雇用情報',
  'employee.list': '従業員一括編集',
  'employee.input_request': '従業員入力依頼',
  'employee.import': '従業員CSVインポート',
  'employee.multi_workplace': '二以上事業所勤務',
  'monthly.payroll': '月次給与',
  'monthly.standardRemuneration': '標準報酬月額（月次）',
  'monthly.import': '月次CSVインポート',
  'monthly.lock': '月次締切',
  'bonus.bulk_edit': '賞与一括編集',
  'bonus.import': '賞与CSVインポート',
  'bonus.lock': '賞与締切',
  'premium.calculate': '保険料計算',
  'standard_remuneration': '標準報酬月額',
  'standard_bonus': '標準賞与額',
  'tenant.profile': '事業所設定',
  'registration.filing': '届出作成',
  'invitation': '招待',
  'invitation.create': '招待作成',
  'settings.allowance_kind': '手当種類設定',
  'settings.bonus_kind': '賞与種類設定',
  'settings.bonus_list': '賞与一覧設定',
  'settings.monthly_list': '月次一覧設定',
  'settings.payment_list': '給与一覧設定',
  'settings.employees_list': '従業員一覧設定',
  'settings.insurance_rate': '保険料率設定',
};

/** 監査ログ changes[].field の日本語表示名 */
export const AUDIT_LOG_CHANGE_FIELD_LABELS: Record<string, string> = {
  // 従業員・個人
  displayName: '氏名',
  employeeId: '社員番号',
  email: 'メールアドレス',
  role: '権限',
  realName: '氏名（本名）',
  myNumber: 'マイナンバー',
  basicPensionNumber: '基礎年金番号',
  birthDate: '生年月日',
  age: '年齢',
  phoneNumber: '電話番号',
  zipcode: '郵便番号',
  address: '住所',
  hasDependents: '扶養家族の有無',
  dependentsInfo: '扶養家族情報',
  hasMultipleWorkplaces: '二以上事業所勤務設定',
  allowances: '手当',

  // 雇用情報
  position: '役職',
  department: '部署',
  payType: '給与区分',
  employmentType: '雇用形態',
  status: '勤務状況',
  joinedAt: '入社日',
  resignAt: '退職日',
  licenseStartAt: '資格取得日',
  licenseEndAt: '資格喪失日',
  healthInsuranceRecordNumber: '健康保険整理番号',
  pensionInsuranceRecordNumber: '厚生年金整理番号',

  // 月次給与
  paymentBaseDays: '支払基礎日数',
  basicSalary: '基本給与',
  fringeBenefits: '現物給与',
  bonusRelatedRemuneration: '賞与にかかる報酬',
  fixedWage: '固定的賃金',
  variableWage: '非固定的賃金',
  retroactivePay: '遡及支払',
  payrollData: '給与データ',
  premiumData: '保険料データ',

  // 標準報酬・保険料
  standardRemunerationHealth: '標準報酬月額（健保）',
  standardRemunerationPension: '標準報酬月額（厚年）',
  standardBonusHealth: '標準賞与額（健保）',
  standardBonusPension: '標準賞与額（厚年）',
  healthInsuranceEmployee: '健保（本人）',
  healthInsuranceEmployer: '健保（事業主）',
  careInsuranceEmployee: '介護（本人）',
  careInsuranceEmployer: '介護（事業主）',
  pensionInsuranceEmployee: '厚年（本人）',
  pensionInsuranceEmployer: '厚年（事業主）',
  source: '算定根拠',
  healthGrade: '健保等級',
  pensionGrade: '厚年等級',
  standardRemuneration: '標準報酬月額',
  standardBonus: '標準賞与額',

  // 賞与
  bonus: '賞与',
  bonusData: '賞与データ',

  // 事業所
  tenantName: '事業所名',
  tenantNameKana: '事業所名（カナ）',
  ownerName: '事業主名',
  ownerLastName: '事業主姓',
  ownerFirstName: '事業主名',
  ownerLastNameKana: '事業主姓（カナ）',
  ownerFirstNameKana: '事業主名（カナ）',
  socialInsuranceSettings: '社会保険設定',
  corporateNumber: '法人番号',
  healthInsuranceType: '健康保険種別',
  combinationCode: '組合コード',
  combinationName: '組合名',
  healthInsuranceTenantRecordNumber: '健康保険事業所整理記号',
  pensionInsuranceTenantNumber: '厚生年金事業所番号',
  pensionInsuranceTenantRecordNumber: '厚生年金事業所整理記号',
  socialInsuranceCollectionMonth: '社会保険料徴収月',
  payrollPaymentMonth: '給与支給月',
  resignPremiumCollection: '退職時保険料徴収',
  specificInsuranceCollectionType: '特定保険料徴収区分',

  // 設定系
  visibleColumns: '表示列',
  types: '種類定義',
  importHeaders: 'インポート見出し',
  locked: '締切',
  templateText: 'テンプレート文面',
  replyToEmail: '返信先メール',
  effectiveFrom: '適用開始日',
  label: 'ラベル',
  healthInsuranceRate: '健康保険料率',
  careInsuranceRate: '介護保険料率',
  pensionInsuranceRate: '厚生年金保険料率',
  employeeRate: '被保険者負担率',
  roundingBy: '端数処理',
};

export function formatAuditLogCategory(category: string): string {
  if (!category) {
    return '—';
  }

  const exact = AUDIT_LOG_CATEGORY_LABELS[category];
  if (exact) {
    return exact;
  }

  if (category.startsWith('application.')) {
    const suffix = category.slice('application.'.length);
    const known = AUDIT_LOG_CATEGORY_LABELS[category];
    if (known) {
      return known;
    }
    return `申請（${suffix}）`;
  }

  const [group, name] = category.split('.', 2);
  if (name) {
    const groupLabels: Record<string, string> = {
      application: '申請',
      employee: '従業員',
      monthly: '月次',
      bonus: '賞与',
      settings: '設定',
      registration: '届出',
      invitation: '招待',
      tenant: '事業所',
    };
    const groupLabel = groupLabels[group] ?? group;
    return `${groupLabel}（${name}）`;
  }

  return category;
}

function formatDynamicChangeField(field: string): string | null {
  if (field.startsWith('allowance-') || field.startsWith('allowance_')) {
    const type = field.replace(/^allowance[-_]/, '');
    return `手当（${type}）`;
  }

  if (
    field.startsWith('bonus-') ||
    field.endsWith('-bonus') ||
    (field.includes('bonus') && !AUDIT_LOG_CHANGE_FIELD_LABELS[field])
  ) {
    return `賞与（${field}）`;
  }

  const dotted = field.split('.');
  if (dotted.length > 1) {
    const leaf = dotted[dotted.length - 1];
    const leafLabel = AUDIT_LOG_CHANGE_FIELD_LABELS[leaf];
    if (leafLabel) {
      return leafLabel;
    }
  }

  return null;
}

export function formatAuditLogChangeField(field: string): string {
  if (!field) {
    return '—';
  }

  const exact = AUDIT_LOG_CHANGE_FIELD_LABELS[field];
  if (exact) {
    return exact;
  }

  const dynamic = formatDynamicChangeField(field);
  if (dynamic) {
    return dynamic;
  }

  return field;
}

export const formatCategory = formatAuditLogCategory;

export const formatChangeField = formatAuditLogChangeField;
