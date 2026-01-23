// Lease Calculation Constants

// Money factor converts to APR: MF * 2400 = APR
// 0.009996 * 2400 = 23.99% APR
export const MONEY_FACTOR = 0.009996;

// Residual value as percentage of ACV
export const RESIDUAL_PERCENT = 0.15;

// Prime rate (base rate)
export const PRIME_RATE = 0.075;

// Investor rate: Prime + 5% = 12.50%
export const INVESTOR_RATE = 0.125;

// Minimum monthly payment allowed
export const MIN_MONTHLY_PAYMENT = 300;

// Minimum spread (profit margin) required
export const MIN_SPREAD = 150;

// State tax rates
export const TAX_RATES: Record<string, number> = {
  TN: 0.095,  // Tennessee: 9.5%
  MS: 0.05,   // Mississippi: 5%
};

// Supported states
export type SupportedState = keyof typeof TAX_RATES;

// Valid lease terms in months
export const VALID_TERMS = [12, 24, 36, 48, 60, 72] as const;
export type LeaseTerm = typeof VALID_TERMS[number];
