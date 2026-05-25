import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { HomeCmp } from './home/home.cmp';
import { SigninCmp } from './signin/signin.cmp';
import { SignupCmp } from './signup/signup.cmp';
import { CreateTenantCmp } from './create-tenant/create-tenant.cmp';
import { InvitationAcceptCmp } from './invitation-accept/invitation-accept.cmp';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeCmp },
  { path: 'signup', component: SignupCmp },
  { path: 'signin', component: SigninCmp },
  { path: 'create-tenant', component: CreateTenantCmp },
  { 
    path: '',
    loadComponent: () => import('./main-layout/main-layout.cmp').then(m => m.MainLayoutCmp),
    canActivate: [authGuard],
    children: [
      { 
        path: 'main-page',
        loadComponent: () => import('./main-page/main-page.cmp').then(m => m.MainPageCmp),
      },
      {
        path: 'task-board', 
        loadComponent: () => import('./task-board/task-board.cmp').then(m => m.TaskBoardCmp) 
      },
      { 
        path: 'personal-setting', 
        loadComponent: () => import('./personal-setting/personal-setting.cmp').then(m => m.PersonalSettingCmp) 
      },
      { 
        path: 'setting-tenant', 
        loadComponent: () => import('./setting-tenant/setting-tenant.cmp').then(m => m.SettingTenantCmp), 
        canActivate: [adminGuard] 
      },
      { 
        path: 'employees-management', 
        loadComponent: () => import('./employees-management/employees-management.cmp').then(m => m.EmployeesManagementCmp), 
        canActivate: [adminGuard] 
      },
      { 
        path: 'invitations-management', 
        loadComponent: () => import('./invitations-management/invitations-management.cmp').then(m => m.InvitationsManagementCmp), 
        canActivate: [adminGuard] 
      },
    ]
  },
  { path: 'invitation', component: InvitationAcceptCmp },
];
