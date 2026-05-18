import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { HomeCmp } from './home/home.cmp';
import { SigninCmp } from './signin/signin.cmp';
import { SignupCmp } from './signup/signup.cmp';
import { CreateEstablishmentCmp } from './create-establishment/create-establishment.cmp';
import { MainLayoutCmp } from './main-layout/main-layout.cmp';
import { MainPageCmp } from './main-page/main-page.cmp';
import { SettingEstablishmentCmp } from './setting-establishment/setting-establishment.cmp';
import { SettingEmployeesCmp } from './setting-employees/setting-employees.cmp';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeCmp },
  { path: 'signup', component: SignupCmp },
  { path: 'signin', component: SigninCmp },
  { path: 'create-establishment', component: CreateEstablishmentCmp },
  { 
    path: '',
    component: MainLayoutCmp,
    canActivate: [authGuard],
    children: [
      { path: 'main-page', component: MainPageCmp },
      { path: 'setting-establishment', component: SettingEstablishmentCmp },
      { path: 'setting-employees', component: SettingEmployeesCmp },
    ]
  },
];
