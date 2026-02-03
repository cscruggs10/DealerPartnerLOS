import type { PaymentFrequency } from './constants';

// Days of the week for weekly/biweekly payments
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

// Common semi-monthly pay schedules
export const SEMI_MONTHLY_SCHEDULES = [
  { value: '1,15', label: '1st and 15th' },
  { value: '15,30', label: '15th and Last' },
  { value: '5,20', label: '5th and 20th' },
  { value: '10,25', label: '10th and 25th' },
] as const;

// Days of the month for monthly payments
export const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
}));

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export interface PayDayConfig {
  // For weekly/biweekly: day of week (0-6, Sunday=0)
  dayOfWeek?: number;
  // For semi-monthly: two days of month (e.g., [1, 15])
  semiMonthlyDays?: [number, number];
  // For monthly: day of month (1-28)
  monthlyDay?: number;
}

export interface FirstPaymentResult {
  date: Date;
  formattedDate: string;
  daysUntil: number;
  skippedPayDays: number;
}

/**
 * Calculate the first payment date based on customer pay schedule and frequency.
 *
 * Rules:
 * - Weekly: can skip max 2 pay days (so first payment within 3 weeks)
 * - Bi-weekly: can skip max 1 pay day (so first payment within 4 weeks)
 * - Semi-monthly: can skip max 1 pay day (so first payment within ~1 month)
 * - Monthly: can't be more than 30 days out
 */
export function calculateFirstPaymentDate(
  frequency: PaymentFrequency,
  payDayConfig: PayDayConfig,
  contractDate: Date = new Date()
): FirstPaymentResult | null {
  const today = new Date(contractDate);
  today.setHours(0, 0, 0, 0);

  switch (frequency) {
    case 'weekly':
      return calculateWeeklyFirstPayment(today, payDayConfig.dayOfWeek ?? 5, 2);
    case 'biweekly':
      return calculateBiweeklyFirstPayment(today, payDayConfig.dayOfWeek ?? 5, 1);
    case 'monthly':
      return calculateMonthlyFirstPayment(today, payDayConfig.monthlyDay ?? 1, 30);
    default:
      return null;
  }
}

/**
 * Weekly payment: Find next pay day, can skip up to maxSkip pay days
 */
function calculateWeeklyFirstPayment(
  today: Date,
  payDayOfWeek: number,
  maxSkip: number
): FirstPaymentResult {
  const result = new Date(today);

  // Find the next occurrence of the pay day
  const currentDayOfWeek = today.getDay();
  let daysUntilPayDay = payDayOfWeek - currentDayOfWeek;

  if (daysUntilPayDay <= 0) {
    daysUntilPayDay += 7; // Move to next week
  }

  result.setDate(result.getDate() + daysUntilPayDay);

  // Check if this is too soon (within 3 days of contract), if so skip to next week
  const daysUntil = Math.ceil((result.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let skippedPayDays = 0;

  // Minimum 7 days for first payment on weekly
  if (daysUntil < 7) {
    result.setDate(result.getDate() + 7);
    skippedPayDays = 1;
  }

  // Can skip up to maxSkip more if desired (we'll use the minimum valid date)
  // The max first payment date is (maxSkip + 1) weeks out
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + (maxSkip + 1) * 7);

  return {
    date: result,
    formattedDate: formatDate(result),
    daysUntil: Math.ceil((result.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    skippedPayDays,
  };
}

/**
 * Bi-weekly payment: Find next pay day, can skip up to maxSkip pay days
 */
function calculateBiweeklyFirstPayment(
  today: Date,
  payDayOfWeek: number,
  _maxSkip: number
): FirstPaymentResult {
  const result = new Date(today);

  // Find the next occurrence of the pay day
  const currentDayOfWeek = today.getDay();
  let daysUntilPayDay = payDayOfWeek - currentDayOfWeek;

  if (daysUntilPayDay <= 0) {
    daysUntilPayDay += 7;
  }

  result.setDate(result.getDate() + daysUntilPayDay);

  // For biweekly, minimum 14 days for first payment
  const daysUntil = Math.ceil((result.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let skippedPayDays = 0;

  if (daysUntil < 14) {
    result.setDate(result.getDate() + 14);
    skippedPayDays = 1;
  }

  return {
    date: result,
    formattedDate: formatDate(result),
    daysUntil: Math.ceil((result.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    skippedPayDays,
  };
}

/**
 * Monthly payment: Find next pay day, can't be more than maxDays out
 */
function calculateMonthlyFirstPayment(
  today: Date,
  payDayOfMonth: number,
  maxDays: number
): FirstPaymentResult {
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let nextPayDay: Date;
  let skippedPayDays = 0;

  if (currentDay < payDayOfMonth) {
    nextPayDay = new Date(currentYear, currentMonth, payDayOfMonth);
  } else {
    nextPayDay = new Date(currentYear, currentMonth + 1, payDayOfMonth);
  }

  // Ensure at least 15 days out, but not more than maxDays
  let daysUntil = Math.ceil((nextPayDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 15) {
    // Move to next month
    nextPayDay.setMonth(nextPayDay.getMonth() + 1);
    skippedPayDays = 1;
    daysUntil = Math.ceil((nextPayDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Ensure not more than maxDays out - cap the date if needed
  if (daysUntil > maxDays) {
    const cappedDate = new Date(today);
    cappedDate.setDate(cappedDate.getDate() + maxDays);
    nextPayDay = cappedDate;
    daysUntil = maxDays;
  }

  return {
    date: nextPayDay,
    formattedDate: formatDate(nextPayDay),
    daysUntil,
    skippedPayDays,
  };
}

/**
 * Format date as MM/DD/YYYY
 */
export function formatDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Get the appropriate input type label based on frequency
 */
export function getPayDayInputLabel(frequency: PaymentFrequency): string {
  switch (frequency) {
    case 'weekly':
    case 'biweekly':
      return 'Customer Pay Day';
    case 'monthly':
      return 'Pay Day of Month';
    default:
      return 'Pay Day';
  }
}
