import { useState, useMemo } from 'react';
import {
  calculateDeal,
  validateDeal,
  formatCurrency,
  type DealCalculation,
  type ValidationResult,
} from '../utils/calculations';
import { TAX_RATES, type SupportedState } from '../utils/constants';

interface FormState {
  state: SupportedState;
  acv: string;
  termMonths: string;
  docFee: string;
}

const STATES: { value: SupportedState; label: string }[] = [
  { value: 'TN', label: 'Tennessee' },
  { value: 'MS', label: 'Mississippi' },
];

export function DealCalculator() {
  const [form, setForm] = useState<FormState>({
    state: 'TN',
    acv: '',
    termMonths: '',
    docFee: '499',
  });

  // Parse form values
  const acv = parseFloat(form.acv.replace(/[^0-9.]/g, '')) || 0;
  const termMonths = parseInt(form.termMonths, 10) || 0;
  const docFee = parseFloat(form.docFee.replace(/[^0-9.]/g, '')) || 0;

  // Calculate deal when we have valid inputs
  const calculation = useMemo<DealCalculation | null>(() => {
    if (acv > 0 && termMonths > 0 && termMonths <= 48) {
      return calculateDeal({
        acv,
        termMonths,
        docFee,
        state: form.state,
      });
    }
    return null;
  }, [acv, termMonths, docFee, form.state]);

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
  const handleCurrencyBlur = (field: 'acv' | 'docFee') => () => {
    const value = parseFloat(form[field].replace(/[^0-9.]/g, '')) || 0;
    if (value > 0) {
      setForm((prev) => ({ ...prev, [field]: value.toFixed(2) }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white py-6 shadow-lg">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold">Car World Lease Calculator</h1>
          <p className="text-blue-200 mt-1">Dealer Partner Portal</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Deal Information</h2>

            <div className="space-y-5">
              {/* State */}
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <select
                  id="state"
                  value={form.state}
                  onChange={handleInputChange('state')}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                >
                  {STATES.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Tax Rate: {(TAX_RATES[form.state] * 100).toFixed(2)}%
                </p>
              </div>

              {/* ACV */}
              <div>
                <label htmlFor="acv" className="block text-sm font-medium text-gray-700 mb-1">
                  ACV (Actual Cash Value)
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
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Vehicle purchase price</p>
              </div>

              {/* Term */}
              <div>
                <label htmlFor="term" className="block text-sm font-medium text-gray-700 mb-1">
                  Term (Months)
                </label>
                <input
                  id="term"
                  type="number"
                  min="1"
                  max="48"
                  value={form.termMonths}
                  onChange={handleInputChange('termMonths')}
                  placeholder="36"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">1-48 months</p>
              </div>

              {/* Doc Fee */}
              <div>
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
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Calculations */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Payment Breakdown</h2>

            {!calculation ? (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
                <p>Enter deal information to see calculations</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Validation Status */}
                {validation && (
                  <div
                    className={`p-4 rounded-lg ${
                      validation.isValid
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {validation.isValid ? (
                        <>
                          <svg
                            className="h-5 w-5 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="font-medium text-green-800">Deal Valid</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-5 w-5 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <span className="font-medium text-red-800">Validation Failed</span>
                        </>
                      )}
                    </div>
                    {!validation.isValid && (
                      <ul className="mt-2 text-sm text-red-700 space-y-1">
                        {validation.errors.map((error, idx) => (
                          <li key={idx}>
                            {error.message}
                            {error.suggestedValue && (
                              <span className="font-medium">
                                {' '}
                                Try {error.suggestedValue} months or less.
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Primary Payment Info */}
                <div className="bg-blue-900 text-white rounded-lg p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-blue-200 text-sm">Base Payment</p>
                      <p className="text-3xl font-bold">
                        {formatCurrency(calculation.basePayment)}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-200 text-sm">Total Payment</p>
                      <p className="text-3xl font-bold">
                        {formatCurrency(calculation.totalPayment)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-700">
                    <p className="text-blue-200 text-sm">Due at Signing</p>
                    <p className="text-2xl font-semibold">
                      {formatCurrency(calculation.amountDueAtSigning)}
                    </p>
                  </div>
                </div>

                {/* Calculation Details */}
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-700 border-b pb-2">Deal Structure</h3>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="text-gray-600">Agreed Price</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.agreedPrice)}
                    </div>

                    <div className="text-gray-600">Residual Value (15%)</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.residualValue)}
                    </div>

                    <div className="text-gray-600">Depreciation</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.depreciation)}
                    </div>

                    <div className="text-gray-600">Rent Charge</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.rentCharge)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-gray-700 border-b pb-2">Payment Details</h3>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="text-gray-600">Number of Payments</div>
                    <div className="text-right font-medium text-gray-900">
                      {calculation.numberOfPayments}
                    </div>

                    <div className="text-gray-600">Tax per Payment</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.taxPerPayment)}
                    </div>

                    <div className="text-gray-600">Total of Payments</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.totalOfPayments)}
                    </div>

                    <div className="text-gray-600">Total Sales Tax</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.salesTax)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-gray-700 border-b pb-2">Profitability</h3>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="text-gray-600">Investor Payment</div>
                    <div className="text-right font-medium text-gray-900">
                      {formatCurrency(calculation.investorPayment)}
                    </div>

                    <div className="text-gray-600">Spread</div>
                    <div
                      className={`text-right font-bold ${
                        calculation.spread >= 150 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(calculation.spread)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          Car World Dealer Partner Portal &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
