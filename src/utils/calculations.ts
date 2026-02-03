/**
 * Car World LOS - Lease Calculation Engine
 *
 * BUSINESS MODEL:
 * - Agreed Price = ACV + Markup (from tier matrix)
 * - Residual = Agreed Price × 10% (fixed)
 * - Money Factor adjusts dynamically to ensure Total Base Payments = Effective ACV × 2
 * - Down payment goes to dealer, does not reduce Car World's recovery
 * - Payment Reduction goes to Car World, reduces Effective ACV
 * - Target $175/month spread, minimum $150/month spread
 */

import {
  DOC_FEE,
  PURCHASE_OPTION_FEE,
  DISPOSITION_FEE,
  RESIDUAL_PERCENT,
  MARKUP_MATRIX,
  INVESTOR_ANNUAL_RATE,
  TAX_RATES,
  TARGET_SPREAD,
  MIN_SPREAD,
  MIN_PAYMENT,
  MIN_TERM,
  MAX_TERM,
  PAYMENT_FREQUENCIES,
  type PaymentFrequency,
  type SupportedState,
} from './constants';

// ============================================================================
// TYPES
// ============================================================================

export interface DealInput {
  // Required
  acv: number;                      // Lender's cost in vehicle
  downPayment: number;              // Customer down payment (goes to dealer)
  state: SupportedState;            // TN or MS
  paymentFrequency: PaymentFrequency;

  // Optional - system will calculate if not provided
  termMonths?: number;              // If not provided, auto-calculates for $175 spread
  docFee?: number;                  // Defaults to $695

  // Payment Reduction (goes to Car World, reduces Effective ACV)
  paymentReduction?: number;        // Dealer pays to reduce customer payment

  // Optional fees
  tradeInValue?: number;
  tradeInPayoff?: number;
  titleFee?: number;
}

export interface DealCalculation {
  // Term & Tax
  termMonths: number;
  taxRate: number;
  numberOfPayments: number;

  // Pricing
  acv: number;
  paymentReduction: number;         // Amount paid to Car World to reduce payment
  effectiveACV: number;             // ACV - Payment Reduction (basis for calculations)
  markup: number;
  agreedPrice: number;

  // Capitalized Cost Breakdown
  grossCapCost: number;
  capCostReduction: number;
  taxCollectedAtSigning: number;    // Tax backed out of down payment
  adjustedCapCost: number;

  // Lease Financials
  residualValue: number;
  depreciation: number;
  rentCharge: number;
  totalBasePayments: number;

  // Internal (not shown on contract)
  adjustedMoneyFactor: number;
  impliedAPR: number;

  // Payment Details
  basePayment: number;
  taxPerPayment: number;
  totalPayment: number;
  totalOfPayments: number;

  // Amount Due at Signing
  amountDueAtSigning: number;
  downPayment: number;

  // End of Lease
  purchaseOptionPrice: number;

  // Internal Spread Analysis
  investorPayment: number;
  monthlySpread: number;
  meetsMinSpread: boolean;
  meetsTargetSpread: boolean;

  // Fees included
  docFee: number;
  titleFee: number;
  netTradeIn: number;

  // Payment frequency info
  paymentFrequencyLabel: string;

  // Compatibility aliases
  state: SupportedState;
  paymentFrequency: PaymentFrequency;

  // Legacy compatibility fields for document generators
  salesTax: number;  // Total tax on periodic payments (not including tax at signing)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Round to 2 decimal places (currency)
 */
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Get markup amount based on ACV tier
 */
export function getMarkup(acv: number): number {
  for (const tier of MARKUP_MATRIX) {
    if (acv <= tier.maxACV) {
      return tier.markup;
    }
  }
  return MARKUP_MATRIX[MARKUP_MATRIX.length - 1].markup;
}

/**
 * Calculate number of payments for a term based on frequency
 */
export function calculateNumberOfPayments(termMonths: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = PAYMENT_FREQUENCIES[frequency].paymentsPerYear;
  return Math.round(termMonths * (paymentsPerYear / 12));
}

/**
 * Get payments per year for a frequency
 */
export function getPaymentsPerYear(frequency: PaymentFrequency): number {
  return PAYMENT_FREQUENCIES[frequency].paymentsPerYear;
}

/**
 * Calculate what Car World pays to investor (amortized payment on ACV)
 */
function calculateInvestorPayment(acv: number, termMonths: number, frequency: PaymentFrequency): number {
  const monthlyRate = INVESTOR_ANNUAL_RATE / 12;

  // Standard amortization formula: P × [r(1+r)^n] / [(1+r)^n - 1]
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, termMonths);
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1;
  const monthlyInvestorPayment = acv * (numerator / denominator);

  // Convert to payment frequency
  const paymentsPerYear = PAYMENT_FREQUENCIES[frequency].paymentsPerYear;
  const paymentAmount = monthlyInvestorPayment * (12 / paymentsPerYear);

  return roundCurrency(paymentAmount);
}

/**
 * Calculate monthly equivalent spread
 */
function calculateMonthlySpread(
  basePayment: number,
  investorPayment: number,
  frequency: PaymentFrequency
): number {
  const paymentsPerYear = PAYMENT_FREQUENCIES[frequency].paymentsPerYear;
  const customerMonthly = basePayment * (paymentsPerYear / 12);
  const investorMonthly = investorPayment * (paymentsPerYear / 12);

  return roundCurrency(customerMonthly - investorMonthly);
}

/**
 * Convert amount to monthly equivalent
 */
export function toMonthlyEquivalent(amount: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = PAYMENT_FREQUENCIES[frequency].paymentsPerYear;
  return roundCurrency(amount * (paymentsPerYear / 12));
}

/**
 * Convert monthly amount to frequency amount
 */
export function fromMonthlyEquivalent(monthlyAmount: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = PAYMENT_FREQUENCIES[frequency].paymentsPerYear;
  return roundCurrency(monthlyAmount * (12 / paymentsPerYear));
}

/**
 * Find optimal term that achieves target spread
 */
export function findOptimalTerm(
  acv: number,
  downPayment: number,
  docFee: number,
  frequency: PaymentFrequency,
  state: SupportedState,
  paymentReduction: number = 0
): number {
  const effectiveACV = acv - paymentReduction;
  const taxRate = TAX_RATES[state];
  const markup = getMarkup(acv);
  const agreedPrice = acv + markup;
  const residualValue = agreedPrice * RESIDUAL_PERCENT;
  const grossCapCost = agreedPrice + docFee;
  const capCostReduction = downPayment / (1 + taxRate);
  const adjustedCapCost = grossCapCost - capCostReduction;
  const depreciation = adjustedCapCost - residualValue;
  const targetTotalBasePayments = effectiveACV * 2;
  const rentCharge = targetTotalBasePayments - depreciation;

  // If rent charge is negative, deal doesn't work
  if (rentCharge < 0) {
    return MAX_TERM;
  }

  for (let term = MIN_TERM; term <= MAX_TERM; term++) {
    const numberOfPayments = calculateNumberOfPayments(term, frequency);
    const basePayment = targetTotalBasePayments / numberOfPayments;

    // Check minimum payment constraint (monthly equivalent)
    const monthlyEquivalent = toMonthlyEquivalent(basePayment, frequency);
    if (monthlyEquivalent < MIN_PAYMENT) {
      continue;
    }

    // Calculate spread
    const investorPayment = calculateInvestorPayment(effectiveACV, term, frequency);
    const monthlySpread = calculateMonthlySpread(basePayment, investorPayment, frequency);

    // Check if meets minimum spread
    if (monthlySpread < MIN_SPREAD) {
      continue;
    }

    // Return first term that meets or is just under target
    if (monthlySpread <= TARGET_SPREAD) {
      return term;
    }
  }

  return MAX_TERM;
}

/**
 * Calculate optimal term result with details
 */
export function calculateOptimalTerm(
  acv: number,
  docFee: number,
  state: SupportedState,
  paymentFrequency: PaymentFrequency = 'monthly',
  downPayment: number = 0,
  paymentReduction: number = 0
): { term: number; isValid: boolean; spread: number; markup: number; basePayment: number; validRange: { min: number; max: number } } {
  const term = findOptimalTerm(acv, downPayment, docFee, paymentFrequency, state, paymentReduction);

  // Calculate at optimal term
  const effectiveACV = acv - paymentReduction;
  const markup = getMarkup(acv);
  const targetTotalBasePayments = effectiveACV * 2;
  const numberOfPayments = calculateNumberOfPayments(term, paymentFrequency);
  const basePayment = targetTotalBasePayments / numberOfPayments;
  const investorPayment = calculateInvestorPayment(effectiveACV, term, paymentFrequency);
  const monthlySpread = calculateMonthlySpread(basePayment, investorPayment, paymentFrequency);
  const monthlyBasePayment = toMonthlyEquivalent(basePayment, paymentFrequency);

  const isValid = monthlySpread >= MIN_SPREAD && monthlyBasePayment >= MIN_PAYMENT;

  // Find valid range
  let minValid = MAX_TERM;
  let maxValid = MIN_TERM;
  for (let t = MIN_TERM; t <= MAX_TERM; t++) {
    const np = calculateNumberOfPayments(t, paymentFrequency);
    const bp = targetTotalBasePayments / np;
    const me = toMonthlyEquivalent(bp, paymentFrequency);
    const ip = calculateInvestorPayment(effectiveACV, t, paymentFrequency);
    const ms = calculateMonthlySpread(bp, ip, paymentFrequency);
    if (ms >= MIN_SPREAD && me >= MIN_PAYMENT) {
      if (t < minValid) minValid = t;
      if (t > maxValid) maxValid = t;
    }
  }

  return {
    term,
    isValid,
    spread: roundCurrency(monthlySpread),
    markup: roundCurrency(markup),
    basePayment: roundCurrency(monthlyBasePayment),
    validRange: { min: minValid, max: maxValid },
  };
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate all lease values from dealer inputs
 */
export function calculateDeal(inputs: DealInput): DealCalculation {
  const {
    acv,
    downPayment,
    state,
    paymentFrequency,
    termMonths: inputTerm,
    docFee = DOC_FEE,
    paymentReduction = 0,
    tradeInValue = 0,
    tradeInPayoff = 0,
    titleFee = 0,
  } = inputs;

  const taxRate = TAX_RATES[state];
  const netTradeIn = tradeInValue - tradeInPayoff;

  // Step 1: Calculate Effective ACV (ACV minus Payment Reduction)
  // Payment Reduction goes to Car World, reducing the amount to recover
  const effectiveACV = acv - paymentReduction;

  // Step 2: Get markup from matrix (based on ORIGINAL ACV for pricing)
  const markup = getMarkup(acv);

  // Step 3: Calculate Agreed Price (based on original ACV + markup)
  const agreedPrice = roundCurrency(acv + markup);

  // Step 4: Fixed Residual = 10% of Agreed Price
  const residualValue = roundCurrency(agreedPrice * RESIDUAL_PERCENT);

  // Step 5: Determine term (based on effective ACV)
  const termMonths = inputTerm ?? findOptimalTerm(acv, downPayment, docFee, paymentFrequency, state, paymentReduction);

  // Step 6: Standard Lease Calculations
  const grossCapCost = roundCurrency(agreedPrice + docFee);

  // Down payment includes tax - back out the tax portion
  // Cap Cost Reduction = Down Payment / (1 + tax rate)
  // Tax Collected at Signing = Down Payment - Cap Cost Reduction
  const capCostReduction = roundCurrency(downPayment / (1 + taxRate));
  const taxCollectedAtSigning = roundCurrency(downPayment - capCostReduction);

  const adjustedCapCost = roundCurrency(grossCapCost - capCostReduction);
  const depreciation = roundCurrency(adjustedCapCost - residualValue);

  // Step 7: Target Total Base Payments = EFFECTIVE ACV × 2
  const targetTotalBasePayments = effectiveACV * 2;

  // Step 8: Back-calculate Rent Charge to hit target
  const rentCharge = roundCurrency(targetTotalBasePayments - depreciation);

  // Step 9: Back-calculate Money Factor (internal only)
  const adjustedMoneyFactor = rentCharge / ((adjustedCapCost + residualValue) * termMonths);
  const impliedAPR = adjustedMoneyFactor * 2400;

  // Step 10: Total Base Payments (should equal Effective ACV × 2)
  const totalBasePayments = roundCurrency(depreciation + rentCharge);

  // Step 11: Payment Calculations
  const numberOfPayments = calculateNumberOfPayments(termMonths, paymentFrequency);
  const basePayment = roundCurrency(totalBasePayments / numberOfPayments);
  const taxPerPayment = roundCurrency(basePayment * taxRate);
  const totalPayment = roundCurrency(basePayment + taxPerPayment);
  const totalOfPayments = roundCurrency(totalPayment * numberOfPayments);

  // Step 12: Amount Due at Signing (Down Payment only)
  // Doc fee is capitalized (included in Gross Cap Cost)
  // First payment is NOT collected at signing
  const amountDueAtSigning = roundCurrency(downPayment);  // What customer pays (includes tax)

  // Step 13: Purchase Option
  const purchaseOptionPrice = roundCurrency(residualValue + PURCHASE_OPTION_FEE);

  // Step 14: Spread Analysis (based on EFFECTIVE ACV)
  const investorPayment = calculateInvestorPayment(effectiveACV, termMonths, paymentFrequency);
  const monthlySpread = calculateMonthlySpread(basePayment, investorPayment, paymentFrequency);

  // Get payment frequency label
  const paymentFrequencyLabel = PAYMENT_FREQUENCIES[paymentFrequency].label;

  return {
    termMonths,
    taxRate,
    numberOfPayments,
    acv,
    paymentReduction,
    effectiveACV,
    markup,
    agreedPrice,
    grossCapCost,
    capCostReduction,
    taxCollectedAtSigning,
    adjustedCapCost,
    residualValue,
    depreciation,
    rentCharge,
    totalBasePayments,
    adjustedMoneyFactor,
    impliedAPR,
    basePayment,
    taxPerPayment,
    totalPayment,
    totalOfPayments,
    amountDueAtSigning,
    downPayment,
    purchaseOptionPrice,
    investorPayment,
    monthlySpread,
    meetsMinSpread: monthlySpread >= MIN_SPREAD,
    meetsTargetSpread: monthlySpread >= TARGET_SPREAD,
    docFee,
    titleFee,
    netTradeIn,
    paymentFrequencyLabel,
    state,
    paymentFrequency,
    // Legacy compatibility - total sales tax on periodic payments
    salesTax: roundCurrency(taxPerPayment * numberOfPayments),
  };
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Get payment frequency text for contract
 */
export function getPaymentFrequencyText(frequency: PaymentFrequency): string {
  switch (frequency) {
    case 'monthly':
      return 'on the _____ of each month';
    case 'biweekly':
      return 'every 14 days';
    case 'weekly':
      return 'every 7 days';
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  suggestedValue?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  validTermRange?: { min: number; max: number };
}

export function validateDeal(calculation: DealCalculation): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check ACV
  if (!calculation.acv || calculation.acv <= 0) {
    errors.push({
      field: 'acv',
      message: 'ACV is required and must be greater than 0',
    });
  }

  // Check spread
  if (!calculation.meetsMinSpread) {
    errors.push({
      field: 'spread',
      message: `Spread of ${formatCurrency(calculation.monthlySpread)}/month is below minimum ${formatCurrency(MIN_SPREAD)}. Try a shorter term.`,
    });
  } else if (!calculation.meetsTargetSpread) {
    warnings.push(`Spread of ${formatCurrency(calculation.monthlySpread)}/month is below target ${formatCurrency(TARGET_SPREAD)}.`);
  }

  // Check minimum payment (monthly equivalent)
  const monthlyEquivalent = toMonthlyEquivalent(calculation.basePayment, calculation.paymentFrequency);
  if (monthlyEquivalent < MIN_PAYMENT) {
    errors.push({
      field: 'basePayment',
      message: `Monthly equivalent payment of ${formatCurrency(monthlyEquivalent)} is below minimum ${formatCurrency(MIN_PAYMENT)}. Try a shorter term.`,
    });
  }

  // Check term range
  if (calculation.termMonths < MIN_TERM || calculation.termMonths > MAX_TERM) {
    errors.push({
      field: 'termMonths',
      message: `Term must be between ${MIN_TERM} and ${MAX_TERM} months.`,
    });
  }

  // Check down payment
  if (calculation.downPayment < 0) {
    errors.push({
      field: 'downPayment',
      message: 'Down payment cannot be negative.',
    });
  }

  // Check payment reduction
  if (calculation.paymentReduction < 0) {
    errors.push({
      field: 'paymentReduction',
      message: 'Payment reduction cannot be negative.',
    });
  }

  // Check payment reduction doesn't exceed ACV
  if (calculation.paymentReduction >= calculation.acv) {
    errors.push({
      field: 'paymentReduction',
      message: 'Payment reduction cannot exceed ACV.',
    });
  }

  // Check rent charge (if negative, deal structure doesn't work)
  if (calculation.rentCharge < 0) {
    errors.push({
      field: 'rentCharge',
      message: 'Deal structure invalid: depreciation exceeds target total. Reduce down payment or adjust pricing.',
    });
  }

  // Find valid term range
  const effectiveACV = calculation.acv - calculation.paymentReduction;
  const targetTotalBasePayments = effectiveACV * 2;
  let minValid = MAX_TERM;
  let maxValid = MIN_TERM;
  for (let t = MIN_TERM; t <= MAX_TERM; t++) {
    const np = calculateNumberOfPayments(t, calculation.paymentFrequency);
    const bp = targetTotalBasePayments / np;
    const me = toMonthlyEquivalent(bp, calculation.paymentFrequency);
    const ip = calculateInvestorPayment(effectiveACV, t, calculation.paymentFrequency);
    const ms = calculateMonthlySpread(bp, ip, calculation.paymentFrequency);
    if (ms >= MIN_SPREAD && me >= MIN_PAYMENT) {
      if (t < minValid) minValid = t;
      if (t > maxValid) maxValid = t;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validTermRange: minValid <= maxValid ? { min: minValid, max: maxValid } : undefined,
  };
}

// ============================================================================
// EARLY TERMINATION SCHEDULE
// ============================================================================

export interface EarlyTerminationRow {
  paymentsMade: number;
  remainingPayments: number;
  amountOwed: number;
}

export function generateEarlyTerminationSchedule(calculation: DealCalculation): EarlyTerminationRow[] {
  const rows: EarlyTerminationRow[] = [];
  const totalPayments = calculation.numberOfPayments;
  const basePayment = calculation.basePayment;

  // Show schedule at key intervals
  let intervals: number[];
  if (totalPayments <= 24) {
    intervals = [3, 6, 9, 12, 15, 18, 21];
  } else if (totalPayments <= 36) {
    intervals = [6, 12, 18, 24, 30];
  } else {
    intervals = [6, 12, 18, 24, 30, 36, 42, 48];
  }

  // Filter to only show intervals less than total payments
  intervals = intervals.filter(i => i < totalPayments);

  for (const paymentsMade of intervals) {
    const remaining = totalPayments - paymentsMade;
    const amountOwed = roundCurrency((remaining * basePayment) + DISPOSITION_FEE);

    rows.push({
      paymentsMade,
      remainingPayments: remaining,
      amountOwed,
    });
  }

  return rows;
}

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// Re-export types for backward compatibility
export type { PaymentFrequency, SupportedState };
