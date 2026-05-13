import { Component } from '@angular/core';
import { AppFooterCmp } from './app-footer/app-footer.cmp';
import { AppHeaderCmp } from './app-header/app-header.cmp';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [AppFooterCmp, AppHeaderCmp, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
