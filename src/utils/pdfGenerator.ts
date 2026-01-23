import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ContractData } from '../components/DealCalculator';

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

function checkboxChar(checked: boolean): string {
  return checked ? '[X]' : '[ ]';
}

// Format full address
function formatAddress(address: string, city: string, state: string, zip: string): string {
  const parts = [address, city, state, zip].filter(Boolean);
  if (parts.length === 0) return '';
  if (address && city && state && zip) {
    return `${address}, ${city}, ${state} ${zip}`;
  }
  return parts.join(', ');
}

// ============================================================================
// PDF Generation
// ============================================================================

export function generateLeasePDF(contractData: ContractData): void {
  const { calculation, vehicle, customer } = contractData;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  const addNewPageIfNeeded = (neededSpace: number = 100) => {
    if (y + neededSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ========== HEADER ==========
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Motor Vehicle Lease Agreement – Closed End', pageWidth / 2, y, { align: 'center' });
  y += 25;

  // ========== PARTY INFO ==========
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Name, Address (Lessor):', margin, y);
  doc.text('_'.repeat(75), margin + 130, y);
  y += 15;
  doc.text('_'.repeat(95), margin, y);
  y += 20;

  // Lessee info
  const lesseeAddress = formatAddress(customer.lesseeAddress, customer.lesseeCity, customer.lesseeState, customer.lesseeZip);
  const lesseeInfo = customer.lesseeName ? `${customer.lesseeName}${customer.lesseePhone ? ' - ' + customer.lesseePhone : ''}` : '';

  doc.setFont('helvetica', 'bold');
  doc.text('Name, Address, Phone (Lessee):', margin, y);
  doc.setFont('helvetica', 'normal');
  if (lesseeInfo) {
    doc.text(lesseeInfo, margin + 165, y);
  } else {
    doc.text('_'.repeat(75), margin + 165, y);
  }
  y += 15;
  if (lesseeAddress) {
    doc.text(lesseeAddress, margin, y);
  } else {
    doc.text('_'.repeat(95), margin, y);
  }
  y += 20;

  // Co-Lessee info
  const coLesseeAddress = formatAddress(customer.coLesseeAddress, customer.coLesseeCity, customer.coLesseeState, customer.coLesseeZip);
  const coLesseeInfo = customer.coLesseeName ? `${customer.coLesseeName}${customer.coLesseePhone ? ' - ' + customer.coLesseePhone : ''}` : '';

  doc.setFont('helvetica', 'bold');
  doc.text('Name, Address, Phone (Co-Lessee):', margin, y);
  doc.setFont('helvetica', 'normal');
  if (coLesseeInfo) {
    doc.text(coLesseeInfo, margin + 180, y);
  } else {
    doc.text('_'.repeat(70), margin + 180, y);
  }
  y += 15;
  if (coLesseeAddress) {
    doc.text(coLesseeAddress, margin, y);
  } else {
    doc.text('_'.repeat(95), margin, y);
  }
  y += 25;

  // ========== PAYMENT SCHEDULE ROW ==========
  const isWeekly = calculation.paymentFrequency === 'weekly';
  const isBiweekly = calculation.paymentFrequency === 'biweekly';
  const isSemimonthly = calculation.paymentFrequency === 'semimonthly';
  const isMonthly = calculation.paymentFrequency === 'monthly';

  doc.setFont('helvetica', 'bold');
  doc.text('Payment Schedule:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${checkboxChar(isWeekly)} Weekly   ${checkboxChar(isBiweekly)} Bi-weekly   ${checkboxChar(isSemimonthly)} Semi-Monthly   ${checkboxChar(isMonthly)} Monthly`, margin + 95, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin + 350, y);
  doc.text('_______________', margin + 380, y);

  doc.text('Stock #:', margin + 470, y);
  doc.text('________', margin + 510, y);
  y += 20;

  // Purpose and County
  doc.setFont('helvetica', 'normal');
  doc.text('[ ] The Purpose of this Lease is for Business, Commercial, or agricultural.', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text('County:', margin + 350, y);
  doc.text('________________', margin + 390, y);
  doc.text('State:', margin + 480, y);
  doc.setFont('helvetica', 'normal');
  doc.text(calculation.state, margin + 515, y);
  y += 15;

  doc.setFontSize(8);
  doc.text('[ ] Refer to the attached addendum for additional Lessees and their signatures.', margin, y);
  y += 12;
  doc.text('By signing this Lease, you agree that the insurance you are required to provide under this Lease will be the Vehicle\'s primary insurance for', margin, y);
  y += 10;
  doc.text('liability and personal injury protection coverage and for all other purposes.', margin, y);
  y += 20;

  // ========== VEHICLE DESCRIPTION TABLE ==========
  doc.setFontSize(10);
  autoTable(doc, {
    startY: y,
    head: [['Vehicle Description', 'Year', 'Make', 'Model', 'Style', 'Odometer', 'VIN']],
    body: [[
      '', // Vehicle Description (blank)
      vehicle.year || '',
      vehicle.make || '',
      vehicle.model || '',
      vehicle.bodyStyle || '',
      vehicle.odometer || '',
      vehicle.vin || ''
    ]],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { minCellHeight: 35, fontSize: 10, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 45 },
      2: { cellWidth: 60 },
      3: { cellWidth: 70 },
      4: { cellWidth: 70 },
      5: { cellWidth: 60 },
      6: { cellWidth: 130 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  doc.setFontSize(9);
  doc.text('[ ] New   [X] Used', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Special Equipment:', margin + 100, y);
  doc.text('_'.repeat(60), margin + 190, y);
  y += 20;

  // ========== TRADE-IN TABLE ==========
  autoTable(doc, {
    startY: y,
    head: [['Trade-In Vehicle', 'Year', 'Make', 'Model', 'Style', 'Odometer', 'VIN']],
    body: [['', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { minCellHeight: 35, fontSize: 10, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 45 },
      2: { cellWidth: 60 },
      3: { cellWidth: 70 },
      4: { cellWidth: 70 },
      5: { cellWidth: 60 },
      6: { cellWidth: 130 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Net Trade Allowance: $ ______________ (enter 0, if less than zero)          Gross Amount of Trade-In Allowance: $ ______________', margin, y);
  y += 12;
  doc.text('Prior Credit or Lease Balance: $ ______________          Lienholder Name: ________________________________', margin, y);
  y += 25;

  // ========== FEDERAL CONSUMER DISCLOSURE ==========
  addNewPageIfNeeded(200);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Federal Consumer Disclosure:', margin, y);
  y += 15;

  const dispositionFee = 395;
  const totalOfPaymentsWithTax = calculation.totalOfPayments + calculation.salesTax;
  const totalOfPaymentsFinal = totalOfPaymentsWithTax + dispositionFee;

  // Two column layout for disclosure
  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: 'Amount Due At Signing\n(Itemization below*)', styles: { fontStyle: 'bold' } },
        { content: formatCurrency(calculation.amountDueAtSigning), styles: { fontStyle: 'bold', fontSize: 14, halign: 'center' } },
        {
          content: `Payments\na. Periodic payments. Your first periodic payment of ${formatCurrency(calculation.totalPayment)} is due on _____________ followed by ${calculation.numberOfPayments - 1} payments of ${formatCurrency(calculation.totalPayment)}. The total of your periodic payments is: ${formatCurrency(totalOfPaymentsWithTax)}.`,
          styles: { fontSize: 9 }
        },
      ],
    ],
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 80 },
      2: { cellWidth: contentWidth - 180 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // Miscellaneous charges
  autoTable(doc, {
    startY: y,
    body: [
      ['Miscellaneous Charges (Not part of your periodic payment)', 'Disposition fee (if you do not purchase this Vehicle)', formatCurrency(dispositionFee)],
      ['', { content: 'Total', styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatCurrency(dispositionFee), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 200 },
      1: { cellWidth: contentWidth - 280 },
      2: { cellWidth: 80 },
    },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total of Payments', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('(The amount you will have paid by the end of the Lease)', margin + 90, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalOfPaymentsFinal), margin + 380, y);
  y += 25;

  // ========== ITEMIZATION OF AMOUNT DUE ==========
  addNewPageIfNeeded(150);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('* Itemization of Amount Due at Lease Signing or Delivery', margin, y);
  y += 15;

  const firstPayment = calculation.totalPayment;
  const capCostReduction = calculation.downPayment;
  const docFee = calculation.docFee;
  const itemTotal = capCostReduction + firstPayment + docFee;

  autoTable(doc, {
    startY: y,
    head: [['Amount due at Signing:', '', 'How the amount due will be paid:', '']],
    body: [
      ['Capitalized Cost Reduction', '+' + formatCurrency(capCostReduction), 'Net Trade-In allowance', '$ ___________'],
      ['First Periodic Payment', '+' + formatCurrency(firstPayment), 'Rebates and non-cash credits', '+$ ___________'],
      ['Documentation fees', '+' + formatCurrency(docFee), 'Amount to be paid in cash', '+' + formatCurrency(itemTotal)],
      [{ content: 'Total', styles: { fontStyle: 'bold', halign: 'right' } }, { content: '=' + formatCurrency(itemTotal), styles: { fontStyle: 'bold' } }, { content: 'Total', styles: { fontStyle: 'bold', halign: 'right' } }, { content: '=' + formatCurrency(itemTotal), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 80, halign: 'right' },
      2: { cellWidth: 160 },
      3: { cellWidth: contentWidth - 370, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('If you do not meet your Contract obligations, you may lose the rights to use the Vehicle under the Lease.', margin, y);
  y += 20;

  // ========== MANNER OF PAYMENT ==========
  addNewPageIfNeeded(200);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Manner of Payment Described Below:', margin, y);
  y += 15;

  const grossCapCost = calculation.agreedPrice;
  const adjustedCapCost = grossCapCost - capCostReduction;
  const residualValue = calculation.residualValue;
  const depreciation = calculation.depreciation;
  const rentCharge = calculation.rentCharge;
  const totalBasePayments = calculation.totalOfPayments;
  const leaseTerm = calculation.termMonths;
  const numberOfPayments = calculation.numberOfPayments;
  const basePayment = calculation.basePayment;
  const salesTaxTotal = calculation.salesTax;
  const taxPerPayment = calculation.taxPerPayment;
  const totalPayment = calculation.totalPayment;

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: 'Gross capitalized cost. The agreed upon value of the Vehicle and any items you pay over the Lease Term.', styles: { fontSize: 8 } },
        { content: formatCurrency(grossCapCost), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: 'Rent charge. The amount charged in addition to the depreciation and any amortized amounts.', styles: { fontSize: 8 } },
        { content: '+' + formatCurrency(rentCharge), styles: { halign: 'right', fontStyle: 'bold' } },
      ],
      [
        { content: 'Capitalized cost reduction. The amount of any net trade-in allowance, rebate, non-cash credit, or cash you pay that reduces the gross capitalized cost.', styles: { fontSize: 8 } },
        { content: '-' + formatCurrency(capCostReduction), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: 'Total of base payments. The depreciation and any amortized amounts plus the rent charge.', styles: { fontSize: 8 } },
        { content: '=' + formatCurrency(totalBasePayments), styles: { halign: 'right', fontStyle: 'bold' } },
      ],
      [
        { content: 'Adjusted capitalized cost. The amount used in calculating your base payment.', styles: { fontSize: 8 } },
        { content: '=' + formatCurrency(adjustedCapCost), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: 'Lease Term. The number of months in your Lease.', styles: { fontSize: 8 } },
        { content: leaseTerm + ' months', styles: { halign: 'right', fontStyle: 'bold' } },
      ],
      [
        { content: 'Residual Value. The value of the Vehicle at the end of the Lease used in calculating your base payment.', styles: { fontSize: 8 } },
        { content: '-' + formatCurrency(residualValue), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: 'Lease payments. The number of payments in your Lease.', styles: { fontSize: 8 } },
        { content: '÷' + numberOfPayments, styles: { halign: 'right', fontStyle: 'bold' } },
      ],
      [
        { content: 'Depreciation and any amortized amounts. The amount charged for the Vehicle\'s decline in value through normal wear.', styles: { fontSize: 8 } },
        { content: '=' + formatCurrency(depreciation), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: 'Base Payment', styles: { fontSize: 8, fontStyle: 'bold' } },
        { content: '=' + formatCurrency(basePayment), styles: { halign: 'right', fontStyle: 'bold' } },
      ],
      [
        { content: '', styles: { fontSize: 8 } },
        { content: '', styles: { halign: 'right' } },
        { content: `Sales/use tax (${formatCurrency(salesTaxTotal)} total)`, styles: { fontSize: 8 } },
        { content: '+' + formatCurrency(taxPerPayment), styles: { halign: 'right', fontStyle: 'bold' } },
      ],
      [
        { content: '', styles: { fontSize: 8 } },
        { content: '', styles: { halign: 'right' } },
        { content: 'Total Payment', styles: { fontSize: 9, fontStyle: 'bold' } },
        { content: '=' + formatCurrency(totalPayment), styles: { halign: 'right', fontStyle: 'bold', fontSize: 11 } },
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: (contentWidth / 2) - 50 },
      1: { cellWidth: 70 },
      2: { cellWidth: (contentWidth / 2) - 70 },
      3: { cellWidth: 70 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 15;

  // ========== EARLY TERMINATION ==========
  addNewPageIfNeeded(80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Early Termination.', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 12;
  doc.setFontSize(8);
  const earlyTermText = 'You may have to pay a substantial charge if you end this Lease early. The charge may be up to several thousand dollars. The actual charge will depend on when the Lease is terminated. The earlier you end the Lease, the greater this charge is likely to be.';
  const earlyTermLines = doc.splitTextToSize(earlyTermText, contentWidth);
  doc.text(earlyTermLines, margin, y);
  y += earlyTermLines.length * 10 + 10;

  // ========== EXCESSIVE WEAR ==========
  addNewPageIfNeeded(60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Excessive Wear and Use.', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 12;
  doc.setFontSize(8);
  doc.text('You may be charged for excessive wear based on our standards for normal use and mileage in excess of', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text('12,000 miles per year', margin + 360, y);
  doc.setFont('helvetica', 'normal');
  doc.text('at the rate of', margin + 445, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('$0.25 per mile.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('(Excess Mileage Charge)', margin + 70, y);
  y += 20;

  // ========== PURCHASE OPTION ==========
  addNewPageIfNeeded(60);
  const purchaseOptionPrice = calculation.residualValue + 300;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Purchase Option at End of Lease Term.', margin, y);
  y += 12;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('[X] If the box in this line is checked, you have the option to purchase the Vehicle at the end of the Lease Term for', margin, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(purchaseOptionPrice), margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('and a purchase option fee of', margin + 60, y);
  doc.setFont('helvetica', 'bold');
  doc.text('$0.00', margin + 165, y);
  doc.setFont('helvetica', 'normal');
  doc.text('. The purchase option price does not include official fees such as those for', margin + 190, y);
  y += 10;
  doc.text('taxes, tags, license and registration which you will also be required to pay.', margin, y);
  y += 15;

  // ========== OTHER IMPORTANT TERMS ==========
  addNewPageIfNeeded(40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Other Important Terms.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('See Lease documents for additional information on early termination, purchase options and', margin + 115, y);
  y += 10;
  doc.text('maintenance responsibilities, warranties, late and default charges, insurance, and any security interest, if applicable.', margin, y);
  y += 20;

  // ========== BREAKDOWN OF CAPITALIZED COST ==========
  addNewPageIfNeeded(120);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Breakdown of Capitalized Cost', margin, y);
  y += 15;

  autoTable(doc, {
    startY: y,
    body: [
      ['Agreed-upon Vehicle Valuation', formatCurrency(calculation.acv), 'Service Contract and Extended Warranty', '$ ___________'],
      ['Acquisition Fee', '$ ___________', 'Sales or Use Tax', formatCurrency(calculation.salesTax)],
      ['Documentation Fee', formatCurrency(calculation.docFee), 'Unpaid balances from previous credit/leases', '$ ___________'],
      ['Registration, license, and title Fees', '$ ___________', { content: 'Total:', styles: { fontStyle: 'bold' } }, { content: formatCurrency(calculation.agreedPrice), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 150 },
      1: { cellWidth: 80, halign: 'right' },
      2: { cellWidth: 180 },
      3: { cellWidth: contentWidth - 410, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  // ========== ADDITIONAL FEES ==========
  addNewPageIfNeeded(80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Additional Fees and Charges', margin, y);
  y += 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle Return Fee.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('If this Lease is terminated before the end of the scheduled Lease Term and the Vehicle is returned to us or to', margin + 85, y);
  y += 10;
  doc.text('our agents, a Vehicle Return Fee of $ ___________ will be required. This fee will be waived if terminated early due to purchase.', margin, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('Disposition Fee.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('You will pay us a Disposition Fee of', margin + 75, y);
  doc.setFont('helvetica', 'bold');
  doc.text('$395.00', margin + 225, y);
  doc.setFont('helvetica', 'normal');
  doc.text('when you return the Vehicle at the end of the scheduled Lease', margin + 265, y);
  y += 10;
  doc.text('Term. This Fee will not apply if the Lease ends early or if you buy the Vehicle at the end of the Lease Term.', margin, y);
  y += 20;

  // ========== SIGNATURES (First Set) ==========
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Signatures', margin, y);
  y += 20;

  doc.setFontSize(9);
  doc.text('_'.repeat(50), margin, y);
  doc.text('_'.repeat(25), margin + 320, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.text('Lessee Signature', margin, y);
  doc.text('Date', margin + 320, y);
  y += 25;

  doc.text('_'.repeat(50), margin, y);
  doc.text('_'.repeat(25), margin + 320, y);
  y += 12;
  doc.text('Co-Lessee Signature', margin, y);
  doc.text('Date', margin + 320, y);
  y += 25;

  doc.text('_'.repeat(50), margin, y);
  doc.text('_'.repeat(25), margin + 320, y);
  y += 12;
  doc.text('Lessor Signature', margin, y);
  doc.text('Date', margin + 320, y);
  y += 30;

  // ========== NOTICE ==========
  addNewPageIfNeeded(80);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTICE:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Your ownership rights in the Vehicle will only be established once you decide to exercise your option to purchase the Vehicle.', margin + 45, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  const noticeText = 'THIS DOCUMENT CONSTITUTES A LEGALLY BINDING LEASE AGREEMENT. THIS DOCUMENT IS NOT INTENDED TO BE A PURCHASE AGREEMENT. PLEASE CAREFULLY REVIEW THESE MATTERS AND CONSIDER SEEKING INDEPENDENT PROFESSIONAL ADVICE IF YOU HAVE ANY QUESTIONS REGARDING THIS TRANSACTION. YOU HAVE THE RIGHT TO RECEIVE AN EXACT COPY OF THE AGREEMENT YOU SIGN.';
  const noticeLines = doc.splitTextToSize(noticeText, contentWidth);
  doc.text(noticeLines, margin, y);
  y += noticeLines.length * 10 + 15;

  doc.setFont('helvetica', 'bold');
  doc.text('Arbitration.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('This Lease contains an Arbitration Agreement that affects your rights. By signing this Lease, you are acknowledging', margin + 55, y);
  y += 10;
  doc.text('and accepting the terms of the Arbitration Agreement.', margin, y);

  // Save the document
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  doc.save(`CarWorld_Lease_${timestamp}.pdf`);
}

export async function downloadLeasePDF(contractData: ContractData): Promise<void> {
  generateLeasePDF(contractData);
}
