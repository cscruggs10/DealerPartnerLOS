import { useState, useMemo, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
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
  MAX_TERM,
  DOC_FEE,
  type SupportedState,
  type PaymentFrequency,
} from '../utils/constants';
import { downloadLeasePDF } from '../utils/pdfGenerator';
import { decodeVIN, type VehicleInfo } from '../utils/vinDecoder';

interface FormState {
  state: SupportedState;
  acv: string;
  termMonths: string;
  docFee: string;
  downPayment: string;
  paymentReduction: string;
  paymentFrequency: PaymentFrequency;
}

interface VehicleState {
  vin: string;
  odometer: string;
  year: string;
  make: string;
  model: string;
  bodyStyle: string;
}

interface CustomerState {
  lesseeName: string;
  lesseeAddress: string;
  lesseeCity: string;
  lesseeState: string;
  lesseeZip: string;
  lesseePhone: string;
  coLesseeName: string;
  coLesseeAddress: string;
  coLesseeCity: string;
  coLesseeState: string;
  coLesseeZip: string;
  coLesseePhone: string;
}

export interface ContractData {
  calculation: DealCalculation;
  vehicle: VehicleState;
  customer: CustomerState;
  firstPaymentDate: string;
  dealerProfile?: { name: string; address: string };
}

const STATES: { value: SupportedState; label: string }[] = [
  { value: 'TN', label: 'Tennessee' },
  { value: 'MS', label: 'Mississippi' },
];

const FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

interface DealCalculatorProps {
  dealerProfile?: { name: string; address: string };
  onBack?: () => void;
}

export function DealCalculator({ dealerProfile, onBack }: DealCalculatorProps = {}) {
  const { user } = useUser();
  const [form, setForm] = useState<FormState>({
    state: 'TN',
    acv: '',
    termMonths: '',
    docFee: DOC_FEE.toFixed(2),
    downPayment: '0',
    paymentReduction: '0',
    paymentFrequency: 'biweekly',
  });

  const [vehicle, setVehicle] = useState<VehicleState>({
    vin: '',
    odometer: '',
    year: '',
    make: '',
    model: '',
    bodyStyle: '',
  });

  const [customer, setCustomer] = useState<CustomerState>({
    lesseeName: '',
    lesseeAddress: '',
    lesseeCity: '',
    lesseeState: '',
    lesseeZip: '',
    lesseePhone: '',
    coLesseeName: '',
    coLesseeAddress: '',
    coLesseeCity: '',
    coLesseeState: '',
    coLesseeZip: '',
    coLesseePhone: '',
  });

  const [autoTermApplied, setAutoTermApplied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDecodingVin, setIsDecodingVin] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinSuccess, setVinSuccess] = useState(false);
  const [showDealerMetrics, setShowDealerMetrics] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLeaseId, setSavedLeaseId] = useState<string | null>(null);

  // Customer's next pay date (we skip this one, first payment is the one after)
  const [nextPayDate, setNextPayDate] = useState<string>('');

  // Parse form values
  const acv = parseFloat(form.acv.replace(/[^0-9.]/g, '')) || 0;
  const termMonths = parseInt(form.termMonths, 10) || 0;
  const docFee = parseFloat(form.docFee.replace(/[^0-9.]/g, '')) || 0;
  const downPayment = parseFloat(form.downPayment.replace(/[^0-9.]/g, '')) || 0;
  const paymentReduction = parseFloat(form.paymentReduction.replace(/[^0-9.]/g, '')) || 0;

  // Auto-calculate optimal term when ACV changes
  useEffect(() => {
    if (acv > 0 && docFee >= 0 && !autoTermApplied) {
      const optimal = calculateOptimalTerm(acv, docFee, form.state, form.paymentFrequency, downPayment, paymentReduction);
      if (optimal.term > 0) {
        setForm(prev => ({ ...prev, termMonths: optimal.term.toString() }));
        setAutoTermApplied(true);
      }
    }
  }, [acv, docFee, form.state, form.paymentFrequency, autoTermApplied, downPayment, paymentReduction]);

  // Reset auto-term flag when ACV changes significantly
  useEffect(() => {
    setAutoTermApplied(false);
  }, [form.acv]);

  // Calculate deal when we have valid inputs
  const calculation = useMemo<DealCalculation | null>(() => {
    if (acv > 0 && termMonths > 0 && termMonths <= MAX_TERM) {
      return calculateDeal({
        acv,
        termMonths,
        docFee,
        state: form.state,
        paymentFrequency: form.paymentFrequency,
        downPayment,
        paymentReduction,
      });
    }
    return null;
  }, [acv, termMonths, docFee, form.state, form.paymentFrequency, downPayment, paymentReduction]);

  // Validate deal
  const validation = useMemo<ValidationResult | null>(() => {
    if (calculation) {
      return validateDeal(calculation);
    }
    return null;
  }, [calculation]);

  // Calculate first payment date: skip customer's next payday, first payment is the one after
  const firstPaymentDate = useMemo<{ date: Date; formattedDate: string } | null>(() => {
    if (!nextPayDate) return null;

    const nextPay = new Date(nextPayDate + 'T00:00:00');
    if (isNaN(nextPay.getTime())) return null;

    const firstPayment = new Date(nextPay);

    // Add one payment period based on frequency
    switch (form.paymentFrequency) {
      case 'weekly':
        firstPayment.setDate(firstPayment.getDate() + 7);
        break;
      case 'biweekly':
        firstPayment.setDate(firstPayment.getDate() + 14);
        break;
      case 'monthly':
        firstPayment.setMonth(firstPayment.getMonth() + 1);
        break;
    }

    const formattedDate = firstPayment.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return { date: firstPayment, formattedDate };
  }, [nextPayDate, form.paymentFrequency]);

  const handleInputChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleVehicleChange = (field: keyof VehicleState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setVehicle((prev) => ({ ...prev, [field]: e.target.value }));
    if (field === 'vin') {
      setVinError(null);
      setVinSuccess(false);
    }
  };

  const handleCustomerChange = (field: keyof CustomerState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCustomer((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Format currency input on blur
  const handleCurrencyBlur = (field: 'acv' | 'docFee' | 'downPayment' | 'paymentReduction') => () => {
    const value = parseFloat(form[field].replace(/[^0-9.]/g, '')) || 0;
    if (value >= 0) {
      setForm((prev) => ({ ...prev, [field]: value.toFixed(2) }));
    }
  };

  // Decode VIN
  const handleDecodeVin = async () => {
    if (!vehicle.vin.trim()) {
      setVinError('Please enter a VIN');
      return;
    }

    setIsDecodingVin(true);
    setVinError(null);
    setVinSuccess(false);

    try {
      const result: VehicleInfo = await decodeVIN(vehicle.vin);

      if (result.isValid) {
        setVehicle((prev) => ({
          ...prev,
          vin: result.vin,
          year: result.year,
          make: result.make,
          model: result.model,
          bodyStyle: result.bodyStyle,
        }));
        setVinSuccess(true);
      } else {
        setVinError(result.errorMessage || 'Invalid VIN');
      }
    } catch {
      setVinError('Failed to decode VIN');
    } finally {
      setIsDecodingVin(false);
    }
  };

  // Generate contract document
  const handleGenerateContract = async () => {
    if (!calculation || !validation?.isValid || !firstPaymentDate) return;

    setIsGenerating(true);
    try {
      const contractData: ContractData = {
        calculation,
        vehicle,
        customer,
        firstPaymentDate: firstPaymentDate.formattedDate,
        dealerProfile,
      };
      await downloadLeasePDF(contractData);
    } catch (error) {
      console.error('Failed to generate document:', error);
      alert('Failed to generate document. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save lease to dashboard
  const handleSaveLease = () => {
    if (!calculation || !validation?.isValid || !user) return;

    setIsSaving(true);
    try {
      const leaseId = crypto.randomUUID();
      const lease = {
        id: leaseId,
        status: 'PENDING' as const,
        customerName: customer.lesseeName || 'Unknown Customer',
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim() || 'Unknown Vehicle',
        monthlyPayment: calculation.totalPayment,
        createdAt: new Date().toISOString(),
        dealData: {
          calculation,
          vehicle,
          customer,
          dealerProfile,
          firstPaymentDate: firstPaymentDate?.formattedDate,
        },
      };

      // Get existing leases
      const existingLeases = JSON.parse(localStorage.getItem(`leases_${user.id}`) || '[]');
      existingLeases.unshift(lease);
      localStorage.setItem(`leases_${user.id}`, JSON.stringify(existingLeases));

      setSavedLeaseId(leaseId);

      // Return to dashboard after saving
      if (onBack) {
        setTimeout(() => onBack(), 500);
      }
    } catch (error) {
      console.error('Failed to save lease:', error);
      alert('Failed to save lease. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const validRange = validation?.validTermRange;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white py-5 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Car World Lease Calculator</h1>
              <p className="text-blue-200 text-sm mt-1">
                {dealerProfile ? dealerProfile.name : 'Dealer Partner Portal'}
              </p>
            </div>
          </div>
          {savedLeaseId && (
            <span className="text-green-300 text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Deal & Vehicle Info */}
          <div className="space-y-6">
            {/* Deal Information */}
            <div className="bg-white rounded-lg shadow-md p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Deal Information
              </h2>

              <div className="grid grid-cols-2 gap-4">
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

                {/* Customer Next Pay Date */}
                <div>
                  <label htmlFor="nextPayDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Next Pay Date
                  </label>
                  <input
                    id="nextPayDate"
                    type="date"
                    value={nextPayDate}
                    onChange={(e) => setNextPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  {firstPaymentDate && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      1st Payment: {firstPaymentDate.formattedDate}
                    </p>
                  )}
                  {!nextPayDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      First payment will be one {form.paymentFrequency === 'monthly' ? 'month' : form.paymentFrequency === 'biweekly' ? '2 weeks' : 'week'} after this date
                    </p>
                  )}
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
                  <p className="text-xs text-gray-500 mt-1">Goes to Dealer</p>
                </div>

                {/* Payment Reduction */}
                <div>
                  <label htmlFor="paymentReduction" className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reduction
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      id="paymentReduction"
                      type="text"
                      inputMode="decimal"
                      value={form.paymentReduction}
                      onChange={handleInputChange('paymentReduction')}
                      onBlur={handleCurrencyBlur('paymentReduction')}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Goes to Car World</p>
                </div>

                {/* Doc Fee */}
                <div>
                  <label htmlFor="docFee" className="block text-sm font-medium text-gray-700 mb-1">
                    Doc Fee
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
                      placeholder="695.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                {/* Term */}
                <div>
                  <label htmlFor="term" className="block text-sm font-medium text-gray-700 mb-1">
                    Term (Months)
                  </label>
                  <input
                    id="term"
                    type="number"
                    min="12"
                    max={MAX_TERM}
                    value={form.termMonths}
                    onChange={handleInputChange('termMonths')}
                    placeholder="Auto"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                  {validRange && validRange.min > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Valid: {validRange.min}-{validRange.max}mo
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="bg-white rounded-lg shadow-md p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
                Vehicle Information
              </h2>

              {/* VIN with Decode Button */}
              <div className="mb-4">
                <label htmlFor="vin" className="block text-sm font-medium text-gray-700 mb-1">
                  VIN
                </label>
                <div className="flex gap-2">
                  <input
                    id="vin"
                    type="text"
                    maxLength={17}
                    value={vehicle.vin}
                    onChange={handleVehicleChange('vin')}
                    placeholder="Enter 17-character VIN"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleDecodeVin}
                    disabled={isDecodingVin}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium text-sm"
                  >
                    {isDecodingVin ? 'Decoding...' : 'Decode'}
                  </button>
                </div>
                {vinError && (
                  <p className="text-xs text-red-600 mt-1">{vinError}</p>
                )}
                {vinSuccess && (
                  <p className="text-xs text-green-600 mt-1">VIN decoded successfully</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Year */}
                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <input
                    id="year"
                    type="text"
                    value={vehicle.year}
                    onChange={handleVehicleChange('year')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                    readOnly
                  />
                </div>

                {/* Make */}
                <div>
                  <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                    Make
                  </label>
                  <input
                    id="make"
                    type="text"
                    value={vehicle.make}
                    onChange={handleVehicleChange('make')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                    readOnly
                  />
                </div>

                {/* Model */}
                <div>
                  <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <input
                    id="model"
                    type="text"
                    value={vehicle.model}
                    onChange={handleVehicleChange('model')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                    readOnly
                  />
                </div>

                {/* Body Style */}
                <div>
                  <label htmlFor="bodyStyle" className="block text-sm font-medium text-gray-700 mb-1">
                    Body Style
                  </label>
                  <input
                    id="bodyStyle"
                    type="text"
                    value={vehicle.bodyStyle}
                    onChange={handleVehicleChange('bodyStyle')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                    readOnly
                  />
                </div>

                {/* Odometer */}
                <div className="col-span-2">
                  <label htmlFor="odometer" className="block text-sm font-medium text-gray-700 mb-1">
                    Odometer
                  </label>
                  <input
                    id="odometer"
                    type="text"
                    inputMode="numeric"
                    value={vehicle.odometer}
                    onChange={handleVehicleChange('odometer')}
                    placeholder="Enter mileage"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Customer Info */}
          <div className="space-y-6">
            {/* Lessee Information */}
            <div className="bg-white rounded-lg shadow-md p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Lessee (Customer)
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="lesseeName" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="lesseeName"
                    type="text"
                    value={customer.lesseeName}
                    onChange={handleCustomerChange('lesseeName')}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="lesseeAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    id="lesseeAddress"
                    type="text"
                    value={customer.lesseeAddress}
                    onChange={handleCustomerChange('lesseeAddress')}
                    placeholder="123 Main St"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="lesseeCity" className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      id="lesseeCity"
                      type="text"
                      value={customer.lesseeCity}
                      onChange={handleCustomerChange('lesseeCity')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesseeState" className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      id="lesseeState"
                      type="text"
                      maxLength={2}
                      value={customer.lesseeState}
                      onChange={handleCustomerChange('lesseeState')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 uppercase"
                    />
                  </div>
                  <div>
                    <label htmlFor="lesseeZip" className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP
                    </label>
                    <input
                      id="lesseeZip"
                      type="text"
                      maxLength={10}
                      value={customer.lesseeZip}
                      onChange={handleCustomerChange('lesseeZip')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lesseePhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    id="lesseePhone"
                    type="tel"
                    value={customer.lesseePhone}
                    onChange={handleCustomerChange('lesseePhone')}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Co-Lessee Information */}
            <div className="bg-white rounded-lg shadow-md p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Co-Lessee (Optional)
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="coLesseeName" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="coLesseeName"
                    type="text"
                    value={customer.coLesseeName}
                    onChange={handleCustomerChange('coLesseeName')}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label htmlFor="coLesseeAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    id="coLesseeAddress"
                    type="text"
                    value={customer.coLesseeAddress}
                    onChange={handleCustomerChange('coLesseeAddress')}
                    placeholder="123 Main St"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="coLesseeCity" className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      id="coLesseeCity"
                      type="text"
                      value={customer.coLesseeCity}
                      onChange={handleCustomerChange('coLesseeCity')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="coLesseeState" className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      id="coLesseeState"
                      type="text"
                      maxLength={2}
                      value={customer.coLesseeState}
                      onChange={handleCustomerChange('coLesseeState')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 uppercase"
                    />
                  </div>
                  <div>
                    <label htmlFor="coLesseeZip" className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP
                    </label>
                    <input
                      id="coLesseeZip"
                      type="text"
                      maxLength={10}
                      value={customer.coLesseeZip}
                      onChange={handleCustomerChange('coLesseeZip')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="coLesseePhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    id="coLesseePhone"
                    type="tel"
                    value={customer.coLesseePhone}
                    onChange={handleCustomerChange('coLesseePhone')}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
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
                        <span className="text-red-500">*</span>
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
                {validation.warnings && validation.warnings.length > 0 && (
                  <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                    {validation.warnings.map((warning, idx) => (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-yellow-500">!</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleGenerateContract}
                disabled={!validation?.isValid || isGenerating || !firstPaymentDate}
                className={`w-full py-4 px-6 rounded-lg font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                  validation?.isValid && !isGenerating && firstPaymentDate
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

              {onBack && (
                <button
                  onClick={handleSaveLease}
                  disabled={!validation?.isValid || isSaving || savedLeaseId !== null}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    validation?.isValid && !isSaving && !savedLeaseId
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : savedLeaseId
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : savedLeaseId ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved to Dashboard
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      Save to Dashboard
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Column - Calculations */}
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
                      <span className="text-blue-200">Tax ({(calculation.taxRate * 100).toFixed(2)}%)</span>
                      <span className="text-lg">{formatCurrency(calculation.taxPerPayment)}</span>
                    </div>
                    <div className="border-t border-blue-600 pt-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-blue-100 font-medium">TOTAL PAYMENT</span>
                        <span className="text-3xl font-bold text-white">{formatCurrency(calculation.totalPayment)}</span>
                      </div>
                      <div className="text-center mt-2">
                        <span className="text-blue-200 text-sm">{calculation.numberOfPayments} {calculation.paymentFrequencyLabel} Payments</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer View - Deal Structure */}
                <div className="bg-white rounded-lg shadow-md p-5">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    Customer View - Deal Structure
                  </h3>
                  <div className="space-y-2 text-sm">
                    {/* Capitalized Cost Breakdown */}
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Agreed Upon Vehicle Value</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.agreedPrice)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">+ Documentation Fee</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.docFee)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t pt-2">
                      <span className="text-gray-700 font-medium">= Gross Capitalized Cost</span>
                      <span className="font-bold text-gray-900">{formatCurrency(calculation.grossCapCost)}</span>
                    </div>
                    {calculation.capCostReduction > 0 && (
                      <div className="flex justify-between py-1">
                        <span className="text-gray-600">- Capitalized Cost Reduction</span>
                        <span className="font-semibold text-gray-900">-{formatCurrency(calculation.capCostReduction)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-t pt-2">
                      <span className="text-gray-700 font-medium">= Adjusted Capitalized Cost</span>
                      <span className="font-bold text-gray-900">{formatCurrency(calculation.adjustedCapCost)}</span>
                    </div>

                    {/* Lease Calculation */}
                    <div className="flex justify-between py-1 mt-3 border-t pt-3">
                      <span className="text-gray-600">Residual Value (10%)</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.residualValue)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Depreciation</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.depreciation)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Rent Charge</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(calculation.rentCharge)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t pt-2">
                      <span className="text-gray-700 font-medium">Total of Base Payments</span>
                      <span className="font-bold text-gray-900">{formatCurrency(calculation.totalBasePayments)}</span>
                    </div>

                    {/* Due at Signing */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Due at Signing</h4>
                      {calculation.capCostReduction > 0 && (
                        <div className="flex justify-between py-1 text-sm">
                          <span className="text-gray-600">Cap Cost Reduction</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(calculation.capCostReduction)}</span>
                        </div>
                      )}
                      {calculation.taxCollectedAtSigning > 0 && (
                        <div className="flex justify-between py-1 text-sm">
                          <span className="text-gray-600">Tax Collected at Signing</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(calculation.taxCollectedAtSigning)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-t pt-2">
                        <span className="text-gray-700 font-medium">Total Due at Signing</span>
                        <span className="font-bold text-gray-900">{formatCurrency(calculation.amountDueAtSigning)}</span>
                      </div>
                    </div>

                    {/* Purchase Option */}
                    <div className="flex justify-between py-2 mt-3 border-t pt-3">
                      <span className="text-gray-700 font-medium">Purchase Option at End</span>
                      <span className="font-bold text-gray-900">{formatCurrency(calculation.purchaseOptionPrice)}</span>
                    </div>
                  </div>
                </div>

                {/* Dealer View - Internal Metrics */}
                <div className="bg-amber-50 rounded-lg shadow-md border border-amber-200">
                  <button
                    onClick={() => setShowDealerMetrics(!showDealerMetrics)}
                    className="w-full p-4 flex justify-between items-center text-left"
                  >
                    <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Dealer View (Internal Only)
                    </h3>
                    <svg className={`w-5 h-5 text-amber-700 transition-transform ${showDealerMetrics ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showDealerMetrics && (
                    <div className="px-4 pb-4 space-y-2 text-sm border-t border-amber-200">
                      <div className="flex justify-between py-2">
                        <span className="text-amber-800">ACV (Lender Cost)</span>
                        <span className="font-semibold text-amber-900">{formatCurrency(calculation.acv)}</span>
                      </div>
                      {calculation.paymentReduction > 0 && (
                        <>
                          <div className="flex justify-between py-1">
                            <span className="text-amber-800">- Payment Reduction</span>
                            <span className="font-semibold text-amber-900">-{formatCurrency(calculation.paymentReduction)}</span>
                          </div>
                          <div className="flex justify-between py-1 border-t border-amber-200 pt-2">
                            <span className="text-amber-800 font-medium">= Effective ACV</span>
                            <span className="font-bold text-amber-900">{formatCurrency(calculation.effectiveACV)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between py-1">
                        <span className="text-amber-800">Markup</span>
                        <span className="font-semibold text-amber-900">{formatCurrency(calculation.markup)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-amber-800">Money Factor</span>
                        <span className="font-semibold text-amber-900">{calculation.adjustedMoneyFactor.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-amber-800">Implied APR</span>
                        <span className="font-semibold text-amber-900">{calculation.impliedAPR.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-amber-800">Investor Payment</span>
                        <span className="font-semibold text-amber-900">{formatCurrency(calculation.investorPayment)}</span>
                      </div>
                      <div className="flex justify-between py-2 bg-amber-100 -mx-4 px-4 mt-2">
                        <span className="text-amber-800 font-medium">Monthly Spread</span>
                        <span className={`font-bold text-lg ${calculation.meetsMinSpread ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(calculation.monthlySpread)}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 text-xs text-amber-700">
                        <span>Target: ${MIN_SPREAD}/mo | Min: ${MIN_SPREAD}/mo</span>
                        <span>{calculation.meetsTargetSpread ? 'Meets Target' : calculation.meetsMinSpread ? 'Above Min' : 'Below Min'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-500">
          Car World Dealer Partner Portal &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
