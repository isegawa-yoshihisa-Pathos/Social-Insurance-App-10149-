export {
    premiumFromStandardRemuneration,
    type SplitPremiumResult,
} from './rounding';
  
  export {
    ageAtEndOfMonth,
    calculateMonthlyPremium,
    calculateBonusPremium,
    isCareInsuranceTarget,
    isSpecificInsuranceCollectionEnabled,
    hasCareInsuranceAgeDependent,
    shouldCollectCareInsurance,
    type CareInsuranceCollectionInput,
    type InsuranceRatesInput,
    type PremiumCalculationInput,
    type BonusPremiumCalculationInput,
} from './premium-calculator';

export {
    employeeLeaveRecordsToPeriodInputs,
    isMonthlyPremiumExemptForLeave,
    isBonusPremiumExemptForChildcareLeave,
    isMonthlyPremiumExemptForMaternityLeave,
    isMonthlyPremiumExemptForChildcareLeave,
    type LeavePeriodInput,
} from './leave-premium-exemption';