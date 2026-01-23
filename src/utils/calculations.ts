import {
  MONEY_FACTOR,
  RESIDUAL_PERCENT,
  INVESTOR_RATE,
  MIN_MONTHLY_PAYMENT_EQUIVALENT,
  MIN_SPREAD,
  TAX_RATES,
  PAYMENT_FREQUENCIES,
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
}

export interface DealCalculation {
  // Input values
  acv: number;
  termMonths: number;
  docFee: number;
  state: SupportedState;
  paymentFrequency: PaymentFrequency;
  paymentFrequencyLabel: string;

  // Core calculations
  residualValue: number;
  totalOfPayments: number;
  numberOfPayments: number;
  basePayment: number;

  // Reverse-calculated values
  agreedPrice: number;
  depreciation: number;
  rentCharge: number;

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
  amountDueAtSigning: number;

  // Monthly equivalents for validation display
  basePaymentMonthlyEquivalent: number;
}

export interface ValidationError {
  field: string;
  message: string;
  suggestedValue?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
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
 *
 * @param principal - Loan amount
 * @param annualRate - Annual interest rate (decimal)
 * @param numberOfPayments - Total number of payments
 * @param paymentsPerYear - Number of payments per year (12 for monthly, 52 for weekly, etc.)
 * @returns Payment amount per period
 */
export function calculateAmortizedPayment(
  principal: number,
  annualRate: number,
  numberOfPayments: number,
  paymentsPerYear: number = 12
): number {
  const periodicRate = annualRate / paymentsPerYear;

  // Handle edge case of 0% interest
  if (periodicRate === 0) {
    return principal / numberOfPayments;
  }

  const compoundFactor = Math.pow(1 + periodicRate, numberOfPayments);
  const payment = principal * (periodicRate * compoundFactor) / (compoundFactor - 1);

  return payment;
}

/**
 * Reverse-calculate the adjusted capitalized cost from base payment.
 *
 * Lease formula: basePayment = (depreciation + rentCharge) / numberOfPayments
 * Where:
 *   depreciation = adjustedCap - residual
 *   rentCharge = (adjustedCap + residual) * MF * termMonths
 *
 * Note: Money factor is always calculated on a monthly basis regardless of payment frequency
 *
 * @param basePayment - The target payment per period
 * @param residualValue - The residual value of the vehicle
 * @param termMonths - Lease term in months
 * @param numberOfPayments - Total number of payments
 * @param moneyFactor - Money factor for lease (monthly basis)
 * @returns The adjusted capitalized cost
 */
export function reverseCalculateAdjustedCap(
  basePayment: number,
  residualValue: number,
  termMonths: number,
  numberOfPayments: number,
  moneyFactor: number = MONEY_FACTOR
): number {
  // Total of base payments
  const totalBasePayments = basePayment * numberOfPayments;

  // Money factor term (always monthly basis)
  const mfTerm = moneyFactor * termMonths;

  // Solving: totalBasePayments = (adjustedCap - residual) + (adjustedCap + residual) * MF * termMonths
  // totalBasePayments = adjustedCap - residual + adjustedCap * mfTerm + residual * mfTerm
  // totalBasePayments = adjustedCap * (1 + mfTerm) + residual * (mfTerm - 1)
  // adjustedCap = (totalBasePayments - residual * (mfTerm - 1)) / (1 + mfTerm)

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

// ============================================================================
// Core Calculation Function
// ============================================================================

/**
 * Calculate all deal values based on ACV, term, and payment frequency.
 *
 * This function implements the Car World lease calculation methodology:
 * 1. Start with ACV and desired term
 * 2. Calculate residual (15% of ACV)
 * 3. Total of payments = ACV * 2 (customer pays 2x the vehicle value)
 * 4. Number of payments based on term and frequency
 * 5. Base payment = total / numberOfPayments
 * 6. Reverse-calculate the agreed price that produces this payment
 * 7. Calculate investor payment and spread
 * 8. Add tax based on state
 *
 * @param input - Deal input parameters
 * @returns Complete deal calculations
 */
export function calculateDeal(input: DealInput): DealCalculation {
  const { acv, termMonths, docFee, state, paymentFrequency } = input;
  const paymentsPerYear = getPaymentsPerYear(paymentFrequency);

  // Step 1: Calculate residual value (15% of ACV)
  const residualValue = roundCurrency(acv * RESIDUAL_PERCENT);

  // Step 2: Total of payments = ACV * 2
  const totalOfPayments = roundCurrency(acv * 2);

  // Step 3: Number of payments based on term and frequency
  const numberOfPayments = calculateNumberOfPayments(termMonths, paymentFrequency);

  // Step 4: Base payment = total / number of payments
  const basePayment = roundCurrency(totalOfPayments / numberOfPayments);

  // Step 5: Reverse-calculate agreed price from base payment
  const agreedPrice = roundCurrency(
    reverseCalculateAdjustedCap(basePayment, residualValue, termMonths, numberOfPayments)
  );

  // Calculate depreciation and rent charge for transparency
  const depreciation = roundCurrency(calculateDepreciation(agreedPrice, residualValue));
  const rentCharge = roundCurrency(
    calculateRentCharge(agreedPrice, residualValue, termMonths)
  );

  // Step 6: Calculate investor payment (amortized at same frequency)
  const investorPayment = roundCurrency(
    calculateAmortizedPayment(acv, INVESTOR_RATE, numberOfPayments, paymentsPerYear)
  );

  // Step 7: Calculate spread (profit margin per payment)
  const spread = roundCurrency(basePayment - investorPayment);

  // Monthly equivalent spread for validation
  const monthlySpreadEquivalent = roundCurrency(toMonthlyEquivalent(spread, paymentFrequency));

  // Step 8: Calculate sales tax based on state
  const taxRate = TAX_RATES[state] ?? 0;
  const salesTax = roundCurrency(agreedPrice * taxRate);
  const taxPerPayment = roundCurrency(salesTax / numberOfPayments);

  // Step 9: Total payment = base payment + tax per payment
  const totalPayment = roundCurrency(basePayment + taxPerPayment);

  // Step 10: Amount due at signing = first payment + doc fee
  const amountDueAtSigning = roundCurrency(totalPayment + docFee);

  // Monthly equivalent for validation display
  const basePaymentMonthlyEquivalent = roundCurrency(toMonthlyEquivalent(basePayment, paymentFrequency));

  return {
    // Input values
    acv,
    termMonths,
    docFee,
    state,
    paymentFrequency,
    paymentFrequencyLabel: PAYMENT_FREQUENCIES[paymentFrequency].label,

    // Core calculations
    residualValue,
    totalOfPayments,
    numberOfPayments,
    basePayment,

    // Reverse-calculated values
    agreedPrice,
    depreciation,
    rentCharge,

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

    // Monthly equivalents
    basePaymentMonthlyEquivalent,
  };
}

// ============================================================================
// Validation Function
// ============================================================================

/**
 * Find the maximum term that keeps monthly-equivalent payment at or above minimum.
 *
 * @param acv - Actual cash value
 * @param frequency - Payment frequency
 * @returns Maximum term in months, or undefined if no valid term exists
 */
export function findMaxTermForMinPayment(acv: number, frequency: PaymentFrequency): number | undefined {
  const totalOfPayments = acv * 2;
  const paymentsPerYear = getPaymentsPerYear(frequency);

  // Monthly equivalent payment must be >= MIN_MONTHLY_PAYMENT_EQUIVALENT
  // monthlyEquivalent = (basePayment * paymentsPerYear) / 12 >= MIN_MONTHLY_PAYMENT_EQUIVALENT
  // basePayment >= MIN_MONTHLY_PAYMENT_EQUIVALENT * 12 / paymentsPerYear
  const minPaymentAtFrequency = (MIN_MONTHLY_PAYMENT_EQUIVALENT * 12) / paymentsPerYear;

  // basePayment = totalOfPayments / numberOfPayments
  // numberOfPayments = termMonths * (paymentsPerYear / 12)
  // basePayment = totalOfPayments / (termMonths * paymentsPerYear / 12)
  // basePayment = (totalOfPayments * 12) / (termMonths * paymentsPerYear)
  // minPaymentAtFrequency = (totalOfPayments * 12) / (maxTerm * paymentsPerYear)
  // maxTerm = (totalOfPayments * 12) / (minPaymentAtFrequency * paymentsPerYear)

  const maxTerm = Math.floor((totalOfPayments * 12) / (minPaymentAtFrequency * paymentsPerYear));

  // Return the maximum valid term that doesn't exceed calculated max
  const validTerms = [12, 24, 36, 48, 60, 72];
  const validMaxTerm = validTerms.filter(t => t <= maxTerm).pop();

  return validMaxTerm;
}

/**
 * Find the minimum term that achieves the minimum monthly-equivalent spread.
 *
 * @param acv - Actual cash value
 * @param frequency - Payment frequency
 * @returns Minimum term in months, or undefined if no valid term exists
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
 * Validate a deal calculation and return any errors.
 *
 * @param calculation - The deal calculation to validate
 * @returns Validation result with any errors and suggestions
 */
export function validateDeal(calculation: DealCalculation): ValidationResult {
  const errors: ValidationError[] = [];

  // Check minimum payment requirement (based on monthly equivalent)
  if (calculation.basePaymentMonthlyEquivalent < MIN_MONTHLY_PAYMENT_EQUIVALENT) {
    const maxTerm = findMaxTermForMinPayment(calculation.acv, calculation.paymentFrequency);
    errors.push({
      field: 'basePayment',
      message: `Monthly equivalent payment $${calculation.basePaymentMonthlyEquivalent.toFixed(2)} is below minimum $${MIN_MONTHLY_PAYMENT_EQUIVALENT}`,
      suggestedValue: maxTerm,
    });
  }

  // Check minimum spread requirement (based on monthly equivalent)
  if (calculation.monthlySpreadEquivalent < MIN_SPREAD) {
    const minTerm = findMinTermForMinSpread(calculation.acv, calculation.paymentFrequency);
    errors.push({
      field: 'spread',
      message: `Monthly equivalent spread $${calculation.monthlySpreadEquivalent.toFixed(2)} is below minimum $${MIN_SPREAD}`,
      suggestedValue: minTerm,
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

  return {
    isValid: errors.length === 0,
    errors,
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
