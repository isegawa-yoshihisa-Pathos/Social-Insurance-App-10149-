import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { HomeCmp } from './home/home.cmp';
import { SigninCmp } from './signin/signin.cmp';
import { SignupCmp } from './signup/signup.cmp';
import { CreateTenantCmp } from './create-tenant/create-tenant.cmp';
import { InvitationAcceptCmp } from './invitation-accept/invitation-accept.cmp';
import { profileCompletionResolver } from './profile-completion-resolver';
import { tenantGuard } from './tenant.guard';
import { rootRedirectGuard } from './root-redirect-guard.guard';

export const routes: Routes = [
  { path: '', 
    pathMatch: 'full',
    canActivate: [rootRedirectGuard],
    children: []
  },
  { path: 'home', component: HomeCmp },
  { path: 'signup', component: SignupCmp },
  { path: 'signin', component: SigninCmp },
  { path: 'create-tenant', component: CreateTenantCmp },
  { 
    path: '',
    loadComponent: () => import('./main-layout/main-layout.cmp').then(m => m.MainLayoutCmp),
    canActivate: [authGuard, tenantGuard],
    resolve: {
      profileCompletion: profileCompletionResolver,
    },
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
        path: 'create-new-tenant',
        loadComponent: () => import('./create-new-tenant/create-new-tenant.cmp').then(m => m.CreateNewTenantCmp),
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
        path: 'tenant-setting', 
        loadComponent: () => import('./tenant-setting/tenant-setting.cmp').then(m => m.TenantSettingCmp), 
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
            children: [
              {
                path: '',
                pathMatch: 'full',
                redirectTo: 'employ',
              },
              {
                path: 'personal',
                loadComponent: () => import('./employees-management/employees-list/employee-detail/employee-personal-detail/employee-personal-detail.cmp').then(m => m.EmployeePersonalDetailCmp),
              },
              {
                path: 'employ',
                loadComponent: () => import('./employees-management/employees-list/employee-detail/employee-employ-detail/employee-employ-detail.cmp').then(m => m.EmployeeEmployDetailCmp),
              },
              {
                path: 'employ/edit',
                loadComponent: () => import('./employees-management/employees-list/employee-detail/employee-employ-detail-edit/employee-employ-detail-edit.cmp').then(m => m.EmployeeEmployDetailEditCmp),
              },
            ]
          },
        ],
      },
      { 
        path: 'invitations-management', 
        loadComponent: () => import('./invitations-management/invitations-management.cmp').then(m => m.InvitationsManagementCmp), 
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./invitations-management/invitations-mail/invitations-mail.cmp').then(m => m.InvitationsMailCmp),
          },
          {
            path: 'setting',
            loadComponent: () => import('./invitations-management/invitation-setting/invitation-setting.cmp').then(m => m.InvitationSettingCmp),
          },
          {
            path: 'detail/:id',
            loadComponent: () => import('./invitations-management/invitations-mail/invitations-list/invitation-detail/invitation-detail.cmp').then(m => m.InvitationDetailCmp),
          },
        ]
      },
      {
        path: 'monthly-management',
        loadComponent: () => import('./monthly-management/monthly-management.cmp').then(m => m.MonthlyManagementCmp),
        canActivate: [adminGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./monthly-management/monthly-list/monthly-list.cmp').then(m => m.MonthlyListCmp),
          },
          {
            path: 'setting',
            loadComponent: () => import('./monthly-management/monthly-setting/monthly-setting.cmp').then(m => m.MonthlySettingCmp),
          },
        ],
      },
      {
        path: 'virtual-mail-checker',
        loadComponent: () => import('./virtual-mail-checker/virtual-mail-checker.cmp').then(m => m.VirtualMailCheckerCmp),
      },
    ]
  },
  { path: 'invitation', component: InvitationAcceptCmp },
];
