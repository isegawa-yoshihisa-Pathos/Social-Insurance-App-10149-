import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [MatButtonModule, MatInputModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './signin.cmp.html',
  styleUrl: './signin.cmp.css',
})
export class SigninCmp {

}
