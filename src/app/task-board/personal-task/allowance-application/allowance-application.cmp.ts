import { Component, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-allowance-application',
  standalone: true,
  imports: [],
  templateUrl: './allowance-application.cmp.html',
  styleUrl: './allowance-application.cmp.css',
})
export class AllowanceApplicationCmp {
  private firestore = inject(Firestore);
}