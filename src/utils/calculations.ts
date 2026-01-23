import {
  MONEY_FACTOR,
  RESIDUAL_PERCENT,
  INVESTOR_RATE,
  MIN_MONTHLY_PAYMENT,
  MIN_SPREAD,
  TAX_RATES,
  type SupportedState,
} from './constants';

// ============================================================================
// Types
// ============================================================================

export interface DealInput {
  acv: number;           // Actual Cash Value of vehicle
  termMonths: number;    // Lease term in months
  docFee: number;        // Documentation fee
  state: SupportedState; // State for tax calculation
}

export interface DealCalculation {
  // Input values
  acv: number;
  termMonths: number;
  docFee: number;
  state: SupportedState;

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

  // Tax calculations
  taxRate: number;
  salesTax: number;
  taxPerPayment: number;

  // Final payment values
  totalPayment: number;
  amountDueAtSigning: number;
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
 * Calculate amortized loan payment using standard formula:
 * P * [r(1+r)^n] / [(1+r)^n - 1]
 *
 * @param principal - Loan amount
 * @param annualRate - Annual interest rate (decimal)
 * @param termMonths - Number of monthly payments
 * @returns Monthly payment amount
 */
export function calculateAmortizedPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  const monthlyRate = annualRate / 12;

  // Handle edge case of 0% interest
  if (monthlyRate === 0) {
    return principal / termMonths;
  }

  const compoundFactor = Math.pow(1 + monthlyRate, termMonths);
  const payment = principal * (monthlyRate * compoundFactor) / (compoundFactor - 1);

  return payment;
}

/**
 * Reverse-calculate the adjusted capitalized cost from base payment.
 *
 * Lease formula: basePayment = (depreciation + rentCharge) / term
 * Where:
 *   depreciation = adjustedCap - residual
 *   rentCharge = (adjustedCap + residual) * MF * term
 *
 * Solving for adjustedCap:
 *   basePayment * term = adjustedCap - residual + (adjustedCap + residual) * MF * term
 *   basePayment * term = adjustedCap(1 + MF * term) + residual(MF * term - 1)
 *   adjustedCap = (basePayment * term - residual * (MF * term - 1)) / (1 + MF * term)
 *
 * @param basePayment - The target base monthly payment
 * @param residualValue - The residual value of the vehicle
 * @param termMonths - Lease term in months
 * @param moneyFactor - Money factor for lease
 * @returns The adjusted capitalized cost
 */
export function reverseCalculateAdjustedCap(
  basePayment: number,
  residualValue: number,
  termMonths: number,
  moneyFactor: number = MONEY_FACTOR
): number {
  const mfTerm = moneyFactor * termMonths;
  const numerator = basePayment * termMonths - residualValue * (mfTerm - 1);
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

// ============================================================================
// Core Calculation Function
// ============================================================================

/**
 * Calculate all deal values based on ACV and term.
 *
 * This function implements the Car World lease calculation methodology:
 * 1. Start with ACV and desired term
 * 2. Calculate residual (15% of ACV)
 * 3. Total of payments = ACV * 2 (customer pays 2x the vehicle value)
 * 4. Base payment = total / term
 * 5. Reverse-calculate the agreed price that produces this payment
 * 6. Calculate investor payment and spread
 * 7. Add tax based on state
 *
 * @param input - Deal input parameters
 * @returns Complete deal calculations
 */
export function calculateDeal(input: DealInput): DealCalculation {
  const { acv, termMonths, docFee, state } = input;

  // Step 1: Calculate residual value (15% of ACV)
  const residualValue = roundCurrency(acv * RESIDUAL_PERCENT);

  // Step 2: Total of payments = ACV * 2
  const totalOfPayments = roundCurrency(acv * 2);

  // Step 3: Number of payments = term months (monthly schedule)
  const numberOfPayments = termMonths;

  // Step 4: Base payment = total / number of payments
  const basePayment = roundCurrency(totalOfPayments / numberOfPayments);

  // Step 5: Reverse-calculate agreed price from base payment
  // Since no other fees are added to cap cost, agreedPrice = adjustedCap
  const agreedPrice = roundCurrency(
    reverseCalculateAdjustedCap(basePayment, residualValue, termMonths)
  );

  // Calculate depreciation and rent charge for transparency
  const depreciation = roundCurrency(calculateDepreciation(agreedPrice, residualValue));
  const rentCharge = roundCurrency(
    calculateRentCharge(agreedPrice, residualValue, termMonths)
  );

  // Step 6: Calculate investor payment (amortized payment on ACV at investor rate)
  const investorPayment = roundCurrency(
    calculateAmortizedPayment(acv, INVESTOR_RATE, termMonths)
  );

  // Step 7: Calculate spread (profit margin)
  const spread = roundCurrency(basePayment - investorPayment);

  // Step 8: Calculate sales tax based on state
  const taxRate = TAX_RATES[state] ?? 0;
  const salesTax = roundCurrency(agreedPrice * taxRate);
  const taxPerPayment = roundCurrency(salesTax / numberOfPayments);

  // Step 9: Total payment = base payment + tax per payment
  const totalPayment = roundCurrency(basePayment + taxPerPayment);

  // Step 10: Amount due at signing = first payment + doc fee
  const amountDueAtSigning = roundCurrency(totalPayment + docFee);

  return {
    // Input values
    acv,
    termMonths,
    docFee,
    state,

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

    // Tax calculations
    taxRate,
    salesTax,
    taxPerPayment,

    // Final payment values
    totalPayment,
    amountDueAtSigning,
  };
}

// ============================================================================
// Validation Function
// ============================================================================

/**
 * Find the maximum term that keeps base payment at or above minimum.
 *
 * @param acv - Actual cash value
 * @returns Maximum term in months, or undefined if no valid term exists
 */
export function findMaxTermForMinPayment(acv: number): number | undefined {
  const totalOfPayments = acv * 2;
  // basePayment = totalOfPayments / term
  // MIN_MONTHLY_PAYMENT = totalOfPayments / maxTerm
  // maxTerm = totalOfPayments / MIN_MONTHLY_PAYMENT
  const maxTerm = Math.floor(totalOfPayments / MIN_MONTHLY_PAYMENT);

  // Return the maximum valid term that doesn't exceed calculated max
  const validTerms = [12, 24, 36, 48, 60, 72];
  const validMaxTerm = validTerms.filter(t => t <= maxTerm).pop();

  return validMaxTerm;
}

/**
 * Find the minimum term that achieves the minimum spread.
 *
 * This is more complex because both base payment and investor payment
 * change with term. We need to iterate to find the right term.
 *
 * @param acv - Actual cash value
 * @returns Minimum term in months, or undefined if no valid term exists
 */
export function findMinTermForMinSpread(acv: number): number | undefined {
  const validTerms = [12, 24, 36, 48, 60, 72];

  for (const term of validTerms) {
    const totalOfPayments = acv * 2;
    const basePayment = totalOfPayments / term;
    const investorPayment = calculateAmortizedPayment(acv, INVESTOR_RATE, term);
    const spread = basePayment - investorPayment;

    if (spread >= MIN_SPREAD) {
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

  // Check minimum payment requirement
  if (calculation.basePayment < MIN_MONTHLY_PAYMENT) {
    const maxTerm = findMaxTermForMinPayment(calculation.acv);
    errors.push({
      field: 'basePayment',
      message: `Base payment $${calculation.basePayment.toFixed(2)} is below minimum $${MIN_MONTHLY_PAYMENT}`,
      suggestedValue: maxTerm,
    });
  }

  // Check minimum spread requirement
  if (calculation.spread < MIN_SPREAD) {
    const minTerm = findMinTermForMinSpread(calculation.acv);
    errors.push({
      field: 'spread',
      message: `Spread $${calculation.spread.toFixed(2)} is below minimum $${MIN_SPREAD}`,
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
