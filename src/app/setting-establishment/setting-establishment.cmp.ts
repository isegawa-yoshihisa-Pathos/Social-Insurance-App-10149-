import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { HelpContentCmp } from '../help-content/help-content.cmp';
import { EstablishmentsDataService } from '../establishments-data.service';
import { CurrentEstablishmentService } from '../current-establishment.service';
import { RoutesService } from '../routes.service';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import {
  createEmptyEstablishmentForm,
  establishmentDocToForm,
  establishmentFormToSavePayload,
  parsePhoneNumberRaw,
  EstablishmentFormData,
} from '../establishment-form-data';

@Component({
  selector: 'app-setting-establishment',
  imports: [
    MatTabsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    HelpContentCmp,
  ],
  templateUrl: './setting-establishment.cmp.html',
  styleUrl: './setting-establishment.cmp.css',
})
export class SettingEstablishmentCmp implements OnInit {
  private readonly establishmentsDataService = inject(EstablishmentsDataService);
  private readonly currentEstablishmentService = inject(CurrentEstablishmentService);
  private readonly routesService = inject(RoutesService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(Auth);

  eid = '';
  loading = true;
  submitBusy = false;

  form: EstablishmentFormData = createEmptyEstablishmentForm();

  async ngOnInit(): Promise<void> {
    const eid =
      this.route.snapshot.queryParams['eid'] ||
      this.currentEstablishmentService.getEstablishment();

    if (!eid) {
      this.routesService.redirectToHome();
      return;
    }
    this.eid = eid;

    try {
      this.loading = true;
      const doc = await this.establishmentsDataService.loadEstablishment(eid);
      if (!doc) {
        this.dialog.open(ErrorDialogCmp, {
          data: { message: '事業所データが見つかりませんでした' },
        });
        return;
      }
      this.form = establishmentDocToForm(doc);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  getAddress(zipcode: string): void {
    this.establishmentsDataService.getAddress(zipcode).then((address) => {
      this.form = {
        ...this.form,
        address: { ...this.form.address, address1: address },
      };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    });
  }

  async save(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      this.routesService.redirectToSignin();
      return;
    }

    this.form.phoneNumber = parsePhoneNumberRaw(this.form.phoneNumberRaw);
    const payload = establishmentFormToSavePayload(this.form);

    try {
      this.submitBusy = true;
      await this.establishmentsDataService.saveEstablishment(this.eid, uid, payload);
      await this.currentEstablishmentService.fetchAffiliations(uid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.submitBusy = false;
    }
  }
}