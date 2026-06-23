import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon'; 
import { MatTooltipModule } from '@angular/material/tooltip';
import { OverlayModule } from '@angular/cdk/overlay';

const HELP_DATA: Record<string, { title: string, description: string }> = {
  'hiTenantRecNum': {
    title: '健康保険・事業所整理記号',
    description: '保険証の「記号」に記されている番号です。桁数は加入する健康保険組合によって異なり、協会けんぽの場合は7～8桁です。',
  },
  'piTenantNum': {
    title: '厚生年金・事業所番号',
    description: '年金事務所から送付される「適用通知書」などに記載されている5桁の番号です。雇用保険の11桁の事業所番号とは別です。\n（例）12345',
  },
  'piTenantRecNum': {
    title: '厚生年金・事業所整理記号',
    description: `年金事務所から送付される「納入告知書」などに記載されている「数字2桁 - カタカナまたは英数字4桁以内」の文字列です。`+
    `「適用通知書」などでは「漢字 – ひらがな」の形式になっていますが、協会や組合の提供する変換表を用いて、「数字 – カタカナ」の形式で入力してください。\n（例）01-イロハ`,
  },
  'spInsCollType': {
    title: '特定被保険者徴収区分',
    description: `特定被保険者とは、40歳未満（または65歳以上）の被保険者（本人）が、介護保険の第2号被保険者である40歳以上65歳未満の被扶養者（家族）を扶養している場合に適用される制度上の呼称です。`+
    `\n通常、介護保険料は40歳以上65歳未満の被保険者からのみ徴収されますが、加入している健康保険組合によっては特定被保険者からの徴収も行われます。協会けんぽにはこの制度はありません。`,
  },
  'invitationImport': {
    title: '招待メールアドレスのインポート',
    description: `1行目にヘッダーが設定されている必要があります。ヘッダー名は設定画面から指定できます。他の列があっても問題ありませんが、名前とメールアドレスは必須です。2行目以降に記述されたメールアドレスと名前がインポートされます。`+
    `\n（例）name,email\n田中 太郎, taro.tanaka@example.com\n山田 花子,hanako.yamada@example.com`,
  },
  'payrollBaseDaysStandard': {
    title: '支払基礎日数基準',
    description: `支払基礎日数基準は、支払基礎日数の計算方法を指定します。締め日基準の場合は、締め日を基準にして支払基礎日数を計算します。暦日基準の場合は、暦日を基準にして支払基礎日数を計算します。`+
    `\n（例）締め日が25日の場合、前月25日～当月24日までの日数が支払基礎日数になります。\n（例）暦日基準の場合、当月1日～当月末日までの日数が支払基礎日数になります。`,
  },
  'payrollPaymentMonth': {
    title: '給与支給月',
    description: '給与管理画面での給与データの表示月を指定します。社会保険料徴収月の設定とは独立です。\n当月：報酬管理の計算月と給与管理の支給月が一致します。\n翌月：報酬管理の計算月の翌月が給与管理の支給月になります。',
  },
  'socialInsuranceCollectionMonth': {
    title: '社会保険料徴収月',
    description: '社会保険料の徴収月を指定します。原則は翌月徴収です。\n当月：報酬管理の計算月と社会保険料徴収月が一致します。\n翌月：報酬管理の計算月の翌月が社会保険料徴収月になります。\n翌々月：報酬管理の計算月の翌々月が社会保険料徴収月になります。',
  },
  'employeesImport': {
    title: '社員情報のインポート',
    description: '1行目にヘッダーが設定されている必要があります。ヘッダー名は設定画面から指定できます。ヘッダーに社員番号または氏名が含まれている必要があります。2行目以降に記述された値がインポートされます。\n詳しい入力値は「設定」からご確認ください。',
  },
  'monthlyImport': {
    title: '報酬データのインポート',
    description: `1行目にヘッダーが設定されている必要があります。ヘッダー名は設定画面から指定できます。ヘッダーに社員番号または氏名が含まれている必要があります。2行目以降に記述された値がインポートされます。`+
    `\n詳しい入力値は「設定」からご確認ください。\n数値は数字で入力してください。カンマ（,）は使用できません。\n複数月を同時インポートする場合は、月ごとにyyyy-mm.csvというファイル名を設定してください。`,
  },
  'bonusImport': {
    title: '賞与データのインポート',
    description: `1行目にヘッダーが設定されている必要があります。ヘッダー名は設定画面から指定できます。ヘッダーに社員番号または氏名が含まれている必要があります。2行目以降に記述された値がインポートされます。`+
    `\n詳しい入力値は「設定」からご確認ください。\n数値は数字で入力してください。カンマ（,）は使用できません。\n複数月を同時インポートする場合は、月ごとにyyyy-mm.csvというファイル名を設定してください。`,
  },
  'role': {
    title: '権限',
    description: '権限は「admin」か「管理者」,または「member」か「一般」で指定してください。\nadminは管理者権限を持ちあらゆる操作が可能、memberは一般ユーザー権限は自身のデータのみ操作可能です。',
  },
  'status': {
    title: 'ステータス',
    description: 'ステータスは「active」か「在職」,または「leave」か「休職」,または「resigned」か「退職」で指定してください。',
  },
  'payType': {
    title: '給与タイプ',
    description: '給与タイプは「monthly」か「完全月給」,または「daily-monthly」か「日給月給」,または「weekly」か「週給」,または「daily」か「日給」,または「hourly」か「時給」で指定してください。',
  },
  'employmentType': {
    title: '雇用形態',
    description: '雇用形態は「full-time」か「正社員」,または「short-time-worker」か「短時間就労者」,または「short-time-labor」か「短時間労働者」で指定してください。',
  },
  'date': {
    title: '日付',
    description: '日付はYYYY-MM-DDまたはYYYY/MM/DDの形式で入力してください。',
  },
  'Rounding': {
    title: '端数処理',
    description: '切り捨てる基準値（銭）と境界を設定します。\n「以下」を選んだ場合、50銭を設定すると50銭以下を切り捨て、50銭を超える場合は切り上げます。\n「未満」を選んだ場合、50銭を設定すると50銭未満を切り捨て、50銭以上は切り上げます。\n法令で定められている端数処理は、給与（賞与）からの控除は「50銭以下」、現金での支払は「50銭未満」です。',
  },
  'resignedCollection': {
    title: '退職時の保険料徴収',
    description: '退職後にも保険料の徴収がある場合に、退職月に「一括徴収」するか、通常通りの「月次徴収」を行うかを指定します。',
  }
};

@Component({
  selector: 'app-help-content',
  imports: [MatButtonModule, MatIconModule, OverlayModule, MatTooltipModule],
  standalone: true,
  templateUrl: './help-content.cmp.html',
  styleUrl: './help-content.cmp.css',
})
export class HelpContentCmp {
  @Input() key: string = '';
  isOpen = false;

  get helpData(): { title: string, description: string } {
    return HELP_DATA[this.key];
  }

}
