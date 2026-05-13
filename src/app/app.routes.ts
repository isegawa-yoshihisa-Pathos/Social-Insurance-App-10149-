import { Routes } from '@angular/router';
import { SigninCmp } from './signin/signin.cmp';
import { SignupCmp } from './signup/signup.cmp';

export const routes: Routes = [
  { path: '', component: SigninCmp },
  { path: 'signup', component: SignupCmp },
  { path: 'signin', component: SigninCmp },
];
