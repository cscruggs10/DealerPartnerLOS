// Lease Calculation Constants
// ============================================================================
//
// BUSINESS MODEL:
// ACV (Actual Cash Value) is lender's internal cost, used ONLY to:
// 1. Set Total of Payments target = ACV × 2 (ensures 50% recovers lender cost)
// 2. Reverse-calculate Agreed Price using money factor
// 3. Calculate Investor Payment for spread validation
// ACV does NOT appear on customer contract - it's internal only.
//
// Once Agreed Price is derived from ACV, all other calculations use STANDARD LEASE MATH.
// ============================================================================

// Money factor converts to APR: MF * 2400 = APR
// 0.009996 * 2400 = 23.99% APR
export const MONEY_FACTOR = 0.009996;

// Residual value as percentage of AGREED PRICE (not ACV)
export const RESIDUAL_PERCENT = 0.15;

// Prime rate (base rate)
export const PRIME_RATE = 0.075;

// Investor rate: Prime + 5% = 12.50%
export const INVESTOR_RATE = 0.125;

// Payment frequency options
export const PAYMENT_FREQUENCIES = {
  weekly: { label: 'Weekly', paymentsPerYear: 52 },
  biweekly: { label: 'Bi-Weekly', paymentsPerYear: 26 },
  semimonthly: { label: 'Semi-Monthly', paymentsPerYear: 24 },
  monthly: { label: 'Monthly', paymentsPerYear: 12 },
} as const;

export type PaymentFrequency = keyof typeof PAYMENT_FREQUENCIES;

// Spread targets (monthly equivalent)
export const TARGET_SPREAD = 175;  // Auto-calculated term target
export const MIN_SPREAD = 150;     // Minimum acceptable (dealer can adjust down to this)

// Markup limits
export const MAX_MARKUP = 5000;    // Maximum markup (agreed price - ACV)

// Minimum base payment (monthly equivalent)
export const MIN_BASE_PAYMENT = 300;
export const MIN_MONTHLY_PAYMENT_EQUIVALENT = 300;

// Down payment split percentages (applied to cap cost reduction)
export const DOWN_PAYMENT_DEALER_PERCENT = 0.75;   // 75% to dealer
export const DOWN_PAYMENT_CARWORLD_PERCENT = 0.25; // 25% to Car World

// Purchase option fee added to residual
export const PURCHASE_OPTION_FEE = 300;

// State tax rates
export const TAX_RATES: Record<string, number> = {
  TN: 0.0975,  // Tennessee: 9.75%
  MS: 0.05,    // Mississippi: 5%
};

// Supported states
export type SupportedState = keyof typeof TAX_RATES;

// Valid lease terms in months
export const VALID_TERMS = [12, 24, 36, 48, 60, 72] as const;
export type LeaseTerm = typeof VALID_TERMS[number];

// Maximum term for auto-calculation
export const MAX_TERM_MONTHS = 48;
export const MIN_TERM_MONTHS = 1;
