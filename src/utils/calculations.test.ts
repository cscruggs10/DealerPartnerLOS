import { describe, it, expect } from 'vitest';
import {
  calculateDeal,
  validateDeal,
  calculateAmortizedPayment,
  reverseCalculateAdjustedCap,
  calculateDepreciation,
  calculateRentCharge,
  calculateNumberOfPayments,
  findMaxTermForMinPayment,
  findMinTermForMinSpread,
  toMonthlyEquivalent,
  fromMonthlyEquivalent,
  moneyFactorToAPR,
  aprToMoneyFactor,
  roundCurrency,
} from './calculations';
import {
  MONEY_FACTOR,
  RESIDUAL_PERCENT,
  INVESTOR_RATE,
  MIN_MONTHLY_PAYMENT_EQUIVALENT,
  MIN_SPREAD,
  TAX_RATES,
  PAYMENT_FREQUENCIES,
} from './constants';

describe('Constants', () => {
  it('should have correct money factor for 23.99% APR', () => {
    const apr = moneyFactorToAPR(MONEY_FACTOR);
    expect(apr).toBeCloseTo(23.99, 1);
  });

  it('should have 15% residual', () => {
    expect(RESIDUAL_PERCENT).toBe(0.15);
  });

  it('should have 12.5% investor rate', () => {
    expect(INVESTOR_RATE).toBe(0.125);
  });

  it('should have TN and MS tax rates', () => {
    expect(TAX_RATES.TN).toBe(0.095);
    expect(TAX_RATES.MS).toBe(0.05);
  });

  it('should have correct payment frequencies', () => {
    expect(PAYMENT_FREQUENCIES.weekly.paymentsPerYear).toBe(52);
    expect(PAYMENT_FREQUENCIES.biweekly.paymentsPerYear).toBe(26);
    expect(PAYMENT_FREQUENCIES.semimonthly.paymentsPerYear).toBe(24);
    expect(PAYMENT_FREQUENCIES.monthly.paymentsPerYear).toBe(12);
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

  describe('moneyFactorToAPR', () => {
    it('should convert money factor to APR', () => {
      expect(moneyFactorToAPR(0.00417)).toBeCloseTo(10.008, 2);
      expect(moneyFactorToAPR(0.009996)).toBeCloseTo(23.99, 1);
    });
  });

  describe('aprToMoneyFactor', () => {
    it('should convert APR to money factor', () => {
      expect(aprToMoneyFactor(10)).toBeCloseTo(0.00417, 4);
      expect(aprToMoneyFactor(24)).toBeCloseTo(0.01, 2);
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
      expect(calculateNumberOfPayments(36, 'semimonthly')).toBe(72);
      expect(calculateNumberOfPayments(36, 'biweekly')).toBe(78);
      expect(calculateNumberOfPayments(36, 'weekly')).toBe(156);
    });
  });

  describe('calculateAmortizedPayment', () => {
    it('should calculate standard loan amortization correctly', () => {
      // $10,000 at 12% for 12 monthly payments = ~$888.49/month
      const payment = calculateAmortizedPayment(10000, 0.12, 12, 12);
      expect(payment).toBeCloseTo(888.49, 0);
    });

    it('should handle 0% interest', () => {
      const payment = calculateAmortizedPayment(12000, 0, 12, 12);
      expect(payment).toBe(1000);
    });

    it('should calculate weekly payments correctly', () => {
      // $10,000 at 12% for 52 weekly payments
      const payment = calculateAmortizedPayment(10000, 0.12, 52, 52);
      expect(payment).toBeGreaterThan(0);
    });
  });
});

describe('Lease Calculation Functions', () => {
  describe('calculateDepreciation', () => {
    it('should calculate depreciation correctly', () => {
      const depreciation = calculateDepreciation(20000, 5000);
      expect(depreciation).toBe(15000);
    });
  });

  describe('calculateRentCharge', () => {
    it('should calculate rent charge correctly', () => {
      // rentCharge = (adjustedCap + residual) * MF * term
      const rentCharge = calculateRentCharge(20000, 5000, 36);
      // (20000 + 5000) * 0.009996 * 36 = 8996.4
      expect(rentCharge).toBeCloseTo(8996.4, 1);
    });
  });

  describe('reverseCalculateAdjustedCap', () => {
    it('should reverse calculate adjusted cap from base payment (monthly)', () => {
      const adjustedCap = 20000;
      const residual = 5000;
      const term = 36;
      const numPayments = 36; // monthly

      // Forward calculate base payment
      const depreciation = calculateDepreciation(adjustedCap, residual);
      const rentCharge = calculateRentCharge(adjustedCap, residual, term);
      const basePayment = (depreciation + rentCharge) / numPayments;

      // Reverse calculate should give us back the adjusted cap
      const calculatedAdjustedCap = reverseCalculateAdjustedCap(basePayment, residual, term, numPayments);
      expect(calculatedAdjustedCap).toBeCloseTo(adjustedCap, 0);
    });
  });
});

describe('calculateDeal', () => {
  it('should calculate a basic monthly deal correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    // Residual = ACV * 15% = $1,500
    expect(deal.residualValue).toBe(1500);

    // Total of payments = ACV * 2 = $20,000
    expect(deal.totalOfPayments).toBe(20000);

    // Number of payments = 36 (monthly)
    expect(deal.numberOfPayments).toBe(36);

    // Base payment = 20000 / 36 = $555.56
    expect(deal.basePayment).toBeCloseTo(555.56, 2);

    // Frequency label
    expect(deal.paymentFrequencyLabel).toBe('Monthly');
  });

  it('should calculate a biweekly deal correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    // Number of payments = 36 * (26/12) = 78
    expect(deal.numberOfPayments).toBe(78);

    // Base payment = 20000 / 78 = ~$256.41
    expect(deal.basePayment).toBeCloseTo(256.41, 2);

    // Monthly equivalent should be ~$555.56
    expect(deal.basePaymentMonthlyEquivalent).toBeCloseTo(555.56, 0);

    expect(deal.paymentFrequencyLabel).toBe('Bi-Weekly');
  });

  it('should calculate a weekly deal correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'weekly',
    });

    // Number of payments = 36 * (52/12) = 156
    expect(deal.numberOfPayments).toBe(156);

    // Base payment = 20000 / 156 = ~$128.21
    expect(deal.basePayment).toBeCloseTo(128.21, 2);

    expect(deal.paymentFrequencyLabel).toBe('Weekly');
  });

  it('should calculate different state taxes correctly', () => {
    const tnDeal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const msDeal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'MS',
      paymentFrequency: 'monthly',
    });

    expect(tnDeal.taxRate).toBe(0.095);
    expect(msDeal.taxRate).toBe(0.05);
    expect(tnDeal.salesTax).toBeGreaterThan(msDeal.salesTax);
  });

  it('should have consistent total payments across frequencies', () => {
    const monthly = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const biweekly = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    const weekly = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'weekly',
    });

    // Total of payments should be the same regardless of frequency
    expect(monthly.totalOfPayments).toBe(biweekly.totalOfPayments);
    expect(biweekly.totalOfPayments).toBe(weekly.totalOfPayments);
  });
});

describe('validateDeal', () => {
  it('should pass validation for a good monthly deal', () => {
    // $8,000 ACV at 36 months satisfies all constraints:
    // - Spread >= $150 ($176.81), Markup <= $5,000 ($4,330.73), Base payment >= $300 ($444.44)
    const deal = calculateDeal({
      acv: 8000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const result = validateDeal(deal);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass validation for a good biweekly deal', () => {
    // $12,000 ACV at 48 months satisfies all constraints
    const deal = calculateDeal({
      acv: 12000,
      termMonths: 48,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    const result = validateDeal(deal);
    expect(result.isValid).toBe(true);
  });

  it('should fail validation when monthly equivalent payment is below minimum', () => {
    // Low ACV with long term = low monthly equivalent
    const deal = calculateDeal({
      acv: 5000,
      termMonths: 48,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'monthly',
    });

    const result = validateDeal(deal);
    expect(result.isValid).toBe(false);

    const paymentError = result.errors.find(e => e.field === 'basePayment');
    expect(paymentError).toBeDefined();
  });
});

describe('findMaxTermForMinPayment', () => {
  it('should find maximum term for monthly frequency', () => {
    const maxTerm = findMaxTermForMinPayment(10000, 'monthly');
    expect(maxTerm).toBeDefined();
    expect(maxTerm).toBeLessThanOrEqual(72);
  });

  it('should find same effective max term for biweekly', () => {
    const monthlyMax = findMaxTermForMinPayment(10000, 'monthly');
    const biweeklyMax = findMaxTermForMinPayment(10000, 'biweekly');

    // Should be the same since we're checking monthly equivalents
    expect(monthlyMax).toBe(biweeklyMax);
  });
});

describe('findMinTermForMinSpread', () => {
  it('should find minimum term that achieves minimum spread', () => {
    const minTerm = findMinTermForMinSpread(10000, 'monthly');
    expect(minTerm).toBeDefined();

    if (minTerm) {
      const deal = calculateDeal({
        acv: 10000,
        termMonths: minTerm,
        docFee: 499,
        state: 'TN',
        paymentFrequency: 'monthly',
      });
      expect(deal.monthlySpreadEquivalent).toBeGreaterThanOrEqual(MIN_SPREAD);
    }
  });
});

describe('Real World Scenarios', () => {
  it('should calculate a typical biweekly used car lease', () => {
    // $12,000 used car, 48 month lease, biweekly, TN
    // This combination satisfies all constraints
    const deal = calculateDeal({
      acv: 12000,
      termMonths: 48,
      docFee: 499,
      state: 'TN',
      paymentFrequency: 'biweekly',
    });

    // Total payments should be $24,000
    expect(deal.totalOfPayments).toBe(24000);

    // 104 biweekly payments (48 months * 26/12)
    expect(deal.numberOfPayments).toBe(104);

    // Validate the deal
    const validation = validateDeal(deal);
    expect(validation.isValid).toBe(true);

    console.log('Typical Biweekly Used Car Lease ($12,000 ACV, 48mo, TN):');
    console.log(`  Payment Frequency: ${deal.paymentFrequencyLabel}`);
    console.log(`  Number of Payments: ${deal.numberOfPayments}`);
    console.log(`  Residual Value: $${deal.residualValue}`);
    console.log(`  Agreed Price: $${deal.agreedPrice.toFixed(2)}`);
    console.log(`  Base Payment: $${deal.basePayment.toFixed(2)}`);
    console.log(`  Monthly Equivalent: $${deal.basePaymentMonthlyEquivalent.toFixed(2)}`);
    console.log(`  Markup: $${deal.markup.toFixed(2)}`);
    console.log(`  Tax/Payment: $${deal.taxPerPayment.toFixed(2)}`);
    console.log(`  Total Payment: $${deal.totalPayment.toFixed(2)}`);
    console.log(`  Due at Signing: $${deal.amountDueAtSigning.toFixed(2)}`);
    console.log(`  Spread (per payment): $${deal.spread.toFixed(2)}`);
    console.log(`  Monthly Spread Equiv: $${deal.monthlySpreadEquivalent.toFixed(2)}`);
  });

  it('should calculate a weekly lease', () => {
    // $5,000 vehicle, 12 month lease, weekly, MS
    // This combination satisfies all constraints
    const deal = calculateDeal({
      acv: 5000,
      termMonths: 12,
      docFee: 499,
      state: 'MS',
      paymentFrequency: 'weekly',
    });

    // 52 weekly payments (12 months * 52/12)
    expect(deal.numberOfPayments).toBe(52);

    // Validate the deal
    const validation = validateDeal(deal);
    expect(validation.isValid).toBe(true);

    console.log('\nWeekly Lease ($5,000 ACV, 12mo, MS):');
    console.log(`  Payment Frequency: ${deal.paymentFrequencyLabel}`);
    console.log(`  Number of Payments: ${deal.numberOfPayments}`);
    console.log(`  Base Payment: $${deal.basePayment.toFixed(2)}`);
    console.log(`  Monthly Equivalent: $${deal.basePaymentMonthlyEquivalent.toFixed(2)}`);
    console.log(`  Markup: $${deal.markup.toFixed(2)}`);
    console.log(`  Total Payment: $${deal.totalPayment.toFixed(2)}`);
    console.log(`  Monthly Spread Equiv: $${deal.monthlySpreadEquivalent.toFixed(2)}`);
  });
});
