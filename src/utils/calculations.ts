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
  acv: number;                      // Actual Cash Value of vehicle
  termMonths: number;               // Lease term in months
  docFee: number;                   // Documentation fee
  state: SupportedState;            // State for tax calculation
  paymentFrequency: PaymentFrequency; // Customer payment frequency
  downPayment?: number;             // Optional down payment
}

export interface DealCalculation {
  // Input values
  acv: number;
  termMonths: number;
  docFee: number;
  state: SupportedState;
  paymentFrequency: PaymentFrequency;
  paymentFrequencyLabel: string;
  downPayment: number;              // Total customer cash at signing (includes doc fee + tax)

  // Core calculations
  residualValue: number;
  totalOfPayments: number;
  numberOfPayments: number;
  basePayment: number;

  // Reverse-calculated values
  agreedPrice: number;
  depreciation: number;
  rentCharge: number;
  markup: number;

  // Investor/spread calculations
  investorPayment: number;
  spread: number;
  monthlySpreadEquivalent: number;

  // Tax calculations
  taxRate: number;
  salesTax: number;
  taxPerPayment: number;

  // Final payment values
  totalPayment: number;
  amountDueAtSigning: number;       // = downPayment (total customer cash at signing)

  // Down payment breakdown
  capCostReduction: number;         // downPayment - docFee - salesTax (reduces agreed price)

  // Cap cost reduction split (75/25 applied to capCostReduction only)
  downPaymentDealerShare: number;
  downPaymentCarWorldShare: number;

  // Monthly equivalents for validation display
  basePaymentMonthlyEquivalent: number;

  // ACV Recovery (for lender metrics)
  acvRecovery: number;
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
 * Calculate amortized loan payment using standard formula:
 * P * [r(1+r)^n] / [(1+r)^n - 1]
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
 * Reverse-calculate the adjusted capitalized cost from base payment.
 */
export function reverseCalculateAdjustedCap(
  basePayment: number,
  residualValue: number,
  termMonths: number,
  numberOfPayments: number,
  moneyFactor: number = MONEY_FACTOR
): number {
  const totalBasePayments = basePayment * numberOfPayments;
  const mfTerm = moneyFactor * termMonths;
  const numerator = totalBasePayments - residualValue * (mfTerm - 1);
  const denominator = 1 + mfTerm;

  return numerator / denominator;
}

/**
 * Calculate depreciation portion of lease payment
 */
export function calculateDepreciation(
  adjustedCap: number,
  residualValue: number
): number {
  return adjustedCap - residualValue;
}

/**
 * Calculate rent charge (finance charge) portion of lease
 */
export function calculateRentCharge(
  adjustedCap: number,
  residualValue: number,
  termMonths: number,
  moneyFactor: number = MONEY_FACTOR
): number {
  return (adjustedCap + residualValue) * moneyFactor * termMonths;
}

/**
 * Round to 2 decimal places for currency
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate number of payments based on term and frequency
 */
export function calculateNumberOfPayments(termMonths: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = getPaymentsPerYear(frequency);
  return Math.round(termMonths * (paymentsPerYear / 12));
}

/**
 * Calculate markup (agreed price - ACV)
 */
export function calculateMarkup(agreedPrice: number, acv: number): number {
  return roundCurrency(agreedPrice - acv);
}

/**
 * Calculate down payment split between dealer and Car World
 */
export function calculateDownPaymentSplit(downPayment: number): DownPaymentSplit {
  return {
    dealer: roundCurrency(downPayment * DOWN_PAYMENT_DEALER_PERCENT),
    carWorld: roundCurrency(downPayment * DOWN_PAYMENT_CARWORLD_PERCENT),
  };
}

// ============================================================================
// Optimal Term Calculation
// ============================================================================

/**
 * Calculate the optimal term (1-48 months) that produces closest to $175 spread
 * while satisfying all constraints.
 *
 * Constraints:
 * - Spread >= $150 (monthly equivalent)
 * - Markup <= $5,000
 * - Base Payment >= $300 (monthly equivalent)
 */
export function calculateOptimalTerm(
  acv: number,
  _docFee: number,
  _state: SupportedState,
  paymentFrequency: PaymentFrequency = 'monthly'
): OptimalTermResult {
  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);
  const residualValue = acv * RESIDUAL_PERCENT;
  const totalOfPayments = acv * 2;

  let bestTerm = 36; // Default
  let bestSpreadDiff = Infinity;
  let minValidTerm = MAX_TERM_MONTHS;
  let maxValidTerm = MIN_TERM_MONTHS;
  let bestIsValid = false;

  // Try each term from 1 to 48
  for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
    const numberOfPayments = calculateNumberOfPayments(term, paymentFrequency);
    const basePayment = totalOfPayments / numberOfPayments;
    const basePaymentMonthlyEquiv = toMonthlyEquivalent(basePayment, paymentFrequency);

    const agreedPrice = reverseCalculateAdjustedCap(
      basePayment,
      residualValue,
      term,
      numberOfPayments
    );

    const markup = agreedPrice - acv;

    const investorPayment = calculateAmortizedPayment(
      acv,
      INVESTOR_RATE,
      numberOfPayments,
      paymentsPerYear
    );

    const spread = basePayment - investorPayment;
    const monthlySpread = toMonthlyEquivalent(spread, paymentFrequency);

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

    // Try to find something workable
    for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
      const numberOfPayments = calculateNumberOfPayments(term, paymentFrequency);
      const basePayment = totalOfPayments / numberOfPayments;
      // agreedPrice calculated for completeness in fallback loop
      reverseCalculateAdjustedCap(
        basePayment,
        residualValue,
        term,
        numberOfPayments
      );
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

  // Calculate values for the best term
  const numberOfPayments = calculateNumberOfPayments(bestTerm, paymentFrequency);
  const basePayment = totalOfPayments / numberOfPayments;
  const agreedPrice = reverseCalculateAdjustedCap(
    basePayment,
    residualValue,
    bestTerm,
    numberOfPayments
  );
  const markup = agreedPrice - acv;
  const investorPayment = calculateAmortizedPayment(
    acv,
    INVESTOR_RATE,
    numberOfPayments,
    paymentsPerYear
  );
  const spread = basePayment - investorPayment;
  const monthlySpread = toMonthlyEquivalent(spread, paymentFrequency);

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
  paymentFrequency: PaymentFrequency = 'monthly'
): { min: number; max: number } | null {
  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);
  const residualValue = acv * RESIDUAL_PERCENT;
  const totalOfPayments = acv * 2;

  let minValid: number | null = null;
  let maxValid: number | null = null;

  for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
    const numberOfPayments = calculateNumberOfPayments(term, paymentFrequency);
    const basePayment = totalOfPayments / numberOfPayments;
    const basePaymentMonthlyEquiv = toMonthlyEquivalent(basePayment, paymentFrequency);

    const agreedPrice = reverseCalculateAdjustedCap(
      basePayment,
      residualValue,
      term,
      numberOfPayments
    );
    const markup = agreedPrice - acv;

    const investorPayment = calculateAmortizedPayment(
      acv,
      INVESTOR_RATE,
      numberOfPayments,
      paymentsPerYear
    );
    const spread = basePayment - investorPayment;
    const monthlySpread = toMonthlyEquivalent(spread, paymentFrequency);

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
 * Key formula: Total of Payments = (ACV × 2) - Cap Cost Reduction
 * Cap Cost Reduction = Full Down Payment (reduces customer's payment obligation)
 * Agreed Price increases to maintain target spread when down payment is applied.
 */
export function calculateDeal(input: DealInput): DealCalculation {
  const { acv, termMonths, docFee, state, paymentFrequency, downPayment = 0 } = input;
  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);

  // Step 1: Calculate residual value (15% of ACV)
  const residualValue = roundCurrency(acv * RESIDUAL_PERCENT);

  // Step 2: Cap Cost Reduction = Full Down Payment
  const capCostReduction = roundCurrency(downPayment);

  // Step 3: Total of payments = (ACV × 2) - Cap Cost Reduction
  // Down payment reduces the total amount customer pays through payments
  const grossTotalOfPayments = roundCurrency(acv * 2);
  const totalOfPayments = roundCurrency(grossTotalOfPayments - capCostReduction);

  // Step 4: Number of payments based on term and frequency
  const numberOfPayments = calculateNumberOfPayments(termMonths, paymentFrequency);

  // Step 5: Base payment = adjusted total / number of payments
  const basePayment = roundCurrency(totalOfPayments / numberOfPayments);

  // Step 6: Reverse-calculate agreed price from base payment
  // Agreed price will be higher when down payment is applied to maintain spread
  const agreedPrice = roundCurrency(
    reverseCalculateAdjustedCap(basePayment, residualValue, termMonths, numberOfPayments)
  );

  // Calculate markup
  const markup = calculateMarkup(agreedPrice, acv);

  // Calculate depreciation and rent charge for transparency
  const depreciation = roundCurrency(calculateDepreciation(agreedPrice, residualValue));
  const rentCharge = roundCurrency(
    calculateRentCharge(agreedPrice, residualValue, termMonths)
  );

  // Step 7: Calculate investor payment (amortized at same frequency)
  const investorPayment = roundCurrency(
    calculateAmortizedPayment(acv, INVESTOR_RATE, numberOfPayments, paymentsPerYear)
  );

  // Step 8: Calculate spread (profit margin per payment)
  const spread = roundCurrency(basePayment - investorPayment);

  // Monthly equivalent spread for validation
  const monthlySpreadEquivalent = roundCurrency(toMonthlyEquivalent(spread, paymentFrequency));

  // Step 9: Calculate sales tax on payments
  const taxRate = TAX_RATES[state] ?? 0;
  const taxPerPayment = roundCurrency(basePayment * taxRate);
  const salesTax = roundCurrency(taxPerPayment * numberOfPayments); // Total tax across all payments

  // Step 10: Total payment = base payment + tax per payment
  const totalPayment = roundCurrency(basePayment + taxPerPayment);

  // Step 11: Amount due at signing = down payment (customer's total cash)
  const amountDueAtSigning = roundCurrency(downPayment);

  // Monthly equivalent for validation display
  const basePaymentMonthlyEquivalent = roundCurrency(toMonthlyEquivalent(basePayment, paymentFrequency));

  // Down payment split (75/25 applied to cap cost reduction)
  const downPaymentSplit = calculateDownPaymentSplit(capCostReduction);

  // ACV Recovery (50% of gross total payments, before cap cost reduction)
  const acvRecovery = roundCurrency(grossTotalOfPayments * 0.5);

  return {
    // Input values
    acv,
    termMonths,
    docFee,
    state,
    paymentFrequency,
    paymentFrequencyLabel: PAYMENT_FREQUENCIES[paymentFrequency].label,
    downPayment,

    // Core calculations
    residualValue,
    totalOfPayments,
    numberOfPayments,
    basePayment,

    // Reverse-calculated values
    agreedPrice,
    depreciation,
    rentCharge,
    markup,

    // Investor/spread calculations
    investorPayment,
    spread,
    monthlySpreadEquivalent,

    // Tax calculations
    taxRate,
    salesTax,
    taxPerPayment,

    // Final payment values
    totalPayment,
    amountDueAtSigning,

    // Down payment breakdown
    capCostReduction,

    // Cap cost reduction split (75/25)
    downPaymentDealerShare: downPaymentSplit.dealer,
    downPaymentCarWorldShare: downPaymentSplit.carWorld,

    // Monthly equivalents
    basePaymentMonthlyEquivalent,

    // ACV Recovery
    acvRecovery,
  };
}

// ============================================================================
// Validation Function
// ============================================================================

/**
 * Find the maximum term that keeps monthly-equivalent payment at or above minimum.
 */
export function findMaxTermForMinPayment(acv: number, frequency: PaymentFrequency): number | undefined {
  const totalOfPayments = acv * 2;
  const paymentsPerYear = getPaymentsPerYear(frequency);
  const minPaymentAtFrequency = (MIN_MONTHLY_PAYMENT_EQUIVALENT * 12) / paymentsPerYear;
  const maxTerm = Math.floor((totalOfPayments * 12) / (minPaymentAtFrequency * paymentsPerYear));

  const validTerms = [12, 24, 36, 48, 60, 72];
  const validMaxTerm = validTerms.filter(t => t <= maxTerm).pop();

  return validMaxTerm;
}

/**
 * Find the minimum term that achieves the minimum monthly-equivalent spread.
 */
export function findMinTermForMinSpread(acv: number, frequency: PaymentFrequency): number | undefined {
  const validTerms = [12, 24, 36, 48, 60, 72];
  const paymentsPerYear = getPaymentsPerYear(frequency);

  for (const term of validTerms) {
    const totalOfPayments = acv * 2;
    const numberOfPayments = calculateNumberOfPayments(term, frequency);
    const basePayment = totalOfPayments / numberOfPayments;
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
export function findTermForMaxMarkup(acv: number, frequency: PaymentFrequency): number | undefined {
  const residualValue = acv * RESIDUAL_PERCENT;
  const totalOfPayments = acv * 2;

  // Start from short term (higher markup) and go longer until markup is within limit
  for (let term = MIN_TERM_MONTHS; term <= MAX_TERM_MONTHS; term++) {
    const numberOfPayments = calculateNumberOfPayments(term, frequency);
    const basePayment = totalOfPayments / numberOfPayments;
    const agreedPrice = reverseCalculateAdjustedCap(basePayment, residualValue, term, numberOfPayments);
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
    const maxTerm = findMaxTermForMinPayment(calculation.acv, calculation.paymentFrequency);
    errors.push({
      field: 'basePayment',
      message: `Base payment $${calculation.basePaymentMonthlyEquivalent.toFixed(2)} is below $${MIN_BASE_PAYMENT} minimum`,
      suggestedValue: maxTerm,
    });
  }

  // Check minimum spread requirement (based on monthly equivalent)
  if (calculation.monthlySpreadEquivalent < MIN_SPREAD) {
    const minTerm = findMinTermForMinSpread(calculation.acv, calculation.paymentFrequency);
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
  const validRange = findValidTermRange(calculation.acv, calculation.paymentFrequency);

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
