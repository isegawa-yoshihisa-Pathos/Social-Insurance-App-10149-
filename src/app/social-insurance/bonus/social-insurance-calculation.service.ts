import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, updateDoc } from '@angular/fire/firestore';
import { toFormDate } from '../../date-utils';
import { CalculationSnapshot, BonusDocument, PremiumData } from '../../bonus-document';
import { EmployeeDocument } from '../../employee-document';
import { calculateBonusPremium } from '../premium/premium-calculator';
import { determineStandardBonus } from './standard-bonus-determination';
import { StandardBonusSavePayload, StandardBonusDataService } from './standard-bonus-data.service';
import { InsuranceRateDataService } from './insurance-rate-data.service';
import { StandardBonusDocument } from './social-insurance-document';
import {
  fiscalYearStartYyyyMm,
  isYyyyMmInFiscalYear,
  lastDayOfYyyyMm,
} from './social-insurance-data.util';

export interface CalculationEmployeeBonusResult {
  premiumData: PremiumData;
  calculationSnapshot: Omit<CalculationSnapshot, 'calculatedAt'>;
  standardBonus: StandardBonusSavePayload;
}

export interface CalculationContext {
  employee: EmployeeDocument;
  bonus: BonusDocument;
  birthDate: Date | null;
}

@Injectable({ providedIn: 'root' })
export class SocialInsuranceCalculationService {
  private readonly firestore = inject(Firestore);
  private readonly standardBonusDataService = inject(StandardBonusDataService);
  private readonly insuranceRateDataService = inject(InsuranceRateDataService);

  async calculateAndPersist(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<CalculationEmployeeBonusResult> {
    const ctx = await this.loadContext(tid, eid, yyyyMm);
    const standardBonus = await this.resolveStandardBonus(tid, eid, yyyyMm, ctx);
    await this.standardBonusDataService.save(tid, eid, yyyyMm, standardBonus);

    const rate = await this.insuranceRateDataService.resolveRateForBonus(tid, yyyyMm);
    if (!rate) {
      throw new Error('保険料率が見つかりません');
    }

    const premiumData = calculateBonusPremium({
      yyyyMm,
      birthDate: ctx.birthDate,
      standardBonus: standardBonus.standardBonus,
      rates: rate.rates,
      employeeRate: rate.employeeRate,
      roundingBy: rate.roundingBy,
    });

    const calculationSnapshot: Omit<CalculationSnapshot, 'calculatedAt'> = {
      rateId: rate.rateId,
      effectiveFrom: rate.effectiveFrom,
      rates: {
        health: rate.rates.healthInsuranceRate,
        care: rate.rates.careInsuranceRate,
        pension: rate.rates.pensionInsuranceRate,
      },
      employeeRate: {
        health: rate.employeeRate.healthInsurance,
        care: rate.employeeRate.careInsurance,
        pension: rate.employeeRate.pensionInsurance,
      },
      roundingBy: {
        health: rate.roundingBy.healthInsurance,
        care: rate.roundingBy.careInsurance,
        pension: rate.roundingBy.pensionInsurance,
      },
      standardBonus: standardBonus.standardBonus,
      bonusAmount: standardBonus.bonusAmount,
      rawStandardBonus: standardBonus.rawStandardBonus,
      source: standardBonus.source,
    };

    const bonusRef = doc(
      this.firestore,
      'tenants',
      tid,
      'bonus-records',
      yyyyMm,
      'employees',
      eid,
    );

    await updateDoc(bonusRef, {
      premiumData,
      calculationSnapshot: {
        ...calculationSnapshot,
        calculatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
    return { premiumData, calculationSnapshot, standardBonus };
  }

  private async resolveStandardBonus(
    tid: string,
    eid: string,
    yyyyMm: string,
    ctx: CalculationContext,
  ): Promise<StandardBonusSavePayload> {
    const existing = await this.standardBonusDataService.get(tid, eid, yyyyMm);
    if (existing?.source === 'manual') {
      return this.toSavePayload(existing);
    }

    const bonusAmount = ctx.bonus.bonusData?.total ?? 0;
    if (bonusAmount <= 0) {
      throw new Error(`${yyyyMm} の賞与支給額がありません。`);
    }

    const fiscalYearHealthStandardSum = await this.sumFiscalYearHealthStandard(
      tid,
      eid,
      yyyyMm,
    );
    const determined = determineStandardBonus({
      bonusAmount,
      fiscalYearHealthStandardSum,
    });

    return {
      standardBonus: determined.standardBonus,
      source: 'calculated',
      effectiveFrom: lastDayOfYyyyMm(yyyyMm),
      bonusAmount: determined.bonusAmount,
      rawStandardBonus: determined.rawStandardBonus,
    };
  }

  private async sumFiscalYearHealthStandard(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<number> {
    const fiscalStart = fiscalYearStartYyyyMm(yyyyMm);
    const history = await this.standardBonusDataService.listForEmployee(tid, eid);
    return history
      .filter(
        (item) =>
          item.yyyyMm < yyyyMm &&
          isYyyyMmInFiscalYear(item.yyyyMm, fiscalStart),
      )
      .reduce((sum, item) => sum + item.doc.standardBonus.health, 0);
  }

  private toSavePayload(doc: StandardBonusDocument): StandardBonusSavePayload {
    return {
      standardBonus: doc.standardBonus,
      source: doc.source,
      effectiveFrom: doc.effectiveFrom,
      bonusAmount: doc.bonusAmount,
      rawStandardBonus: doc.rawStandardBonus,
    };
  }

  private async loadContext(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<CalculationContext> {
    const [employeeSnap, bonus] = await Promise.all([
      getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid)),
      this.loadBonusDocument(tid, eid, yyyyMm),
    ]);
    if (!employeeSnap.exists()) {
      throw new Error('従業員が見つかりません。');
    }
    if (!bonus?.bonusData?.total) {
      throw new Error(`${yyyyMm} の賞与データがありません。`);
    }
    const employee = employeeSnap.data() as EmployeeDocument;
    return {
      employee,
      bonus,
      birthDate: toFormDate(employee.employeePersonalInfo?.birthDate),
    };
  }

  private async loadBonusDocument(
    tid: string,
    eid: string,
    yyyyMm: string,
  ): Promise<BonusDocument | null> {
    const snap = await getDoc(
      doc(
        this.firestore,
        'tenants',
        tid,
        'bonus-records',
        yyyyMm,
        'employees',
        eid,
      ),
    );
    if (!snap.exists()) return null;
    return snap.data() as BonusDocument;
  }
}
