import type { InsuranceRateSource } from '../../social-insurance/monthly/social-insurance-document';

export function determineRateSource(input: {
    healthInsuranceType: 'association' | 'combination';
    combinationName?: string;
    usedMasterAutoFill: boolean;
    valuesMatchMaster: boolean;
}): InsuranceRateSource {
    if (input.healthInsuranceType === 'association') {
    return input.usedMasterAutoFill && input.valuesMatchMaster
        ? 'association_table'
        : 'manual';
    }
    
    const known = ['kanto-its', 'tjk'].includes(input.combinationName ?? '');
    if (known && input.usedMasterAutoFill && input.valuesMatchMaster) {
    return 'combination_import';
    }
    if (known) return 'combination_manual';
    return 'manual';
}