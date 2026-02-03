import { describe, it, expect } from 'vitest';
import {
  calculateDeal,
  validateDeal,
  calculateNumberOfPayments,
  toMonthlyEquivalent,
  fromMonthlyEquivalent,
  roundCurrency,
  getMarkup,
  findOptimalTerm,
  generateEarlyTerminationSchedule,
} from './calculations';
import {
  RESIDUAL_PERCENT,
  INVESTOR_ANNUAL_RATE,
  MIN_SPREAD,
  MIN_PAYMENT,
  TAX_RATES,
  PAYMENT_FREQUENCIES,
  MARKUP_MATRIX,
  DOC_FEE,
} from './constants';

describe('Constants', () => {
  it('should have 10% residual', () => {
    expect(RESIDUAL_PERCENT).toBe(0.10);
  });

  it('should have 12.5% investor rate', () => {
    expect(INVESTOR_ANNUAL_RATE).toBe(0.125);
  });

  it('should have TN and MS tax rates', () => {
    expect(TAX_RATES.TN).toBe(0.0975);
    expect(TAX_RATES.MS).toBe(0.05);
  });

  it('should have correct payment frequencies', () => {
    expect(PAYMENT_FREQUENCIES.weekly.paymentsPerYear).toBe(52);
    expect(PAYMENT_FREQUENCIES.biweekly.paymentsPerYear).toBe(26);
    expect(PAYMENT_FREQUENCIES.monthly.paymentsPerYear).toBe(12);
  });

  it('should have correct markup matrix', () => {
    expect(MARKUP_MATRIX).toHaveLength(5);
    expect(MARKUP_MATRIX[0]).toEqual({ maxACV: 7000, markup: 3000 });
    expect(MARKUP_MATRIX[4]).toEqual({ maxACV: Infinity, markup: 5000 });
  });

  it('should have default doc fee of $695', () => {
    expect(DOC_FEE).toBe(695);
  });
});

describe('Helper Functions', () => {
  describe('roundCurrency', () => {
    it('should round to 2 decimal places', () => {
      expect(roundCurrency(123.456)).toBe(123.46);
      expect(roundCurrency(123.454)).toBe(123.45);
      expect(roundCurrency(123.455)).toBe(123.46);
    });
  });

  describe('getMarkup', () => {
    it('should return correct markup for each tier', () => {
      expect(getMarkup(5000)).toBe(3000);   // ≤ 7000
      expect(getMarkup(7000)).toBe(3000);   // ≤ 7000
      expect(getMarkup(8000)).toBe(3500);   // ≤ 10000
      expect(getMarkup(12000)).toBe(4000);  // ≤ 15000
      expect(getMarkup(18000)).toBe(4500);  // ≤ 20000
      expect(getMarkup(25000)).toBe(5000);  // > 20000
    });
  });

  describe('toMonthlyEquivalent', () => {
    it('should convert weekly payment to monthly equivalent', () => {
      // $100/week * 52 weeks / 12 months = $433.33/month
      expect(toMonthlyEquivalent(100, 'weekly')).toBeCloseTo(433.33, 0);
    });

    it('should convert biweekly payment to monthly equivalent', () => {
      // $200/biweekly * 26 / 12 = $433.33/month
      expect(toMonthlyEquivalent(200, 'biweekly')).toBeCloseTo(433.33, 0);
    });

    it('should keep monthly as-is', () => {
      expect(toMonthlyEquivalent(500, 'monthly')).toBe(500);
    });
  });

  describe('fromMonthlyEquivalent', () => {
    it('should convert monthly to weekly payment', () => {
      // $433.33/month * 12 / 52 = $100/week
      expect(fromMonthlyEquivalent(433.33, 'weekly')).toBeCloseTo(100, 0);
    });
  });

  describe('calculateNumberOfPayments', () => {
    it('should calculate correct number of payments for each frequency', () => {
      // 36 month term
      expect(calculateNumberOfPayments(36, 'monthly')).toBe(36);
      expect(calculateNumberOfPayments(36, 'biweekly')).toBe(78);
      expect(calculateNumberOfPayments(36, 'weekly')).toBe(156);
    });
  });
});

describe('calculateDeal - New Business Model', () => {
  it('should calculate total base payments as Effective ACV × 2', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      docFee: 695,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Total Base Payments should equal Effective ACV × 2
    // Effective ACV = ACV - Payment Reduction = 10000 - 0 = 10000
    expect(deal.totalBasePayments).toBe(20000);
  });

  it('should calculate agreed price as ACV + Markup', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // ACV $10,000 is in the ≤10,000 tier = $3,500 markup
    expect(deal.markup).toBe(3500);
    expect(deal.agreedPrice).toBe(13500);
  });

  it('should calculate residual as 10% of Agreed Price', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Residual = Agreed Price × 10% = 13500 × 0.10 = 1350
    expect(deal.residualValue).toBe(1350);
  });

  it('should calculate correct number of payments', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    expect(deal.numberOfPayments).toBe(36);
  });

  it('should handle payment reduction correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      paymentReduction: 1000,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Effective ACV = ACV - Payment Reduction = 10000 - 1000 = 9000
    expect(deal.effectiveACV).toBe(9000);

    // Total Base Payments = Effective ACV × 2 = 9000 × 2 = 18000
    expect(deal.totalBasePayments).toBe(18000);
  });

  it('should back out tax from down payment for cap cost reduction', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 1000,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Cap Cost Reduction = Down Payment / (1 + Tax Rate)
    // Cap Cost Reduction = 1000 / (1 + 0.0975) = 1000 / 1.0975 ≈ 911.16
    expect(deal.capCostReduction).toBeCloseTo(911.16, 0);

    // Tax Collected at Signing = Down Payment - Cap Cost Reduction
    // Tax Collected = 1000 - 911.16 ≈ 88.84
    expect(deal.taxCollectedAtSigning).toBeCloseTo(88.84, 0);

    // Amount Due at Signing = Down Payment
    expect(deal.amountDueAtSigning).toBe(1000);
  });

  it('should calculate tax per payment based on base payment', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Tax Per Payment = Base Payment × Tax Rate
    const expectedTax = roundCurrency(deal.basePayment * 0.0975);
    expect(deal.taxPerPayment).toBe(expectedTax);

    // Total Payment = Base Payment + Tax Per Payment
    expect(deal.totalPayment).toBe(roundCurrency(deal.basePayment + deal.taxPerPayment));
  });

  it('should calculate purchase option price correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Purchase Option = Residual + $300 fee
    expect(deal.purchaseOptionPrice).toBe(deal.residualValue + 300);
  });

  it('should calculate spread correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Spread = Base Payment - Investor Payment (converted to monthly)
    // monthlySpread should be positive and reasonable
    expect(deal.monthlySpread).toBeGreaterThan(0);
    expect(deal.investorPayment).toBeGreaterThan(0);
  });
});

describe('calculateDeal - Payment Frequencies', () => {
  it('should calculate biweekly deal correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    // Number of payments = 36 * (26/12) = 78
    expect(deal.numberOfPayments).toBe(78);
    expect(deal.paymentFrequencyLabel).toBe('Bi-Weekly');

    // Total base payments should still be ACV × 2
    expect(deal.totalBasePayments).toBe(20000);
  });

  it('should calculate weekly deal correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'weekly',
    });

    // Number of payments = 36 * (52/12) = 156
    expect(deal.numberOfPayments).toBe(156);
    expect(deal.paymentFrequencyLabel).toBe('Weekly');

    // Total base payments should still be ACV × 2
    expect(deal.totalBasePayments).toBe(20000);
  });

  it('should have consistent total base payments across frequencies', () => {
    const monthly = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const biweekly = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    const weekly = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'weekly',
    });

    // Total base payments should be the same regardless of frequency
    expect(monthly.totalBasePayments).toBe(biweekly.totalBasePayments);
    expect(biweekly.totalBasePayments).toBe(weekly.totalBasePayments);
  });
});

describe('calculateDeal - State Taxes', () => {
  it('should calculate different state taxes correctly', () => {
    const tnDeal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const msDeal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'MS',
      paymentFrequency: 'monthly',
    });

    expect(tnDeal.taxRate).toBe(0.0975);
    expect(msDeal.taxRate).toBe(0.05);
    expect(tnDeal.taxPerPayment).toBeGreaterThan(msDeal.taxPerPayment);
  });
});

describe('validateDeal', () => {
  it('should pass validation for a valid deal', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const result = validateDeal(deal);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation when spread is below minimum', () => {
    // Very long term = low spread
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 48,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const result = validateDeal(deal);

    // Check if deal meets spread requirement
    if (deal.monthlySpread < MIN_SPREAD) {
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'spread')).toBe(true);
    }
  });

  it('should fail validation when payment is below minimum', () => {
    // Low ACV with long term = low monthly equivalent
    const deal = calculateDeal({
      acv: 5000,
      downPayment: 0,
      termMonths: 48,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const result = validateDeal(deal);

    const monthlyEquiv = toMonthlyEquivalent(deal.basePayment, 'monthly');
    if (monthlyEquiv < MIN_PAYMENT) {
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'basePayment')).toBe(true);
    }
  });

  it('should return valid term range', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const result = validateDeal(deal);

    if (result.validTermRange) {
      expect(result.validTermRange.min).toBeGreaterThanOrEqual(12);
      expect(result.validTermRange.max).toBeLessThanOrEqual(48);
    }
  });
});

describe('findOptimalTerm', () => {
  it('should find a term that meets spread requirements', () => {
    const term = findOptimalTerm(10000, 0, DOC_FEE, 'monthly', 'TN', 0);

    expect(term).toBeGreaterThanOrEqual(12);
    expect(term).toBeLessThanOrEqual(48);

    // Verify the found term produces a valid deal
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: term,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const result = validateDeal(deal);
    expect(result.isValid).toBe(true);
  });
});

describe('generateEarlyTerminationSchedule', () => {
  it('should generate termination schedule', () => {
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 0,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const schedule = generateEarlyTerminationSchedule(deal);

    expect(schedule.length).toBeGreaterThan(0);

    // Each row should have correct structure
    for (const row of schedule) {
      expect(row.paymentsMade).toBeGreaterThan(0);
      expect(row.remainingPayments).toBeGreaterThan(0);
      expect(row.amountOwed).toBeGreaterThan(0);
    }

    // Earlier termination should have higher amount owed
    if (schedule.length >= 2) {
      expect(schedule[0].amountOwed).toBeGreaterThan(schedule[schedule.length - 1].amountOwed);
    }
  });
});

describe('Real World Scenarios', () => {
  it('should calculate a typical biweekly used car lease', () => {
    // $12,000 used car, biweekly, TN
    const deal = calculateDeal({
      acv: 12000,
      downPayment: 500,
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    // Verify key calculations
    expect(deal.effectiveACV).toBe(12000); // No payment reduction
    expect(deal.markup).toBe(4000); // $12,000 is in ≤15000 tier
    expect(deal.agreedPrice).toBe(16000);
    expect(deal.residualValue).toBe(1600); // 10% of agreed price
    expect(deal.totalBasePayments).toBe(24000); // ACV × 2

    // Validate the deal
    const validation = validateDeal(deal);
    expect(validation.isValid).toBe(true);

    console.log('Typical Biweekly Used Car Lease ($12,000 ACV, 36mo, TN):');
    console.log(`  Agreed Price: $${deal.agreedPrice.toFixed(2)}`);
    console.log(`  Markup: $${deal.markup.toFixed(2)}`);
    console.log(`  Residual Value: $${deal.residualValue.toFixed(2)}`);
    console.log(`  Number of Payments: ${deal.numberOfPayments}`);
    console.log(`  Base Payment: $${deal.basePayment.toFixed(2)}`);
    console.log(`  Tax/Payment: $${deal.taxPerPayment.toFixed(2)}`);
    console.log(`  Total Payment: $${deal.totalPayment.toFixed(2)}`);
    console.log(`  Due at Signing: $${deal.amountDueAtSigning.toFixed(2)}`);
    console.log(`  Monthly Spread: $${deal.monthlySpread.toFixed(2)}`);
  });

  it('should handle payment reduction scenario', () => {
    // Dealer wants to reduce customer payment by contributing to Car World
    const deal = calculateDeal({
      acv: 10000,
      downPayment: 1000,
      paymentReduction: 2000, // Dealer pays $2,000 to Car World
      termMonths: 36,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    // Effective ACV = 10000 - 2000 = 8000
    expect(deal.effectiveACV).toBe(8000);

    // Total Base Payments = Effective ACV × 2 = 16000
    expect(deal.totalBasePayments).toBe(16000);

    console.log('\nDeal with Payment Reduction ($10,000 ACV - $2,000 reduction):');
    console.log(`  Effective ACV: $${deal.effectiveACV.toFixed(2)}`);
    console.log(`  Total Base Payments: $${deal.totalBasePayments.toFixed(2)}`);
    console.log(`  Base Payment: $${deal.basePayment.toFixed(2)}`);
    console.log(`  Monthly Spread: $${deal.monthlySpread.toFixed(2)}`);
  });
});
