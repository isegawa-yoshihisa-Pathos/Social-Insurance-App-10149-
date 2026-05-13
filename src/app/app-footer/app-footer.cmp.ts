import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [MatToolbarModule],
  templateUrl: './app-footer.cmp.html',
  styleUrl: './app-footer.cmp.css',
})
export class AppFooterCmp {}
