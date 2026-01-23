import { useState, useMemo, useEffect } from 'react';
import {
  calculateDeal,
  validateDeal,
  calculateOptimalTerm,
  formatCurrency,
  type DealCalculation,
  type ValidationResult,
} from '../utils/calculations';
import {
  TAX_RATES,
  PAYMENT_FREQUENCIES,
  MIN_SPREAD,
  MAX_MARKUP,
  MAX_TERM_MONTHS,
  type SupportedState,
  type PaymentFrequency,
} from '../utils/constants';
import { downloadLeaseDocument } from '../utils/documentGenerator';

interface FormState {
  state: SupportedState;
  acv: string;
  termMonths: string;
  docFee: string;
  downPayment: string;
  paymentFrequency: PaymentFrequency;
}

const STATES: { value: SupportedState; label: string }[] = [
  { value: 'TN', label: 'Tennessee' },
  { value: 'MS', label: 'Mississippi' },
];

const FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'semimonthly', label: 'Semi-Monthly' },
  { value: 'monthly', label: 'Monthly' },
];

export function DealCalculator() {
  const [form, setForm] = useState<FormState>({
    state: 'TN',
    acv: '',
    termMonths: '',
    docFee: '499',
    downPayment: '0',
    paymentFrequency: 'biweekly',
  });

  const [autoTermApplied, setAutoTermApplied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Parse form values
  const acv = parseFloat(form.acv.replace(/[^0-9.]/g, '')) || 0;
  const termMonths = parseInt(form.termMonths, 10) || 0;
  const docFee = parseFloat(form.docFee.replace(/[^0-9.]/g, '')) || 0;
  const downPayment = parseFloat(form.downPayment.replace(/[^0-9.]/g, '')) || 0;

  // Auto-calculate optimal term when ACV changes
  useEffect(() => {
    if (acv > 0 && docFee >= 0 && !autoTermApplied) {
      const optimal = calculateOptimalTerm(acv, docFee, form.state, form.paymentFrequency);
      if (optimal.term > 0) {
        setForm(prev => ({ ...prev, termMonths: optimal.term.toString() }));
        setAutoTermApplied(true);
      }
    }
  }, [acv, docFee, form.state, form.paymentFrequency, autoTermApplied]);

  // Reset auto-term flag when ACV changes significantly
  useEffect(() => {
    setAutoTermApplied(false);
  }, [form.acv]);

  // Calculate deal when we have valid inputs
  const calculation = useMemo<DealCalculation | null>(() => {
    if (acv > 0 && termMonths > 0 && termMonths <= MAX_TERM_MONTHS) {
      return calculateDeal({
        acv,
        termMonths,
        docFee,
        state: form.state,
        paymentFrequency: form.paymentFrequency,
        downPayment,
      });
    }
    return null;
  }, [acv, termMonths, docFee, form.state, form.paymentFrequency, downPayment]);

  // Validate deal
  const validation = useMemo<ValidationResult | null>(() => {
    if (calculation) {
      return validateDeal(calculation);
    }
    return null;
  }, [calculation]);

  const handleInputChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Format currency input on blur
  const handleCurrencyBlur = (field: 'acv' | 'docFee' | 'downPayment') => () => {
    const value = parseFloat(form[field].replace(/[^0-9.]/g, '')) || 0;
    if (value >= 0) {
      setForm((prev) => ({ ...prev, [field]: value.toFixed(2) }));
    }
  };

  // Generate contract document
  const handleGenerateContract = async () => {
    if (!calculation || !validation?.isValid) return;

    setIsGenerating(true);
    try {
      await downloadLeaseDocument(calculation);
    } catch (error) {
      console.error('Failed to generate document:', error);
      alert('Failed to generate document. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const validRange = validation?.validTermRange;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white py-5 shadow-lg">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold">Car World Lease Calculator</h1>
          <p className="text-blue-200 text-sm mt-1">Dealer Partner Portal</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Form */}
          <div className="space-y-6">
            {/* Deal Information */}
            <div className="bg-white rounded-lg shadow-md p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Deal Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* State */}
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <select
                    id="state"
                    value={form.state}
                    onChange={handleInputChange('state')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  >
                    {STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Tax: {(TAX_RATES[form.state] * 100).toFixed(2)}%
                  </p>
                </div>

                {/* Payment Frequency */}
                <div>
                  <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
                    Pay Frequency
                  </label>
                  <select
                    id="frequency"
                    value={form.paymentFrequency}
                    onChange={handleInputChange('paymentFrequency')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {PAYMENT_FREQUENCIES[form.paymentFrequency].paymentsPerYear}/year
                  </p>
                </div>

                {/* ACV */}
                <div>
                  <label htmlFor="acv" className="block text-sm font-medium text-gray-700 mb-1">
                    ACV (Lender Cost)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id="acv"
                      type="text"
                      inputMode="decimal"
                      value={form.acv}
                      onChange={handleInputChange('acv')}
                      onBlur={handleCurrencyBlur('acv')}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                {/* Down Payment */}
                <div>
                  <label htmlFor="downPayment" className="block text-sm font-medium text-gray-700 mb-1">
                    Down Payment
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id="downPayment"
                      type="text"
                      inputMode="decimal"
                      value={form.downPayment}
                      onChange={handleInputChange('downPayment')}
                      onBlur={handleCurrencyBlur('downPayment')}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                {/* Doc Fee */}
                <div className="md:col-span-2">
                  <label htmlFor="docFee" className="block text-sm font-medium text-gray-700 mb-1">
                    Dealer Doc Fee
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id="docFee"
                      type="text"
                      inputMode="decimal"
                      value={form.docFee}
                      onChange={handleInputChange('docFee')}
                      onBlur={handleCurrencyBlur('docFee')}
                      placeholder="499.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lease Term */}
            <div className="bg-white rounded-lg shadow-md p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Lease Term
              </h2>

              <div>
                <label htmlFor="term" className="block text-sm font-medium text-gray-700 mb-1">
                  Term (Months)
                </label>
                <input
                  id="term"
                  type="number"
                  min="1"
                  max={MAX_TERM_MONTHS}
                  value={form.termMonths}
                  onChange={handleInputChange('termMonths')}
                  placeholder="Auto-calculated"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-lg font-medium"
                />
                {validRange && validRange.min > 0 && (
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    Valid range: {validRange.min} - {validRange.max} months
                  </p>
                )}
                {validRange && validRange.min === 0 && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    No valid term range for this ACV
                  </p>
                )}
                {!validRange && acv > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Max: {MAX_TERM_MONTHS} months
                  </p>
                )}
              </div>
            </div>

            {/* Validation Status */}
            {validation && (
              <div
                className={`rounded-lg p-4 ${
                  validation.isValid
                    ? 'bg-green-50 border-2 border-green-400'
                    : 'bg-red-50 border-2 border-red-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {validation.isValid ? (
                    <>
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-bold text-green-800 text-lg">Deal Approved</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="font-bold text-red-800 text-lg">Deal Not Valid</span>
                    </>
                  )}
                </div>
                {!validation.isValid && (
                  <ul className="mt-2 text-sm text-red-700 space-y-1">
                    {validation.errors.map((error, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-red-500">•</span>
                        <span>
                          {error.message}
                          {error.suggestedValue && (
                            <span className="font-semibold"> Try {error.suggestedValue} months.</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Generate Contract Button */}
            <button
              onClick={handleGenerateContract}
              disabled={!validation?.isValid || isGenerating}
              className={`w-full py-4 px-6 rounded-lg font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                validation?.isValid && !isGenerating
                  ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Contract
                </>
              )}
            </button>
          </div>

          {/* Right Side - Calculations */}
          <div className="space-y-6">
            {!calculation ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
                <svg
                  className="mx-auto h-16 w-16 text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-lg">Enter ACV to see calculations</p>
                <p className="text-sm text-gray-400 mt-1">Term will auto-calculate for optimal spread</p>
              </div>
            ) : (
              <>
                {/* Payment Summary */}
                <div className="bg-blue-800 text-white rounded-lg shadow-lg p-5">
                  <h3 className="text-sm font-medium text-blue-200 mb-3 uppercase tracking-wide">
                    Payment Summary ({calculation.paymentFrequencyLabel})
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-blue-200">Base Payment</span>
                      <span className="text-2xl font-bold">{formatCurrency(calculation.basePayment)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-blue-200">Tax per Payment</span>
                      <span className="text-lg">{formatCurrency(calculation.taxPerPayment)}</span>
                    </div>
                    <div className="border-t border-blue-600 pt-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-blue-100 font-medium">TOTAL PAYMENT</span>
                        <span className="text-3xl font-bold text-white">{formatCurrency(calculation.totalPayment)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deal Structure */}
                <div className="bg-white rounded-lg shadow-md p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    Deal Structure
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Agreed Price</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.agreedPrice)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Residual Value (15%)</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.residualValue)}</span>
                    </div>
                    <div className="flex justify-between py-1 items-center">
                      <span className="text-gray-600 flex items-center gap-1">
                        Markup
                        {calculation.markup > MAX_MARKUP * 0.9 && calculation.markup <= MAX_MARKUP && (
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className={`font-semibold ${calculation.markup > MAX_MARKUP ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatCurrency(calculation.markup)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-t pt-2">
                      <span className="text-gray-600">Total of Payments</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.totalOfPayments)}</span>
                    </div>
                    <div className="flex justify-between py-1 bg-gray-50 -mx-5 px-5 mt-2">
                      <span className="text-gray-700 font-medium">Due at Signing</span>
                      <span className="font-bold text-gray-900">{formatCurrency(calculation.amountDueAtSigning)}</span>
                    </div>
                  </div>
                </div>

                {/* Down Payment Split */}
                {calculation.downPayment > 0 && (
                  <div className="bg-white rounded-lg shadow-md p-5">
                    <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                      Down Payment Split
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">Customer Down Payment</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(calculation.downPayment)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">Dealer Share (75%)</span>
                        <span className="font-semibold text-green-600">{formatCurrency(calculation.downPaymentDealerShare)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">Car World Share (25%)</span>
                        <span className="font-semibold text-blue-600">{formatCurrency(calculation.downPaymentCarWorldShare)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lender Metrics */}
                <details className="bg-white rounded-lg shadow-md">
                  <summary className="p-5 cursor-pointer text-sm font-semibold text-gray-600 uppercase tracking-wide hover:bg-gray-50 rounded-lg">
                    Lender Metrics
                  </summary>
                  <div className="px-5 pb-5 space-y-2 text-sm border-t">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">ACV Recovery (50%)</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.acvRecovery)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Investor Payment</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.investorPayment)}</span>
                    </div>
                    <div className="flex justify-between py-2 bg-gray-50 -mx-5 px-5 rounded-b-lg">
                      <span className="text-gray-700 font-medium">SPREAD (per payment)</span>
                      <span className={`font-bold text-lg ${calculation.monthlySpreadEquivalent >= MIN_SPREAD ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(calculation.spread)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 text-xs text-gray-500">
                      <span>Monthly Equivalent Spread</span>
                      <span>{formatCurrency(calculation.monthlySpreadEquivalent)}</span>
                    </div>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t mt-8 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-500">
          Car World Dealer Partner Portal &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
