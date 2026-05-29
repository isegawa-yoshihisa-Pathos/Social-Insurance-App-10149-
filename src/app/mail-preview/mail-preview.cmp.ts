import { Component, input } from '@angular/core';

@Component({
  selector: 'app-mail-preview',
  standalone: true,
  imports: [],
  templateUrl: './mail-preview.cmp.html',
  styleUrl: './mail-preview.cmp.css',
})
export class MailPreviewCmp {
  readonly bodyText = input.required<string>();
  readonly inviteLink = input<string | null>(null);
}
