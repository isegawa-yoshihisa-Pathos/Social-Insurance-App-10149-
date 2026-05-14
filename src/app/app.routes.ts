import { Routes } from '@angular/router';
import { HomeCmp } from './home/home.cmp';
import { SigninCmp } from './signin/signin.cmp';
import { SignupCmp } from './signup/signup.cmp';
import { CreateEstablishmentCmp } from './create-establishment/create-establishment.cmp';

export const routes: Routes = [
  { path: '', component: HomeCmp },
  { path: 'home', component: HomeCmp },
  { path: 'signup', component: SignupCmp },
  { path: 'signin', component: SigninCmp },
  { path: 'create-establishment', component: CreateEstablishmentCmp },
];
