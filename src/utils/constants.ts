// Car World LOS - Constants
// ============================================================================
//
// NEW BUSINESS MODEL:
// - ACV = Lender's cost (internal only)
// - Agreed Price = ACV + Markup (from tier matrix)
// - Residual = 10% of Agreed Price
// - Total Base Payments = Effective ACV × 2 (always)
// - Money Factor adjusts to hit this target
// - Down Payment → Dealer (tax backed out for cap cost reduction)
// - Payment Reduction → Car World (reduces Effective ACV)
//
// ============================================================================

// Fees
export const DOC_FEE = 695.00;
export const PURCHASE_OPTION_FEE = 300.00;
export const DISPOSITION_FEE = 395.00;

// Residual (Fixed % of AGREED PRICE)
export const RESIDUAL_PERCENT = 0.10;  // 10% of Agreed Price

// Markup Matrix: ACV determines markup
export const MARKUP_MATRIX = [
  { maxACV: 7000, markup: 3000 },
  { maxACV: 10000, markup: 3500 },
  { maxACV: 15000, markup: 4000 },
  { maxACV: 20000, markup: 4500 },
  { maxACV: Infinity, markup: 5000 },
] as const;

// Investor Rate (for spread calculation)
export const INVESTOR_ANNUAL_RATE = 0.125;  // 12.5% (Prime 7.5% + 5%)

// Tax Rates by State
export const TAX_RATES: Record<string, number> = {
  TN: 0.0975,   // Tennessee: 9.75%
  MS: 0.05,     // Mississippi: 5.00%
};
export type SupportedState = keyof typeof TAX_RATES;

// Spread Requirements (monthly equivalent)
export const TARGET_SPREAD = 175.00;  // Auto-term targets this
export const MIN_SPREAD = 150.00;     // Minimum acceptable

// Payment Constraints
export const MIN_PAYMENT = 300.00;  // Monthly equivalent minimum

// Mileage
export const ANNUAL_MILEAGE = 12000;
export const EXCESS_MILEAGE_RATE = 0.25;  // Per mile over limit

// Late Fees
export const LATE_FEE_PERCENT = 0.05;  // 5% of payment
export const LATE_FEE_MIN = 25.00;     // Or $25, whichever is greater

// Term Limits
export const MIN_TERM = 12;
export const MAX_TERM = 48;

// Payment Frequencies
export const PAYMENT_FREQUENCIES = {
  weekly: { label: 'Weekly', paymentsPerYear: 52 },
  biweekly: { label: 'Bi-Weekly', paymentsPerYear: 26 },
  monthly: { label: 'Monthly', paymentsPerYear: 12 },
} as const;

export type PaymentFrequency = keyof typeof PAYMENT_FREQUENCIES;

// Helper function to get markup from matrix
export function getMarkupForACV(acv: number): number {
  for (const tier of MARKUP_MATRIX) {
    if (acv <= tier.maxACV) {
      return tier.markup;
    }
  }
  return MARKUP_MATRIX[MARKUP_MATRIX.length - 1].markup;
}
