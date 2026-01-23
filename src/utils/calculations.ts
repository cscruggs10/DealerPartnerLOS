import {
  MONEY_FACTOR,
  RESIDUAL_PERCENT,
  INVESTOR_RATE,
  MIN_MONTHLY_PAYMENT_EQUIVALENT,
  MIN_SPREAD,
  TARGET_SPREAD,
  MAX_MARKUP,
  MIN_BASE_PAYMENT,
  DOWN_PAYMENT_DEALER_PERCENT,
  DOWN_PAYMENT_CARWORLD_PERCENT,
  PURCHASE_OPTION_FEE,
  TAX_RATES,
  PAYMENT_FREQUENCIES,
  MAX_TERM_MONTHS,
  MIN_TERM_MONTHS,
  type SupportedState,
  type PaymentFrequency,
} from './constants';

// ============================================================================
// Types
// ============================================================================

export interface DealInput {
  acv: number;                      // Actual Cash Value (lender's cost - internal only)
  termMonths: number;               // Lease term in months
  docFee: number;                   // Documentation fee
  state: SupportedState;            // State for tax calculation
  paymentFrequency: PaymentFrequency; // Customer payment frequency
  downPayment?: number;             // Customer down payment (becomes cap cost reduction)
}

export interface DealCalculation {
  // Input values (internal)
  acv: number;
  termMonths: number;
  docFee: number;
  state: SupportedState;
  paymentFrequency: PaymentFrequency;
  paymentFrequencyLabel: string;
  downPayment: number;

  // Step 2: Agreed Price (reverse-calculated from ACV)
  agreedPrice: number;

  // Step 3: Standard Lease Calculation
  residualValue: number;            // 15% of Agreed Price
  salesTaxOnPrice: number;          // Sales tax on agreed price
  grossCapCost: number;             // Agreed Price + Doc Fee + Sales Tax
  capCostReduction: number;         // = Down Payment
  adjustedCapCost: number;          // Gross Cap Cost - Cap Cost Reduction
  depreciation: number;             // Adjusted Cap Cost - Residual Value
  rentCharge: number;               // (Adjusted Cap + Residual) × MF × Term
  totalOfBasePayments: number;      // Depreciation + Rent Charge
  numberOfPayments: number;
  basePayment: number;              // Total of Base Payments / Number of Payments
  taxPerPayment: number;            // Base Payment × Tax Rate
  totalPayment: number;             // Base Payment + Tax Per Payment

  // Step 4: Investor Payment & Spread (based on ACV)
  investorPayment: number;
  spread: number;
  monthlySpreadEquivalent: number;

  // Step 5: Markup
  markup: number;                   // Agreed Price - ACV

  // Step 6: Amount Due at Signing
  amountDueAtSigning: number;       // Down Payment + First Payment + Doc Fee

  // Step 7: Purchase Option
  purchaseOptionPrice: number;      // Residual + $300

  // Tax info
  taxRate: number;

  // Down payment split (75/25)
  downPaymentDealerShare: number;
  downPaymentCarWorldShare: number;

  // Monthly equivalents for validation
  basePaymentMonthlyEquivalent: number;

  // Legacy fields for compatibility
  totalOfPayments: number;          // Alias for totalOfBasePayments
  salesTax: number;                 // Total sales tax across all payments
}

export interface ValidationError {
  field: string;
  message: string;
  suggestedValue?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validTermRange?: {
    min: number;
    max: number;
  };
}

export interface OptimalTermResult {
  term: number;
  isValid: boolean;
  spread: number;
  markup: number;
  basePayment: number;
  validRange: {
    min: number;
    max: number;
  };
}

export interface DownPaymentSplit {
  dealer: number;
  carWorld: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the number of payments per year for a given frequency
 */
export function getPaymentsPerYear(frequency: PaymentFrequency): number {
  return PAYMENT_FREQUENCIES[frequency].paymentsPerYear;
}

/**
 * Convert a payment amount to its monthly equivalent
 */
export function toMonthlyEquivalent(amount: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = getPaymentsPerYear(frequency);
  return (amount * paymentsPerYear) / 12;
}

/**
 * Convert a monthly amount to the equivalent at a given frequency
 */
export function fromMonthlyEquivalent(monthlyAmount: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = getPaymentsPerYear(frequency);
  return (monthlyAmount * 12) / paymentsPerYear;
}

/**
 * Calculate number of payments based on term and frequency
 */
export function calculateNumberOfPayments(termMonths: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = getPaymentsPerYear(frequency);
  return Math.round(termMonths * (paymentsPerYear / 12));
}

/**
 * Calculate amortized loan payment using standard formula:
 * P × [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateAmortizedPayment(
  principal: number,
  annualRate: number,
  numberOfPayments: number,
  paymentsPerYear: number = 12
): number {
  const periodicRate = annualRate / paymentsPerYear;

  if (periodicRate === 0) {
    return principal / numberOfPayments;
  }

  const compoundFactor = Math.pow(1 + periodicRate, numberOfPayments);
  const payment = principal * (periodicRate * compoundFactor) / (compoundFactor - 1);

  return payment;
}

/**
 * Round to 2 decimal places for currency
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate down payment split between dealer and Car World
 */
export function calculateDownPaymentSplit(capCostReduction: number): DownPaymentSplit {
  return {
    dealer: roundCurrency(capCostReduction * DOWN_PAYMENT_DEALER_PERCENT),
    carWorld: roundCurrency(capCostReduction * DOWN_PAYMENT_CARWORLD_PERCENT),
  };
}

/**
 * Calculate Agreed Price from ACV using the formula that accounts for
 * Residual = 15% of Agreed Price.
 *
 * Derivation:
 * Total = (Agreed - Residual) + (Agreed + Residual) × MF × Term
 * If Residual = 0.15 × Agreed:
 * Total = Agreed × (0.85 + 1.15 × MF × Term)
 * Therefore:
 * Agreed = Total / (0.85 + 1.15 × MF × Term)
 */
export function calculateAgreedPriceFromACV(
  acv: number,
  termMonths: number,
  moneyFactor: number = MONEY_FACTOR
): number {
  const totalOfPaymentsTarget = acv * 2;
  const mfTerm = moneyFactor * termMonths;
  const denominator = (1 - RESIDUAL_PERCENT) + (1 + RESIDUAL_PERCENT) * mfTerm;
  return totalOfPaymentsTarget / denominator;
}

// ============================================================================
// Optimal Term Calculation
// ============================================================================

/**
 * Calculate the optimal term (1-48 months) that produces closest to $175 monthly spread.
 *
 * Given ACV, find term that:
 * 1. Produces ~$175 monthly equivalent spread
 * 2. Satisfies all validation constraints
 * Dealer can adjust term but spread must stay ≥ $150.
 */
export function calculateOptimalTerm(
  acv: number,
  docFee: number,
  state: SupportedState,
  paymentFrequency: PaymentFrequency = 'monthly'
): OptimalTermResult {
  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);
  const taxRate = TAX_RATES[state] ?? 0;

  let bestTerm = 36; // Default
  let bestSpreadDiff = Infinity;
  let minValidTerm = MAX_TERM_MONTHS;
  let maxValidTerm = MIN_TERM_MONTHS;
  let bestIsValid = false;

  // Try each term from 1 to 48
  for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
    // Calculate agreed price from ACV for this term
    const agreedPrice = calculateAgreedPriceFromACV(acv, term);
    const residualValue = agreedPrice * RESIDUAL_PERCENT;

    // Standard lease calculation (simplified - no down payment for optimal term finding)
    const salesTaxOnPrice = agreedPrice * taxRate;
    const grossCapCost = agreedPrice + docFee + salesTaxOnPrice;
    const adjustedCapCost = grossCapCost; // No down payment during optimization
    const depreciation = adjustedCapCost - residualValue;
    const rentCharge = (adjustedCapCost + residualValue) * MONEY_FACTOR * term;
    const totalOfBasePayments = depreciation + rentCharge;

    const numberOfPayments = calculateNumberOfPayments(term, paymentFrequency);
    const basePayment = totalOfBasePayments / numberOfPayments;
    const basePaymentMonthlyEquiv = toMonthlyEquivalent(basePayment, paymentFrequency);

    // Investor payment based on ACV
    const investorPayment = calculateAmortizedPayment(
      acv,
      INVESTOR_RATE,
      numberOfPayments,
      paymentsPerYear
    );

    const spread = basePayment - investorPayment;
    const monthlySpread = toMonthlyEquivalent(spread, paymentFrequency);

    const markup = agreedPrice - acv;

    // Check if this term meets all constraints
    const meetsSpread = monthlySpread >= MIN_SPREAD;
    const meetsMarkup = markup <= MAX_MARKUP;
    const meetsPayment = basePaymentMonthlyEquiv >= MIN_BASE_PAYMENT;
    const isValid = meetsSpread && meetsMarkup && meetsPayment;

    if (isValid) {
      // Track valid term range
      if (term < minValidTerm) minValidTerm = term;
      if (term > maxValidTerm) maxValidTerm = term;

      // Find term closest to target spread
      const spreadDiff = Math.abs(monthlySpread - TARGET_SPREAD);
      if (spreadDiff < bestSpreadDiff) {
        bestSpreadDiff = spreadDiff;
        bestTerm = term;
        bestIsValid = true;
      }
    }
  }

  // If no valid term found, find the best invalid one
  if (!bestIsValid) {
    minValidTerm = 0;
    maxValidTerm = 0;

    for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
      const agreedPrice = calculateAgreedPriceFromACV(acv, term);
      const residualValue = agreedPrice * RESIDUAL_PERCENT;
      const salesTaxOnPrice = agreedPrice * taxRate;
      const grossCapCost = agreedPrice + docFee + salesTaxOnPrice;
      const depreciation = grossCapCost - residualValue;
      const rentCharge = (grossCapCost + residualValue) * MONEY_FACTOR * term;
      const totalOfBasePayments = depreciation + rentCharge;
      const numberOfPayments = calculateNumberOfPayments(term, paymentFrequency);
      const basePayment = totalOfBasePayments / numberOfPayments;
      const investorPayment = calculateAmortizedPayment(
        acv,
        INVESTOR_RATE,
        numberOfPayments,
        paymentsPerYear
      );
      const spread = basePayment - investorPayment;
      const monthlySpread = toMonthlyEquivalent(spread, paymentFrequency);

      const spreadDiff = Math.abs(monthlySpread - TARGET_SPREAD);
      if (spreadDiff < bestSpreadDiff) {
        bestSpreadDiff = spreadDiff;
        bestTerm = term;
      }
    }
  }

  // Calculate final values for the best term
  const agreedPrice = calculateAgreedPriceFromACV(acv, bestTerm);
  const residualValue = agreedPrice * RESIDUAL_PERCENT;
  const salesTaxOnPrice = agreedPrice * taxRate;
  const grossCapCost = agreedPrice + docFee + salesTaxOnPrice;
  const depreciation = grossCapCost - residualValue;
  const rentCharge = (grossCapCost + residualValue) * MONEY_FACTOR * bestTerm;
  const totalOfBasePayments = depreciation + rentCharge;
  const numberOfPayments = calculateNumberOfPayments(bestTerm, paymentFrequency);
  const basePayment = totalOfBasePayments / numberOfPayments;
  const investorPayment = calculateAmortizedPayment(
    acv,
    INVESTOR_RATE,
    numberOfPayments,
    paymentsPerYear
  );
  const spread = basePayment - investorPayment;
  const monthlySpread = toMonthlyEquivalent(spread, paymentFrequency);
  const markup = agreedPrice - acv;

  return {
    term: bestTerm,
    isValid: bestIsValid,
    spread: roundCurrency(monthlySpread),
    markup: roundCurrency(markup),
    basePayment: roundCurrency(toMonthlyEquivalent(basePayment, paymentFrequency)),
    validRange: {
      min: minValidTerm,
      max: maxValidTerm,
    },
  };
}

/**
 * Find valid term range for a given ACV
 */
export function findValidTermRange(
  acv: number,
  paymentFrequency: PaymentFrequency = 'monthly',
  docFee: number = 499,
  state: SupportedState = 'TN'
): { min: number; max: number } | null {
  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);
  const taxRate = TAX_RATES[state] ?? 0;

  let minValid: number | null = null;
  let maxValid: number | null = null;

  for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
    const agreedPrice = calculateAgreedPriceFromACV(acv, term);
    const residualValue = agreedPrice * RESIDUAL_PERCENT;
    const salesTaxOnPrice = agreedPrice * taxRate;
    const grossCapCost = agreedPrice + docFee + salesTaxOnPrice;
    const depreciation = grossCapCost - residualValue;
    const rentCharge = (grossCapCost + residualValue) * MONEY_FACTOR * term;
    const totalOfBasePayments = depreciation + rentCharge;
    const numberOfPayments = calculateNumberOfPayments(term, paymentFrequency);
    const basePayment = totalOfBasePayments / numberOfPayments;
    const basePaymentMonthlyEquiv = toMonthlyEquivalent(basePayment, paymentFrequency);

    const investorPayment = calculateAmortizedPayment(
      acv,
      INVESTOR_RATE,
      numberOfPayments,
      paymentsPerYear
    );
    const spread = basePayment - investorPayment;
    const monthlySpread = toMonthlyEquivalent(spread, paymentFrequency);

    const markup = agreedPrice - acv;

    const isValid =
      monthlySpread >= MIN_SPREAD &&
      markup <= MAX_MARKUP &&
      basePaymentMonthlyEquiv >= MIN_BASE_PAYMENT;

    if (isValid) {
      if (minValid === null) minValid = term;
      maxValid = term;
    }
  }

  if (minValid === null || maxValid === null) return null;
  return { min: minValid, max: maxValid };
}

// ============================================================================
// Core Calculation Function
// ============================================================================

/**
 * Calculate all deal values based on ACV, term, and payment frequency.
 *
 * CALCULATION FLOW:
 * 1. Calculate Agreed Price from ACV (reverse calculation)
 * 2. Apply standard lease math using Agreed Price
 * 3. Calculate spread using Investor Payment on ACV
 */
export function calculateDeal(input: DealInput): DealCalculation {
  const { acv, termMonths, docFee, state, paymentFrequency, downPayment = 0 } = input;
  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);
  const taxRate = TAX_RATES[state] ?? 0;

  // =========================================================================
  // STEP 2: Calculate Agreed Price from ACV
  // =========================================================================
  // Formula: agreedPrice = (ACV × 2) / (0.85 + 1.15 × MF × Term)
  // This ensures Total of Payments ≈ ACV × 2 while Residual = 15% of Agreed Price
  const agreedPrice = roundCurrency(calculateAgreedPriceFromACV(acv, termMonths));

  // =========================================================================
  // STEP 3: Standard Lease Calculation
  // =========================================================================

  // Residual Value = 15% of Agreed Price
  const residualValue = roundCurrency(agreedPrice * RESIDUAL_PERCENT);

  // Sales tax on agreed price
  const salesTaxOnPrice = roundCurrency(agreedPrice * taxRate);

  // Gross Capitalized Cost = Agreed Price + Doc Fee + Sales Tax
  const grossCapCost = roundCurrency(agreedPrice + docFee + salesTaxOnPrice);

  // Cap Cost Reduction = Full Down Payment
  const capCostReduction = roundCurrency(downPayment);

  // Adjusted Capitalized Cost = Gross Cap Cost - Cap Cost Reduction
  const adjustedCapCost = roundCurrency(grossCapCost - capCostReduction);

  // Depreciation = Adjusted Cap Cost - Residual Value
  const depreciation = roundCurrency(adjustedCapCost - residualValue);

  // Rent Charge = (Adjusted Cap Cost + Residual Value) × Money Factor × Term
  const rentCharge = roundCurrency(
    (adjustedCapCost + residualValue) * MONEY_FACTOR * termMonths
  );

  // Total of Base Payments = Depreciation + Rent Charge
  const totalOfBasePayments = roundCurrency(depreciation + rentCharge);

  // Number of payments based on term and frequency
  const numberOfPayments = calculateNumberOfPayments(termMonths, paymentFrequency);

  // Base Payment = Total of Base Payments / Number of Payments
  const basePayment = roundCurrency(totalOfBasePayments / numberOfPayments);

  // Tax per payment
  const taxPerPayment = roundCurrency(basePayment * taxRate);

  // Total Payment = Base Payment + Tax
  const totalPayment = roundCurrency(basePayment + taxPerPayment);

  // =========================================================================
  // STEP 4: Calculate Investor Payment & Spread (based on ACV)
  // =========================================================================

  // Investor Payment = Amortized payment on ACV at 12.5% annual rate
  const investorPayment = roundCurrency(
    calculateAmortizedPayment(acv, INVESTOR_RATE, numberOfPayments, paymentsPerYear)
  );

  // Spread = Base Payment - Investor Payment
  const spread = roundCurrency(basePayment - investorPayment);

  // Monthly equivalent spread for validation
  const monthlySpreadEquivalent = roundCurrency(toMonthlyEquivalent(spread, paymentFrequency));

  // =========================================================================
  // STEP 5: Calculate Markup
  // =========================================================================

  const markup = roundCurrency(agreedPrice - acv);

  // =========================================================================
  // STEP 6: Calculate Amount Due at Signing
  // =========================================================================

  // Amount Due = Down Payment + First Payment + Doc Fee
  const amountDueAtSigning = roundCurrency(downPayment + totalPayment + docFee);

  // =========================================================================
  // STEP 7: Purchase Option Price
  // =========================================================================

  const purchaseOptionPrice = roundCurrency(residualValue + PURCHASE_OPTION_FEE);

  // =========================================================================
  // Additional Calculations
  // =========================================================================

  // Monthly equivalent for validation display
  const basePaymentMonthlyEquivalent = roundCurrency(toMonthlyEquivalent(basePayment, paymentFrequency));

  // Down payment split (75/25)
  const downPaymentSplit = calculateDownPaymentSplit(capCostReduction);

  return {
    // Input values
    acv,
    termMonths,
    docFee,
    state,
    paymentFrequency,
    paymentFrequencyLabel: PAYMENT_FREQUENCIES[paymentFrequency].label,
    downPayment,

    // Agreed Price (from ACV)
    agreedPrice,

    // Standard Lease Calculation
    residualValue,
    salesTaxOnPrice,
    grossCapCost,
    capCostReduction,
    adjustedCapCost,
    depreciation,
    rentCharge,
    totalOfBasePayments,
    numberOfPayments,
    basePayment,
    taxPerPayment,
    totalPayment,

    // Investor/Spread (based on ACV)
    investorPayment,
    spread,
    monthlySpreadEquivalent,

    // Markup
    markup,

    // Amount Due at Signing
    amountDueAtSigning,

    // Purchase Option
    purchaseOptionPrice,

    // Tax info
    taxRate,

    // Down payment split
    downPaymentDealerShare: downPaymentSplit.dealer,
    downPaymentCarWorldShare: downPaymentSplit.carWorld,

    // Monthly equivalents
    basePaymentMonthlyEquivalent,

    // Legacy compatibility
    totalOfPayments: totalOfBasePayments,
    salesTax: roundCurrency(taxPerPayment * numberOfPayments),
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Find the maximum term that keeps monthly-equivalent payment at or above minimum.
 */
export function findMaxTermForMinPayment(
  acv: number,
  frequency: PaymentFrequency,
  docFee: number = 499,
  state: SupportedState = 'TN'
): number | undefined {
  const taxRate = TAX_RATES[state] ?? 0;
  const validTerms = [12, 24, 36, 48];

  let maxValidTerm: number | undefined = undefined;
  for (const term of validTerms) {
    const agreedPrice = calculateAgreedPriceFromACV(acv, term);
    const residualValue = agreedPrice * RESIDUAL_PERCENT;
    const salesTaxOnPrice = agreedPrice * taxRate;
    const grossCapCost = agreedPrice + docFee + salesTaxOnPrice;
    const depreciation = grossCapCost - residualValue;
    const rentCharge = (grossCapCost + residualValue) * MONEY_FACTOR * term;
    const totalOfBasePayments = depreciation + rentCharge;
    const numberOfPayments = calculateNumberOfPayments(term, frequency);
    const basePayment = totalOfBasePayments / numberOfPayments;
    const monthlyEquiv = toMonthlyEquivalent(basePayment, frequency);

    if (monthlyEquiv >= MIN_MONTHLY_PAYMENT_EQUIVALENT) {
      maxValidTerm = term;
    }
  }

  return maxValidTerm;
}

/**
 * Find the minimum term that achieves the minimum monthly-equivalent spread.
 */
export function findMinTermForMinSpread(
  acv: number,
  frequency: PaymentFrequency,
  docFee: number = 499,
  state: SupportedState = 'TN'
): number | undefined {
  const paymentsPerYear = getPaymentsPerYear(frequency);
  const taxRate = TAX_RATES[state] ?? 0;
  const validTerms = [12, 24, 36, 48];

  for (const term of validTerms) {
    const agreedPrice = calculateAgreedPriceFromACV(acv, term);
    const residualValue = agreedPrice * RESIDUAL_PERCENT;
    const salesTaxOnPrice = agreedPrice * taxRate;
    const grossCapCost = agreedPrice + docFee + salesTaxOnPrice;
    const depreciation = grossCapCost - residualValue;
    const rentCharge = (grossCapCost + residualValue) * MONEY_FACTOR * term;
    const totalOfBasePayments = depreciation + rentCharge;
    const numberOfPayments = calculateNumberOfPayments(term, frequency);
    const basePayment = totalOfBasePayments / numberOfPayments;
    const investorPayment = calculateAmortizedPayment(acv, INVESTOR_RATE, numberOfPayments, paymentsPerYear);
    const spread = basePayment - investorPayment;
    const monthlySpread = toMonthlyEquivalent(spread, frequency);

    if (monthlySpread >= MIN_SPREAD) {
      return term;
    }
  }

  return undefined;
}

/**
 * Find term that brings markup within limit
 */
export function findTermForMaxMarkup(acv: number, _frequency: PaymentFrequency): number | undefined {
  // Find shortest term where markup <= MAX_MARKUP
  for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
    const agreedPrice = calculateAgreedPriceFromACV(acv, term);
    const markup = agreedPrice - acv;

    if (markup <= MAX_MARKUP) {
      return term;
    }
  }

  return undefined;
}

/**
 * Validate a deal calculation and return any errors.
 */
export function validateDeal(calculation: DealCalculation): ValidationResult {
  const errors: ValidationError[] = [];

  // Check minimum payment requirement (based on monthly equivalent)
  if (calculation.basePaymentMonthlyEquivalent < MIN_MONTHLY_PAYMENT_EQUIVALENT) {
    const maxTerm = findMaxTermForMinPayment(
      calculation.acv,
      calculation.paymentFrequency,
      calculation.docFee,
      calculation.state
    );
    errors.push({
      field: 'basePayment',
      message: `Base payment $${calculation.basePaymentMonthlyEquivalent.toFixed(2)} is below $${MIN_BASE_PAYMENT} minimum`,
      suggestedValue: maxTerm,
    });
  }

  // Check minimum spread requirement (based on monthly equivalent)
  if (calculation.monthlySpreadEquivalent < MIN_SPREAD) {
    const minTerm = findMinTermForMinSpread(
      calculation.acv,
      calculation.paymentFrequency,
      calculation.docFee,
      calculation.state
    );
    errors.push({
      field: 'spread',
      message: `Spread $${calculation.monthlySpreadEquivalent.toFixed(2)} is below $${MIN_SPREAD} minimum`,
      suggestedValue: minTerm,
    });
  }

  // Check maximum markup
  if (calculation.markup > MAX_MARKUP) {
    const suggestedTerm = findTermForMaxMarkup(calculation.acv, calculation.paymentFrequency);
    errors.push({
      field: 'markup',
      message: `Markup $${calculation.markup.toFixed(2)} exceeds $${MAX_MARKUP.toLocaleString()} maximum`,
      suggestedValue: suggestedTerm,
    });
  }

  // Check for negative values
  if (calculation.agreedPrice <= 0) {
    errors.push({
      field: 'agreedPrice',
      message: 'Agreed price calculation resulted in invalid value',
    });
  }

  if (calculation.residualValue <= 0) {
    errors.push({
      field: 'residualValue',
      message: 'Residual value must be positive',
    });
  }

  // Validate state tax rate exists
  if (calculation.taxRate === 0 && !TAX_RATES[calculation.state]) {
    errors.push({
      field: 'state',
      message: `Unknown state "${calculation.state}" - no tax rate configured`,
    });
  }

  // Get valid term range
  const validRange = findValidTermRange(
    calculation.acv,
    calculation.paymentFrequency,
    calculation.docFee,
    calculation.state
  );

  return {
    isValid: errors.length === 0,
    errors,
    validTermRange: validRange ?? undefined,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the APR equivalent from a money factor.
 * APR = Money Factor * 2400
 */
export function moneyFactorToAPR(mf: number): number {
  return mf * 2400;
}

/**
 * Calculate the money factor from an APR.
 * Money Factor = APR / 2400
 */
export function aprToMoneyFactor(apr: number): number {
  return apr / 2400;
}

/**
 * Format a number as currency string.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format a number as percentage string.
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
