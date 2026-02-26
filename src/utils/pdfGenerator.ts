import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ContractData } from '../components/DealCalculator';
import { DISPOSITION_FEE, PURCHASE_OPTION_FEE, ANNUAL_MILEAGE, EXCESS_MILEAGE_RATE, LATE_FEE_PERCENT, LATE_FEE_MIN } from './constants';
import { generateEarlyTerminationSchedule } from './calculations';

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function checkbox(checked: boolean): string {
  return checked ? '[X]' : '[ ]';
}

function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'monthly': return 'Monthly';
    case 'biweekly': return 'Bi-Weekly';
    case 'weekly': return 'Weekly';
    default: return frequency;
  }
}

function getFrequencyText(frequency: string): string {
  switch (frequency) {
    case 'monthly': return 'on the same day of each month';
    case 'biweekly': return 'every 14 days';
    case 'weekly': return 'every 7 days';
    default: return '';
  }
}

// ============================================================================
// PDF Generation
// ============================================================================

export function generateLeasePDF(contractData: ContractData): void {
  const { calculation, vehicle, customer, firstPaymentDate, dealerProfile, contractDate } = contractData;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  const bottomMargin = 50;
  let y = margin;

  const frequencyLabel = getFrequencyLabel(calculation.paymentFrequency);
  const frequencyText = getFrequencyText(calculation.paymentFrequency);
  // Use contractDate for backdated deals, otherwise use current date
  const today = contractDate || new Date().toLocaleDateString('en-US');

  // Helper to add page if needed - returns true if new page was added
  const checkPage = (needed: number): boolean => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Helper to add section header
  const addSectionHeader = (title: string, bgColor: [number, number, number] = [220, 220, 220]) => {
    checkPage(30);
    doc.setFillColor(...bgColor);
    doc.rect(margin, y, contentWidth, 16, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, y + 11);
    y += 22;
  };

  // ==================== PAGE 1: TITLE & DISCLOSURES ====================

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MOTOR VEHICLE LEASE AGREEMENT', pageWidth / 2, y, { align: 'center' });
  y += 16;
  doc.setFontSize(12);
  doc.text('CLOSED END', pageWidth / 2, y, { align: 'center' });
  y += 22;

  // Date and State
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${today}`, margin, y);
  doc.text(`State: ${calculation.state}     County: _________________`, pageWidth / 2, y);
  y += 18;

  // Lessor/Lessee Box
  const lessorName = dealerProfile?.name || 'i Finance Leasing';
  const lessorAddress = dealerProfile?.address || '[Address]\n[City, State ZIP]';

  autoTable(doc, {
    startY: y,
    head: [['LESSOR', 'LESSEE']],
    body: [[
      `${lessorName}\n${lessorAddress}`,
      `Name: ${customer.lesseeName || '_______________________'}\nAddress: ${customer.lesseeAddress || '_______________________'}\nCity/State/ZIP: ${customer.lesseeCity || '___________'}, ${customer.lesseeState || '____'} ${customer.lesseeZip || '_______'}\nPhone: ${customer.lesseePhone || '___________________'}`
    ]],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: contentWidth / 2 }, 1: { cellWidth: contentWidth / 2 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // Stock # and Co-Lessee
  autoTable(doc, {
    startY: y,
    body: [[
      `Stock #: ________________`,
      `CO-LESSEE: ${customer.coLesseeName || '_______________________'}`
    ]],
    theme: 'grid',
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: contentWidth / 2 }, 1: { cellWidth: contentWidth / 2 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Vehicle Description
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VEHICLE DESCRIPTION', margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [['Year', 'Make', 'Model', 'Style', 'VIN', 'Odometer']],
    body: [[
      vehicle.year || '______',
      vehicle.make || '________',
      vehicle.model || '________',
      vehicle.bodyStyle || '______',
      vehicle.vin || '_________________',
      vehicle.odometer || '________'
    ]],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 4 },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // FCLA Header
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 14, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FEDERAL CONSUMER LEASING ACT DISCLOSURES', pageWidth / 2, y + 10, { align: 'center' });
  y += 18;

  // Payment Schedule Selection
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT SCHEDULE:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${checkbox(calculation.paymentFrequency === 'monthly')} Monthly    ${checkbox(calculation.paymentFrequency === 'biweekly')} Bi-Weekly    ${checkbox(calculation.paymentFrequency === 'weekly')} Weekly`, margin + 90, y);
  y += 14;

  // Main Disclosure Box (3 columns)
  autoTable(doc, {
    startY: y,
    head: [['Amount Due at Lease Signing', `${frequencyLabel} Payments`, 'Total of Payments']],
    body: [[
      `${formatCurrency(calculation.amountDueAtSigning)}\n(Itemized Below)*`,
      `First payment of ${formatCurrency(calculation.totalPayment)} due on ${firstPaymentDate || '_________'}, followed by ${calculation.numberOfPayments - 1} payments of ${formatCurrency(calculation.totalPayment)} due ${frequencyText}.`,
      `${formatCurrency(calculation.totalOfPayments)}\n(Amount you will have paid by end of lease)`
    ]],
    theme: 'grid',
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 8, cellPadding: 6, halign: 'center', valign: 'middle' },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Itemization Table
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('* ITEMIZATION OF AMOUNT DUE AT LEASE SIGNING:', margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    body: [
      ['Capitalized Cost Reduction', formatCurrency(calculation.capCostReduction), { content: `How Paid:\nNet Trade-In: $0.00\nRebates: $0.00\nCash: ${formatCurrency(calculation.downPayment)}`, rowSpan: 3 }],
      [`Sales Tax Collected at Signing (${(calculation.taxRate * 100).toFixed(2)}%)`, formatCurrency(calculation.taxCollectedAtSigning)],
      [{ content: 'TOTAL AMOUNT DUE AT SIGNING', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: formatCurrency(calculation.amountDueAtSigning), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
    ],
    theme: 'grid',
    bodyStyles: { fontSize: 8, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 180 }, 1: { cellWidth: 80, halign: 'right' }, 2: { cellWidth: contentWidth - 260 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Payment Calculation Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('YOUR PAYMENT IS DETERMINED AS SHOWN BELOW:', margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    body: [
      ['Agreed Upon Vehicle Value', formatCurrency(calculation.agreedPrice)],
      ['Documentation Fee', '+ ' + formatCurrency(calculation.docFee)],
      [{ content: 'Gross Capitalized Cost', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: '= ' + formatCurrency(calculation.grossCapCost), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['Capitalized Cost Reduction', '- ' + formatCurrency(calculation.capCostReduction)],
      [{ content: 'Adjusted Capitalized Cost', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: '= ' + formatCurrency(calculation.adjustedCapCost), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['Residual Value', '- ' + formatCurrency(calculation.residualValue)],
      ['Depreciation', '= ' + formatCurrency(calculation.depreciation)],
      ['Rent Charge', '+ ' + formatCurrency(calculation.rentCharge)],
      [{ content: 'Total of Base Payments', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: '= ' + formatCurrency(calculation.totalBasePayments), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }],
      ['Number of Payments', '÷ ' + calculation.numberOfPayments + ' payments'],
      ['Base Payment', '= ' + formatCurrency(calculation.basePayment)],
      [`Sales/Use Tax Per Payment (${(calculation.taxRate * 100).toFixed(2)}%)`, '+ ' + formatCurrency(calculation.taxPerPayment)],
      [{ content: `TOTAL ${frequencyLabel.toUpperCase()} PAYMENT`, styles: { fontStyle: 'bold', fillColor: [200, 220, 240] } }, { content: '= ' + formatCurrency(calculation.totalPayment), styles: { fontStyle: 'bold', fillColor: [200, 220, 240] } }],
    ],
    theme: 'grid',
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: contentWidth - 100 }, 1: { cellWidth: 100, halign: 'right' } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 15;

  // ==================== OTHER DISCLOSURES (flows naturally) ====================

  // Check if we need a new page, but don't force one
  checkPage(200);

  // Header
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 14, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('OTHER IMPORTANT DISCLOSURES', pageWidth / 2, y + 10, { align: 'center' });
  y += 20;

  // Early Termination
  addSectionHeader('EARLY TERMINATION', [255, 240, 220]);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('If you terminate this lease early or default, the following applies:', margin, y);
  y += 12;

  const termPoints = [
    ['1. AMOUNT OWED:', `All remaining Base Payments plus Disposition Fee (${formatCurrency(DISPOSITION_FEE)}).`],
    ['2. VEHICLE DISPOSITION:', 'The vehicle will be sold in a commercially reasonable manner.'],
    ['3. LESSOR MAY PURCHASE:', 'Lessor or its affiliates may bid on and purchase the vehicle at any sale.'],
    ['4. APPLICATION OF PROCEEDS:', 'Net sale proceeds will be applied to reduce the amount you owe.'],
    ['5. DEFICIENCY BALANCE:', 'You are responsible for any deficiency (amount owed minus net sale proceeds).'],
  ];

  for (const [label, text] of termPoints) {
    checkPage(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(text, margin + 110, y);
    y += 11;
  }
  y += 5;

  // Early Termination Formula
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EARLY TERMINATION FORMULA:', margin, y);
  y += 10;

  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 24, 'F');
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(`  Amount Owed = (Remaining Payments × ${formatCurrency(calculation.basePayment)}) + ${formatCurrency(DISPOSITION_FEE)}`, margin + 5, y + 9);
  doc.text('  Deficiency  = Amount Owed - Net Vehicle Sale Proceeds', margin + 5, y + 18);
  y += 30;

  // Early Termination Schedule
  checkPage(120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EARLY TERMINATION SCHEDULE (Before Vehicle Sale Credit):', margin, y);
  y += 10;

  const schedule = generateEarlyTerminationSchedule(calculation);
  const scheduleData = schedule.map(row => [
    `Payment ${row.paymentsMade}`,
    row.paymentsMade.toString(),
    row.remainingPayments.toString(),
    formatCurrency(row.amountOwed)
  ]);

  autoTable(doc, {
    startY: y,
    head: [['If Terminated After', 'Payments Made', 'Remaining Payments', 'Amount Owed*']],
    body: scheduleData,
    theme: 'grid',
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    bodyStyles: { fontSize: 7, cellPadding: 2, halign: 'center' },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('*Amount owed before vehicle sale credit. Does not include past due payments, late fees, or excess charges.', margin, y);
  y += 15;

  // Excessive Wear
  checkPage(40);
  addSectionHeader('EXCESSIVE WEAR AND USE');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`You may be charged for excessive wear and for mileage in excess of ${ANNUAL_MILEAGE.toLocaleString()} miles per year at the rate of ${formatCurrency(EXCESS_MILEAGE_RATE)} per mile.`, margin, y);
  y += 15;

  // Purchase Option
  checkPage(40);
  addSectionHeader('PURCHASE OPTION AT END OF LEASE TERM');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`You have an option to purchase the vehicle at the end of the lease for the Residual Value of ${formatCurrency(calculation.residualValue)} plus a Purchase Option Fee of ${formatCurrency(PURCHASE_OPTION_FEE)}, for a total purchase price of ${formatCurrency(calculation.purchaseOptionPrice)}.`, margin, y, { maxWidth: contentWidth });
  y += 20;

  // Late Payment
  checkPage(40);
  addSectionHeader('LATE PAYMENT CHARGE');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`If any payment is not received within 5 days after its due date, you agree to pay a late charge of ${(LATE_FEE_PERCENT * 100)}% of the payment amount or ${formatCurrency(LATE_FEE_MIN)}, whichever is greater.`, margin, y, { maxWidth: contentWidth });
  y += 20;

  // Disposition Fee
  checkPage(40);
  addSectionHeader('DISPOSITION FEE');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`If you do not purchase the vehicle at the end of the lease, a disposition fee of ${formatCurrency(DISPOSITION_FEE)} will be due.`, margin, y);
  y += 15;

  // Insurance
  checkPage(60);
  addSectionHeader('INSURANCE REQUIREMENTS');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('You (Lessee) agree to maintain the following insurance:', margin, y);
  y += 10;
  doc.text('• Liability: Minimum $100,000/$300,000 Bodily Injury, $50,000 Property Damage', margin + 10, y);
  y += 9;
  doc.text('• Comprehensive and Collision: Actual cash value with maximum $500 deductible', margin + 10, y);
  y += 9;
  doc.text('• Lessor must be named as Loss Payee', margin + 10, y);
  y += 15;

  // ==================== TERMS AND CONDITIONS ====================

  checkPage(250);

  // Header
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 14, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LEASE AGREEMENT TERMS AND CONDITIONS', pageWidth / 2, y + 10, { align: 'center' });
  y += 20;

  const terms = [
    {
      title: '1. AGREEMENT TO LEASE',
      text: 'This Motor Vehicle Lease Agreement ("Lease") is between the Lessor and Lessee(s) named above. Lessor agrees to lease and Lessee agrees to lease from Lessor the Vehicle described above according to the terms of this Lease. This is a lease only and not a purchase agreement. Lessor owns the Vehicle.'
    },
    {
      title: '2. LEASE TERM AND PAYMENTS',
      text: `The lease term is ${calculation.termMonths} months with ${calculation.numberOfPayments} ${frequencyLabel.toLowerCase()} payments of ${formatCurrency(calculation.totalPayment)}. Payments are due on the date specified regardless of whether you receive a billing statement.`
    },
    {
      title: '3. USE OF VEHICLE',
      text: 'You agree to use the Vehicle only for personal, family, or household purposes. You will not use the Vehicle for hire, for any illegal purpose, or remove it from the continental United States without prior written consent.'
    },
    {
      title: '4. CARE AND MAINTENANCE',
      text: 'You agree to keep the Vehicle in good repair and working condition, follow all manufacturer maintenance requirements, and pay for all repairs and maintenance.'
    },
    {
      title: '5. DEFAULT',
      text: 'You will be in default if: (a) you fail to make any payment when due; (b) you fail to maintain required insurance; (c) you breach any other term of this Lease; (d) you provide false information; or (e) the Vehicle is seized by any governmental authority.'
    },
    {
      title: '6. REMEDIES UPON DEFAULT',
      text: 'If you default, Lessor may: (a) demand immediate payment of all amounts due; (b) take possession of the Vehicle; (c) terminate this Lease; and (d) pursue any other remedies available at law. You agree to pay all costs of collection and repossession, including reasonable attorney\'s fees.'
    },
    {
      title: '7. END OF LEASE',
      text: 'At the end of the lease term, you must return the Vehicle to Lessor\'s designated location in the condition required by this Lease, subject to normal wear and use. You are responsible for any excess wear and use charges and excess mileage charges.'
    },
    {
      title: '8. ENTIRE AGREEMENT',
      text: 'This Lease contains the entire agreement between you and Lessor. This Lease may only be modified in writing signed by both parties. This Lease will be governed by the laws of the state where the Vehicle is principally garaged.'
    }
  ];

  doc.setFontSize(8);
  for (const term of terms) {
    const lines = doc.splitTextToSize(term.text, contentWidth);
    checkPage(12 + lines.length * 9);
    doc.setFont('helvetica', 'bold');
    doc.text(term.title, margin, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(lines, margin, y);
    y += lines.length * 9 + 8;
  }

  // ==================== SIGNATURES ====================

  checkPage(180);

  // Header
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 14, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('SIGNATURES', pageWidth / 2, y + 10, { align: 'center' });
  y += 22;

  // Notice
  doc.setFillColor(255, 248, 220);
  doc.rect(margin, y, contentWidth, 24, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTICE: (1) Do not sign this Lease before you read it or if it contains any blank spaces.', margin + 5, y + 9);
  doc.text('(2) You are entitled to an exact copy of the Lease you sign.', margin + 5, y + 18);
  y += 30;

  // Lessee Acknowledgment
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LESSEE ACKNOWLEDGMENT', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const ackText = 'By signing below, I/we acknowledge that I/we have read this entire Lease Agreement. I/we understand and agree to all terms. I/we acknowledge receiving a completed copy of this Lease Agreement.';
  const ackLines = doc.splitTextToSize(ackText, contentWidth);
  doc.text(ackLines, margin, y);
  y += ackLines.length * 9 + 15;

  // Signature lines - Lessee
  doc.text('________________________________________', margin, y);
  doc.text('________________________________________', margin + 280, y);
  y += 10;
  doc.setFontSize(7);
  doc.text('Lessee Signature                                        Date', margin, y);
  doc.text('Co-Lessee Signature                                   Date', margin + 280, y);
  y += 25;

  // Lessor Acceptance
  checkPage(80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LESSOR ACCEPTANCE', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('By signing below, the Lessor agrees to lease the Vehicle to the Lessee(s) according to the terms of this Lease Agreement.', margin, y);
  y += 18;

  // Signature lines - Lessor
  doc.text('________________________________________', margin, y);
  doc.text('________________________________________', margin + 280, y);
  y += 10;
  doc.setFontSize(7);
  doc.text('Authorized Representative                            Date', margin, y);
  doc.text('Print Name and Title', margin + 280, y);
  y += 25;

  // ==================== ASSIGNMENT SECTION ====================

  checkPage(280);

  // Assignment Header
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 14, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ASSIGNMENT OF LEASE (Full Assignment Without Recourse)', pageWidth / 2, y + 10, { align: 'center' });
  y += 22;

  // Assignment Introduction
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const assignmentIntro = 'For good and valuable consideration, the undersigned Lessor (Assignor) hereby sells, assigns, transfers, and conveys to the Assignee named below, WITHOUT RECOURSE, all right, title, and interest in and to this Lease Agreement, the Vehicle described herein, all monies due or to become due under this Lease, all security interests and liens in the Vehicle, and all rights to enforce this Lease and collect payments thereunder.';
  const introLines = doc.splitTextToSize(assignmentIntro, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 9 + 8;

  // Without Recourse Notice
  doc.setFillColor(255, 248, 220);
  doc.rect(margin, y, contentWidth, 32, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('WITHOUT RECOURSE NOTICE:', margin + 5, y + 10);
  doc.setFont('helvetica', 'normal');
  const recourseText = 'This assignment is made WITHOUT RECOURSE to Assignor. Assignee assumes all risk of collection and performance. Assignor shall have no liability for Lessee\'s failure to pay, default, deficiency balances, or the condition/value of the Vehicle.';
  const recourseLines = doc.splitTextToSize(recourseText, contentWidth - 10);
  doc.text(recourseLines, margin + 5, y + 20);
  y += 40;

  // Assignee Information (Pre-filled)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ASSIGNEE:', margin, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('I Finance LLC', margin + 10, y);
  y += 10;
  doc.text('6440 Winchester Rd', margin + 10, y);
  y += 10;
  doc.text('Memphis, TN 38115', margin + 10, y);
  y += 18;

  // Assignor Signature Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ASSIGNOR (Dealer/Lessor) ACKNOWLEDGMENT:', margin, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('By signing below, Assignor represents and warrants that: (1) the Lease is genuine, valid, and enforceable; (2) Assignor has', margin, y);
  y += 9;
  doc.text('good title to the Lease and Vehicle free of liens; (3) all information provided regarding the Lessee is true and accurate;', margin, y);
  y += 9;
  doc.text('(4) the Lease has been duly executed by Lessee; and (5) Assignor has full authority to execute this Assignment.', margin, y);
  y += 18;

  // Signature lines
  doc.text('Dealer Name: ' + (dealerProfile?.name || '___________________________________'), margin, y);
  y += 15;

  doc.text('________________________________________', margin, y);
  doc.text('________________', margin + 300, y);
  y += 10;
  doc.setFontSize(7);
  doc.text('Authorized Representative Signature', margin, y);
  doc.text('Date', margin + 300, y);
  y += 15;

  doc.setFontSize(8);
  doc.text('Print Name: ________________________________', margin, y);
  doc.text('Title: _______________________', margin + 280, y);
  y += 20;

  // Assignee Acceptance
  checkPage(80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ASSIGNEE ACCEPTANCE:', margin, y);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('By signing below, Assignee accepts assignment of this Lease and Vehicle under the terms stated above.', margin, y);
  y += 15;

  doc.text('________________________________________', margin, y);
  doc.text('________________', margin + 300, y);
  y += 10;
  doc.setFontSize(7);
  doc.text('I Finance LLC - Authorized Representative', margin, y);
  doc.text('Date', margin + 300, y);

  // Save the document
  doc.save('Lease_Contract.pdf');
}

export function downloadLeasePDF(contractData: ContractData): void {
  generateLeasePDF(contractData);
}
