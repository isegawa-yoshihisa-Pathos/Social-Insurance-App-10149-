import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon'; 
import { MatTooltipModule } from '@angular/material/tooltip';
import { OverlayModule } from '@angular/cdk/overlay';

const HELP_DATA: Record<string, { title: string, description: string }> = {
  'hiEstRecNum': {
    title: '健康保険・事業所整理記号',
    description: '保険証の「記号」に記されている番号です。桁数は加入する健康保険組合によって異なり、協会けんぽの場合は7～8桁です。',
  },
  'piEstNum': {
    title: '厚生年金・事業所番号',
    description: '年金事務所から送付される「適用通知書」などに記載されている5桁の番号です。雇用保険の11桁の事業所番号とは別です。\n（例）12345',
  },
  'piEstRecNum': {
    title: '厚生年金・事業所整理記号',
    description: '年金事務所から送付される「納入告知書」などに記載されている「数字2桁 - カタカナまたは英数字4桁以内」の文字列です。「適用通知書」などでは「漢字 – ひらがな」の形式になっていますが、協会や組合の提供する変換表を用いて、「数字 – カタカナ」の形式で入力してください。\n（例）01-イロハ',
  },
  'spInsCollType': {
    title: '特定被保険者徴収区分',
    description: '特定被保険者とは、40歳未満（または65歳以上）の被保険者（本人）が、介護保険の第2号被保険者である40歳以上65歳未満の被扶養者（家族）を扶養している場合に適用される制度上の呼称です。\n通常、介護保険料は40歳以上65歳未満の被保険者からのみ徴収されますが、加入している健康保険組合によっては特定被保険者からの徴収も行われます。協会けんぽにはこの制度はありません。',
  },
  'invitationImport': {
    title: '招待メールアドレスのインポート',
    description: '1行目にヘッダーが設定されている必要があります。ヘッダー名は設定画面から指定できます。他の列があっても問題ありませんが、名前とメールアドレスは必須です。2行目以降に記述されたメールアドレスと名前がインポートされます。\n（例）name,email\n田中 太郎, taro.tanaka@example.com\n山田 花子,hanako.yamada@example.com',
  },
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
