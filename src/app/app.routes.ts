import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { HomeCmp } from './home/home.cmp';
import { SigninCmp } from './signin/signin.cmp';
import { SignupCmp } from './signup/signup.cmp';
import { CreateTenantCmp } from './create-tenant/create-tenant.cmp';
import { InvitationAcceptCmp } from './invitation-accept/invitation-accept.cmp';
import { VirtualMailCheckerCmp } from './virtual-mail-checker/virtual-mail-checker.cmp';

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
        loadComponent: () => import('./personal-setting/personal-setting.cmp').then(m => m.PersonalSettingCmp),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./personal-setting/personal-info/personal-info.cmp').then(m => m.PersonalInfoCmp),
          },
          {
            path: 'edit',
            loadComponent: () => import('./personal-setting/personal-info-edit/personal-info-edit.cmp').then(m => m.PersonalInfoEditCmp),
          },
          {
            path: 'employee',
            loadComponent: () => import('./personal-setting/employee-info/employee-info.cmp').then(m => m.EmployeeInfoCmp),
          },
          {
            path: 'employee/edit',
            loadComponent: () => import('./personal-setting/employee-info-edit/employee-info-edit.cmp').then(m => m.EmployeeInfoEditCmp),
          }
        ]
      },
      { 
        path: 'setting-tenant', 
        loadComponent: () => import('./setting-tenant/setting-tenant.cmp').then(m => m.SettingTenantCmp), 
        canActivate: [adminGuard] 
      },
      { 
        path: 'employees-management', 
        loadComponent: () => import('./employees-management/employees-management.cmp').then(m => m.EmployeesManagementCmp), 
        canActivate: [adminGuard],
        children: [
          { 
            path: '', 
            pathMatch: 'full',
            loadComponent: () => import('./employees-management/employees-list/employees-list.cmp').then(m => m.EmployeesListCmp),
          },
          {
            path: 'setting',
            loadComponent: () => import('./employees-management/employees-setting/employees-setting.cmp').then(m => m.EmployeesSettingCmp),
          },
          {
            path: 'detail/:eid',
            loadComponent: () => import('./employees-management/employees-list/employee-detail/employee-detail.cmp').then(m => m.EmployeeDetailCmp),
          },
        ],
      },
      { 
        path: 'invitations-management', 
        loadComponent: () => import('./invitations-management/invitations-management.cmp').then(m => m.InvitationsManagementCmp), 
        canActivate: [adminGuard] 
      },
    ]
  },
  { path: 'invitation', component: InvitationAcceptCmp },
  { path: 'virtual-mail-checker', component: VirtualMailCheckerCmp },
];
