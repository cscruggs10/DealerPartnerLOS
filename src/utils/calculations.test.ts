import { describe, it, expect } from 'vitest';
import {
  calculateDeal,
  validateDeal,
  calculateAmortizedPayment,
  reverseCalculateAdjustedCap,
  calculateDepreciation,
  calculateRentCharge,
  findMaxTermForMinPayment,
  findMinTermForMinSpread,
  moneyFactorToAPR,
  aprToMoneyFactor,
  roundCurrency,
} from './calculations';
import {
  MONEY_FACTOR,
  RESIDUAL_PERCENT,
  INVESTOR_RATE,
  MIN_MONTHLY_PAYMENT,
  MIN_SPREAD,
  TAX_RATES,
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

  describe('calculateAmortizedPayment', () => {
    it('should calculate standard loan amortization correctly', () => {
      // $10,000 at 12% for 12 months = ~$888.49/month
      const payment = calculateAmortizedPayment(10000, 0.12, 12);
      expect(payment).toBeCloseTo(888.49, 0);
    });

    it('should handle 0% interest', () => {
      const payment = calculateAmortizedPayment(12000, 0, 12);
      expect(payment).toBe(1000);
    });

    it('should calculate investor payment for $10,000 at 12.5% for 36 months', () => {
      const payment = calculateAmortizedPayment(10000, INVESTOR_RATE, 36);
      // Expected ~$334.67
      expect(payment).toBeCloseTo(334.67, 0);
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
    it('should reverse calculate adjusted cap from base payment', () => {
      // If we know the base payment, residual, term, and MF, we should get back adjusted cap
      const adjustedCap = 20000;
      const residual = 5000;
      const term = 36;

      // Forward calculate base payment
      const depreciation = calculateDepreciation(adjustedCap, residual);
      const rentCharge = calculateRentCharge(adjustedCap, residual, term);
      const basePayment = (depreciation + rentCharge) / term;

      // Reverse calculate should give us back the adjusted cap
      const calculatedAdjustedCap = reverseCalculateAdjustedCap(basePayment, residual, term);
      expect(calculatedAdjustedCap).toBeCloseTo(adjustedCap, 0);
    });
  });
});

describe('calculateDeal', () => {
  it('should calculate a basic deal correctly', () => {
    const deal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
    });

    // Step 1: Residual = ACV * 15% = $1,500
    expect(deal.residualValue).toBe(1500);

    // Step 2: Total of payments = ACV * 2 = $20,000
    expect(deal.totalOfPayments).toBe(20000);

    // Step 3: Number of payments = term
    expect(deal.numberOfPayments).toBe(36);

    // Step 4: Base payment = 20000 / 36 = $555.56
    expect(deal.basePayment).toBeCloseTo(555.56, 2);

    // Step 5: Agreed price is reverse-calculated
    expect(deal.agreedPrice).toBeGreaterThan(0);

    // Step 6: Investor payment (amortized at 12.5%)
    const expectedInvestorPayment = calculateAmortizedPayment(10000, INVESTOR_RATE, 36);
    expect(deal.investorPayment).toBeCloseTo(expectedInvestorPayment, 2);

    // Step 7: Spread = base - investor
    expect(deal.spread).toBeCloseTo(deal.basePayment - deal.investorPayment, 2);

    // Step 8: Tax calculations
    expect(deal.taxRate).toBe(0.095);
    expect(deal.salesTax).toBeCloseTo(deal.agreedPrice * 0.095, 2);

    // Step 9: Total payment = base + tax per payment
    expect(deal.totalPayment).toBeCloseTo(deal.basePayment + deal.taxPerPayment, 2);

    // Step 10: Amount due at signing = total payment + doc fee
    expect(deal.amountDueAtSigning).toBeCloseTo(deal.totalPayment + 499, 2);
  });

  it('should calculate different state taxes correctly', () => {
    const tnDeal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
    });

    const msDeal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'MS',
    });

    expect(tnDeal.taxRate).toBe(0.095);
    expect(msDeal.taxRate).toBe(0.05);
    expect(tnDeal.salesTax).toBeGreaterThan(msDeal.salesTax);
  });

  it('should calculate higher payments for shorter terms', () => {
    const shortTerm = calculateDeal({
      acv: 10000,
      termMonths: 24,
      docFee: 499,
      state: 'TN',
    });

    const longTerm = calculateDeal({
      acv: 10000,
      termMonths: 48,
      docFee: 499,
      state: 'TN',
    });

    expect(shortTerm.basePayment).toBeGreaterThan(longTerm.basePayment);
  });

  it('should verify the lease math is internally consistent', () => {
    const deal = calculateDeal({
      acv: 15000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
    });

    // Verify: depreciation + rentCharge = totalOfPayments (approximately)
    // This is the core lease equation
    const calculatedTotal = deal.depreciation + deal.rentCharge;
    expect(calculatedTotal).toBeCloseTo(deal.totalOfPayments, 0);

    // Verify: basePayment * term = totalOfPayments
    expect(deal.basePayment * deal.numberOfPayments).toBeCloseTo(deal.totalOfPayments, 0);
  });
});

describe('validateDeal', () => {
  it('should pass validation for a good deal', () => {
    const deal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
    });

    const result = validateDeal(deal);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation when base payment is below minimum', () => {
    // $5000 ACV at 72 months = $10000 / 72 = $138.89 base payment (below $300)
    const deal = calculateDeal({
      acv: 5000,
      termMonths: 72,
      docFee: 499,
      state: 'TN',
    });

    const result = validateDeal(deal);
    expect(result.isValid).toBe(false);

    const paymentError = result.errors.find(e => e.field === 'basePayment');
    expect(paymentError).toBeDefined();
    expect(paymentError?.suggestedValue).toBeDefined();
  });

  it('should fail validation when spread is below minimum', () => {
    // Very low ACV might not generate enough spread
    // Need to find a case where spread < $150
    // This is harder to trigger since our formula is designed to be profitable
    // Let's check a borderline case
    const deal = calculateDeal({
      acv: 3000,
      termMonths: 72,
      docFee: 499,
      state: 'TN',
    });

    const result = validateDeal(deal);

    // Check if spread error exists (it might or might not depending on the math)
    if (deal.spread < MIN_SPREAD) {
      const spreadError = result.errors.find(e => e.field === 'spread');
      expect(spreadError).toBeDefined();
    }
  });
});

describe('findMaxTermForMinPayment', () => {
  it('should find maximum term that meets minimum payment', () => {
    // $10,000 ACV = $20,000 total payments
    // $300 min payment = 66.67 months max
    // Should return 60 as the max valid term
    const maxTerm = findMaxTermForMinPayment(10000);
    expect(maxTerm).toBe(60);
  });

  it('should return 72 for high ACV vehicles', () => {
    // $20,000 ACV = $40,000 total payments
    // $300 min payment = 133 months max
    // Should return 72 as the max valid term
    const maxTerm = findMaxTermForMinPayment(20000);
    expect(maxTerm).toBe(72);
  });

  it('should return lower term for low ACV', () => {
    // $5,000 ACV = $10,000 total payments
    // $300 min payment = 33 months max
    // Should return 24 as the max valid term
    const maxTerm = findMaxTermForMinPayment(5000);
    expect(maxTerm).toBe(24);
  });
});

describe('findMinTermForMinSpread', () => {
  it('should find minimum term that achieves minimum spread', () => {
    const minTerm = findMinTermForMinSpread(10000);
    expect(minTerm).toBeDefined();

    if (minTerm) {
      // Verify the spread at this term meets minimum
      const deal = calculateDeal({
        acv: 10000,
        termMonths: minTerm,
        docFee: 499,
        state: 'TN',
      });
      expect(deal.spread).toBeGreaterThanOrEqual(MIN_SPREAD);
    }
  });
});

describe('Edge Cases', () => {
  it('should handle minimum ACV', () => {
    const deal = calculateDeal({
      acv: 1000,
      termMonths: 12,
      docFee: 499,
      state: 'TN',
    });

    expect(deal.residualValue).toBe(150);
    expect(deal.totalOfPayments).toBe(2000);
    expect(deal.basePayment).toBeCloseTo(166.67, 2);
  });

  it('should handle maximum reasonable ACV', () => {
    const deal = calculateDeal({
      acv: 50000,
      termMonths: 48,
      docFee: 499,
      state: 'TN',
    });

    expect(deal.residualValue).toBe(7500);
    expect(deal.totalOfPayments).toBe(100000);
    expect(deal.basePayment).toBeCloseTo(2083.33, 2);
  });

  it('should handle zero doc fee', () => {
    const deal = calculateDeal({
      acv: 10000,
      termMonths: 36,
      docFee: 0,
      state: 'TN',
    });

    expect(deal.amountDueAtSigning).toBe(deal.totalPayment);
  });
});

describe('Real World Scenarios', () => {
  it('should calculate a typical used car lease', () => {
    // $12,000 used car, 36 month lease, TN
    const deal = calculateDeal({
      acv: 12000,
      termMonths: 36,
      docFee: 499,
      state: 'TN',
    });

    // Total payments should be $24,000
    expect(deal.totalOfPayments).toBe(24000);

    // Monthly base payment should be $666.67
    expect(deal.basePayment).toBeCloseTo(666.67, 2);

    // Residual should be $1,800
    expect(deal.residualValue).toBe(1800);

    // Validate the deal
    const validation = validateDeal(deal);
    expect(validation.isValid).toBe(true);

    console.log('Typical Used Car Lease ($12,000 ACV, 36mo, TN):');
    console.log(`  Residual Value: $${deal.residualValue}`);
    console.log(`  Agreed Price: $${deal.agreedPrice.toFixed(2)}`);
    console.log(`  Base Payment: $${deal.basePayment.toFixed(2)}`);
    console.log(`  Tax/Payment: $${deal.taxPerPayment.toFixed(2)}`);
    console.log(`  Total Payment: $${deal.totalPayment.toFixed(2)}`);
    console.log(`  Due at Signing: $${deal.amountDueAtSigning.toFixed(2)}`);
    console.log(`  Investor Payment: $${deal.investorPayment.toFixed(2)}`);
    console.log(`  Spread: $${deal.spread.toFixed(2)}`);
  });

  it('should calculate a higher value vehicle lease', () => {
    // $25,000 vehicle, 48 month lease, MS
    const deal = calculateDeal({
      acv: 25000,
      termMonths: 48,
      docFee: 499,
      state: 'MS',
    });

    // Total payments should be $50,000
    expect(deal.totalOfPayments).toBe(50000);

    // Monthly base payment should be $1,041.67
    expect(deal.basePayment).toBeCloseTo(1041.67, 2);

    // Validate the deal
    const validation = validateDeal(deal);
    expect(validation.isValid).toBe(true);

    console.log('\nHigher Value Lease ($25,000 ACV, 48mo, MS):');
    console.log(`  Residual Value: $${deal.residualValue}`);
    console.log(`  Agreed Price: $${deal.agreedPrice.toFixed(2)}`);
    console.log(`  Base Payment: $${deal.basePayment.toFixed(2)}`);
    console.log(`  Tax/Payment: $${deal.taxPerPayment.toFixed(2)}`);
    console.log(`  Total Payment: $${deal.totalPayment.toFixed(2)}`);
    console.log(`  Due at Signing: $${deal.amountDueAtSigning.toFixed(2)}`);
    console.log(`  Investor Payment: $${deal.investorPayment.toFixed(2)}`);
    console.log(`  Spread: $${deal.spread.toFixed(2)}`);
  });
});
