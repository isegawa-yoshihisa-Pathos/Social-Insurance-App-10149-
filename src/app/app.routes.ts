import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { HomeCmp } from './home/home.cmp';
import { SigninCmp } from './signin/signin.cmp';
import { SignupCmp } from './signup/signup.cmp';
import { CreateTenantCmp } from './create-tenant/create-tenant.cmp';
import { MainLayoutCmp } from './main-layout/main-layout.cmp';
import { MainPageCmp } from './main-page/main-page.cmp';
import { SettingTenantCmp } from './setting-tenant/setting-tenant.cmp';
import { EmployeesManagementCmp } from './employees-management/employees-management.cmp';
import { InvitationsManagementCmp } from './invitations-management/invitations-management.cmp';
import { TaskBoardCmp } from './task-board/task-board.cmp';
import { InvitationAcceptCmp } from './invitation-accept/invitation-accept.cmp';
import { PersonalSettingCmp } from './personal-setting/personal-setting.cmp';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeCmp },
  { path: 'signup', component: SignupCmp },
  { path: 'signin', component: SigninCmp },
  { path: 'create-tenant', component: CreateTenantCmp },
  { 
    path: '',
    component: MainLayoutCmp,
    canActivate: [authGuard],
    children: [
      { path: 'main-page', component: MainPageCmp },
      { path: 'task-board', component: TaskBoardCmp },
      { path: 'personal-setting', component: PersonalSettingCmp },
      { path: 'setting-tenant', component: SettingTenantCmp, canActivate: [adminGuard] },
      { path: 'employees-management', component: EmployeesManagementCmp, canActivate: [adminGuard] },
      { path: 'invitations-management', component: InvitationsManagementCmp, canActivate: [adminGuard] },
    ]
  },
  { path: 'invitation', component: InvitationAcceptCmp },
];
