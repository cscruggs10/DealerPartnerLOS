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

  const capCostReduction = calculation.capCostReduction;
  const docFee = calculation.docFee;
  // Amount due at signing = down payment (which is doc fee + cap cost reduction)
  const itemTotal = calculation.downPayment;

  autoTable(doc, {
    startY: y,
    head: [['Amount due at Signing:', '', 'How the amount due will be paid:', '']],
    body: [
      ['Capitalized Cost Reduction', '+' + formatCurrency(capCostReduction), 'Net Trade-In allowance', '$ ___________'],
      ['Documentation fees', '+' + formatCurrency(docFee), 'Rebates and non-cash credits', '+$ ___________'],
      ['', '', 'Amount to be paid in cash', '+' + formatCurrency(itemTotal)],
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
  y += 25;

  // ========== VOLUNTARY PROTECTION PRODUCTS ==========
  addNewPageIfNeeded(250);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Voluntary Protection Products', margin, y);
  y += 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const voluntaryText = 'Any of the following voluntary protection policies are available for purchase. They are not a required condition of this Lease and will not impact our choice to let you lease the vehicle. By signing below, you confirm that you have read and received a copy of the contract(s) for the product(s) and that you wish to purchase the item as described. You have rejected any coverage we offered if there is no coverage or fee for an item.';
  const voluntaryLines = doc.splitTextToSize(voluntaryText, contentWidth);
  doc.text(voluntaryLines, margin, y);
  y += voluntaryLines.length * 10 + 15;

  // Protection Products Table
  autoTable(doc, {
    startY: y,
    head: [['Product', 'Price', 'Term', 'Coverage']],
    body: [
      ['Service Contract', '$ ___________', '___________', '_'.repeat(40)],
      ['Gap Coverage or Gap Waiver', '$ ___________', '___________', '_'.repeat(40)],
      ['Mechanical Breakdown Protection (MBP)', '$ ___________', '___________', '_'.repeat(40)],
      ['Extended Warranty', '$ ___________', '___________', '_'.repeat(40)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 160 },
      1: { cellWidth: 80 },
      2: { cellWidth: 70 },
      3: { cellWidth: contentWidth - 310 },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 15;

  // Voluntary Products Signatures
  doc.setFontSize(9);
  doc.text('Lessee Name: ___________________________ Date: ___________', margin, y);
  y += 15;
  doc.text('Co-Lessee Name: ___________________________ Date: ___________', margin, y);
  y += 15;
  doc.text('Lessor Name: ___________________________ Date: ___________', margin, y);
  y += 20;

  // Security Deposit Service Fee
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Service Fee for Unclaimed Refunds of Security Deposits.', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 10;
  const securityText = 'If we send you a check to refund the remaining portion of any Security Deposit after this Lease ends and you fail to collect it within six months, you acknowledge that we have the right to deduct a monthly service charge from the remaining portion of the Security Deposit until it is fully refunded to you or depleted.';
  const securityLines = doc.splitTextToSize(securityText, contentWidth);
  doc.text(securityLines, margin, y);
  y += securityLines.length * 10 + 20;

  // ========== WARRANTIES ==========
  addNewPageIfNeeded(150);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Warranties', margin, y);
  y += 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const warrantyText1 = 'Warranties. The Vehicle is covered by the express warranties that are applicable to this Lease.';
  doc.text(warrantyText1, margin, y);
  y += 15;

  const warrantyText2 = 'The warranty provided by the manufacturer. This warranty is provided by the manufacturer and is NOT the responsibility of the Lessor.';
  const warrantyLines2 = doc.splitTextToSize(warrantyText2, contentWidth);
  doc.text(warrantyLines2, margin, y);
  y += warrantyLines2.length * 10 + 10;

  const warrantyText3 = 'By signing this Lease, you confirm that you have received a copy of the written warranties mentioned above. We want to clarify that we (the Lessor) do not provide any explicit or implicit guarantees beyond what has been mentioned earlier (if applicable). Unless legally mandated, the Lessor does not provide any implied warranty of merchantability or any warranty regarding the suitability of the Vehicle for a specific purpose. With the exception of what has been mentioned previously, you will accept the Vehicle in its current condition, AS IS, including WITH ANY AND ALL FAULTS.';
  const warrantyLines3 = doc.splitTextToSize(warrantyText3, contentWidth);
  doc.text(warrantyLines3, margin, y);
  y += warrantyLines3.length * 10 + 25;

  // ========== ADDITIONAL LEASE TERMS ==========
  addNewPageIfNeeded(100);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Additional Lease Terms', pageWidth / 2, y, { align: 'center' });
  y += 25;

  // Definitions
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Definitions.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const defText = 'Each person or legal entity that signs this Lease as the "Lessee" individually and collectively is referred to as "you," "your," and "Lessee." The Lessor who signs this Lease, as well as any successors and assigns, are referred to as "we," "our," "us," and "Lessor."';
  const defLines = doc.splitTextToSize(defText, contentWidth);
  doc.text(defLines, margin, y);
  y += defLines.length * 10 + 15;

  // Lease Agreement
  addNewPageIfNeeded(120);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Lease Agreement.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const leaseAgreeText = 'You accept that we will lease you the automobile (referred to as the "Vehicle") for the duration of this Lease. You promise to fulfil your end of the Lease and to pay any owed sums. Except in the event the "Business, commercial, or agricultural purpose" box is checked in the Lease, this Lease is considered to be a personal, family, or household purpose transaction.';
  const leaseAgreeLines = doc.splitTextToSize(leaseAgreeText, contentWidth);
  doc.text(leaseAgreeLines, margin, y);
  y += leaseAgreeLines.length * 10 + 15;

  // Payments
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Payments.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const paymentText = 'You agree to pay us the amounts stated in the Federal Consumer Disclosures. The payment amounts stated are based on the payment frequency you selected. If you have not paid at least fifteen (15) days before this Lease ends, we may limit your option to buy the Vehicle, extend this Lease, or lease another vehicle.';
  const paymentLines = doc.splitTextToSize(paymentText, contentWidth);
  doc.text(paymentLines, margin, y);
  y += paymentLines.length * 10 + 15;

  // Late Charges
  addNewPageIfNeeded(80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Late Charges.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const lateText = 'If a payment is not received within ten (10) days of the scheduled due date, you agree to pay us a late charge of $25.00 or 5% of the payment amount, whichever is greater. You agree that the late charge is reasonable and represents a fair estimate of our costs for processing late payments.';
  const lateLines = doc.splitTextToSize(lateText, contentWidth);
  doc.text(lateLines, margin, y);
  y += lateLines.length * 10 + 15;

  // Returned Payment Fee
  addNewPageIfNeeded(80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Returned Payment Fee.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const returnedText = 'If any payment you make to us is returned unpaid for any reason, you agree to pay us a returned payment fee of $30.00 in addition to any late charges that may apply.';
  const returnedLines = doc.splitTextToSize(returnedText, contentWidth);
  doc.text(returnedLines, margin, y);
  y += returnedLines.length * 10 + 15;

  // Security Deposit
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Security Deposit.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const secDepText = 'If a Security Deposit is required and stated in this Lease, you agree to pay us that amount. The Security Deposit may be used by us to cover any amounts you owe us under this Lease. If you fulfill all of your obligations under this Lease, we will refund the Security Deposit to you, without interest, within 30 days after the end of the Lease.';
  const secDepLines = doc.splitTextToSize(secDepText, contentWidth);
  doc.text(secDepLines, margin, y);
  y += secDepLines.length * 10 + 15;

  // Use of Vehicle
  addNewPageIfNeeded(120);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Use of Vehicle.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const useText = 'You agree to use the Vehicle only for personal, family, or household purposes unless the "Business, commercial, or agricultural purpose" box is checked in the Lease. You will not use the Vehicle for any illegal purpose, for hire, in races or speed contests, or allow anyone to operate the Vehicle who does not have a valid driver\'s license. You will not remove the Vehicle from the United States without our prior written consent.';
  const useLines = doc.splitTextToSize(useText, contentWidth);
  doc.text(useLines, margin, y);
  y += useLines.length * 10 + 15;

  // Maintenance and Repairs
  addNewPageIfNeeded(120);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Maintenance and Repairs.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const maintText = 'You agree to properly maintain the Vehicle according to the manufacturer\'s recommendations and keep it in good working order. You are responsible for all repairs and maintenance during the Lease term, including but not limited to oil changes, tire rotations, brake service, and any other mechanical repairs. You must keep all maintenance records and provide them to us upon request.';
  const maintLines = doc.splitTextToSize(maintText, contentWidth);
  doc.text(maintLines, margin, y);
  y += maintLines.length * 10 + 15;

  // Insurance Requirements
  addNewPageIfNeeded(150);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Insurance Requirements.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const insText = 'You agree to maintain at your expense the following insurance coverage throughout the Lease term: (a) comprehensive and collision coverage with a maximum deductible of $500; (b) liability coverage with minimum limits of $100,000 per person, $300,000 per occurrence for bodily injury, and $50,000 for property damage; and (c) any other coverage required by law. The insurance policy must name us as loss payee and additional insured. You must provide us with proof of insurance upon request. If you fail to maintain required insurance, we may obtain insurance on the Vehicle and charge you the cost.';
  const insLines = doc.splitTextToSize(insText, contentWidth);
  doc.text(insLines, margin, y);
  y += insLines.length * 10 + 15;

  // Title and Registration
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Title and Registration.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const titleText = 'We will hold title to the Vehicle during the Lease term. You agree to pay all registration fees, license fees, and taxes related to the Vehicle. You will not attempt to transfer, sell, assign, or encumber the Vehicle or this Lease without our prior written consent.';
  const titleLines = doc.splitTextToSize(titleText, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 10 + 15;

  // Loss or Damage
  addNewPageIfNeeded(150);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Loss or Damage to Vehicle.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const lossText = 'If the Vehicle is damaged, lost, or destroyed, you must immediately notify us and your insurance company. You are responsible for any loss or damage to the Vehicle, regardless of cause, except for normal wear and use. If the Vehicle is determined to be a total loss, you will be liable for any difference between the insurance proceeds and the amount you owe under this Lease, unless Gap Coverage applies.';
  const lossLines = doc.splitTextToSize(lossText, contentWidth);
  doc.text(lossLines, margin, y);
  y += lossLines.length * 10 + 15;

  // Default
  addNewPageIfNeeded(180);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Default.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const defaultText = 'You will be in default under this Lease if: (a) you fail to make any payment when due; (b) you fail to maintain required insurance; (c) you breach any other term of this Lease; (d) you become insolvent or file for bankruptcy; (e) you provide false information in connection with this Lease; or (f) you abandon the Vehicle. Upon default, we may, to the extent permitted by law: (1) terminate this Lease; (2) require you to return the Vehicle immediately; (3) repossess the Vehicle without notice; (4) require you to pay all amounts due under this Lease, including early termination charges; and (5) exercise any other rights available to us under law.';
  const defaultLines = doc.splitTextToSize(defaultText, contentWidth);
  doc.text(defaultLines, margin, y);
  y += defaultLines.length * 10 + 15;

  // Early Termination
  addNewPageIfNeeded(180);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Early Termination.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const earlyText = 'You may terminate this Lease early by returning the Vehicle and paying the Early Termination Amount. The Early Termination Amount equals: (a) all unpaid amounts due under this Lease; plus (b) the remaining depreciation and rent charges; plus (c) any applicable fees and charges; minus (d) the wholesale value of the Vehicle at termination. You understand that early termination may result in a substantial charge, and the earlier you terminate, the greater the charge may be.';
  const earlyLines = doc.splitTextToSize(earlyText, contentWidth);
  doc.text(earlyLines, margin, y);
  y += earlyLines.length * 10 + 15;

  // End of Lease Options
  addNewPageIfNeeded(150);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('End of Lease Options.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const endText = 'At the scheduled end of this Lease, you may: (a) return the Vehicle to us in accordance with the return requirements; (b) purchase the Vehicle for the Purchase Option Price stated in this Lease plus any applicable fees and taxes; or (c) if we agree, extend this Lease under terms we determine. You must notify us of your choice at least 30 days before the end of the Lease.';
  const endLines = doc.splitTextToSize(endText, contentWidth);
  doc.text(endLines, margin, y);
  y += endLines.length * 10 + 15;

  // Vehicle Return Requirements
  addNewPageIfNeeded(150);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Vehicle Return Requirements.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const returnReqText = 'When you return the Vehicle, it must be in good operating condition, with all equipment and accessories originally included. The Vehicle will be inspected for excess wear and use. You will be charged for: (a) mileage in excess of the limit stated in this Lease at the rate specified; (b) excess wear and damage beyond normal use; (c) missing equipment or accessories; and (d) any repairs needed to return the Vehicle to good operating condition.';
  const returnReqLines = doc.splitTextToSize(returnReqText, contentWidth);
  doc.text(returnReqLines, margin, y);
  y += returnReqLines.length * 10 + 15;

  // Excess Wear Standards
  addNewPageIfNeeded(180);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Excess Wear and Use Standards.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const excessText = 'Excess wear and use includes but is not limited to: dents, scratches, or chips larger than normal minor road damage; tears, burns, or stains in the interior; cracked or broken glass; mechanical damage from misuse or lack of maintenance; tire wear beyond acceptable limits; and any modifications made without our consent. The cost to repair or replace items will be determined based on reasonable market rates.';
  const excessLines = doc.splitTextToSize(excessText, contentWidth);
  doc.text(excessLines, margin, y);
  y += excessLines.length * 10 + 15;

  // Indemnification
  addNewPageIfNeeded(120);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Indemnification.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const indemnText = 'You agree to indemnify, defend, and hold us harmless from any and all claims, losses, damages, liabilities, costs, and expenses (including reasonable attorney fees) arising from your use, operation, or possession of the Vehicle, except to the extent caused by our gross negligence or willful misconduct.';
  const indemnLines = doc.splitTextToSize(indemnText, contentWidth);
  doc.text(indemnLines, margin, y);
  y += indemnLines.length * 10 + 15;

  // Assignment
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Assignment.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const assignText = 'We may assign this Lease and our rights under it without your consent. If we do, the assignee will have all of our rights but none of our obligations. You may not assign this Lease or your rights or obligations under it without our prior written consent.';
  const assignLines = doc.splitTextToSize(assignText, contentWidth);
  doc.text(assignLines, margin, y);
  y += assignLines.length * 10 + 15;

  // Governing Law
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Governing Law.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const govText = `This Lease will be governed by and construed in accordance with the laws of the State of ${calculation.state}, without regard to its conflict of laws principles. Any legal action arising from this Lease must be brought in the courts of the State of ${calculation.state}.`;
  const govLines = doc.splitTextToSize(govText, contentWidth);
  doc.text(govLines, margin, y);
  y += govLines.length * 10 + 15;

  // Entire Agreement
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Entire Agreement.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const entireText = 'This Lease, including any addenda and attachments, constitutes the entire agreement between you and us regarding the lease of the Vehicle. No modification of this Lease will be effective unless in writing and signed by both parties.';
  const entireLines = doc.splitTextToSize(entireText, contentWidth);
  doc.text(entireLines, margin, y);
  y += entireLines.length * 10 + 15;

  // Severability
  addNewPageIfNeeded(80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Severability.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const severText = 'If any provision of this Lease is found to be invalid or unenforceable, the remaining provisions will continue in full force and effect.';
  const severLines = doc.splitTextToSize(severText, contentWidth);
  doc.text(severLines, margin, y);
  y += severLines.length * 10 + 15;

  // Waiver
  addNewPageIfNeeded(80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Waiver.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const waiverText = 'Our failure to enforce any right or provision of this Lease will not constitute a waiver of such right or provision. Any waiver must be in writing and signed by us to be effective.';
  const waiverLines = doc.splitTextToSize(waiverText, contentWidth);
  doc.text(waiverLines, margin, y);
  y += waiverLines.length * 10 + 15;

  // Notices
  addNewPageIfNeeded(100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Notices.', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y += 12;
  const noticesText = 'Any notice required or permitted under this Lease must be in writing and will be deemed given when delivered personally, sent by certified mail, or sent by overnight courier to the address shown in this Lease. You agree to notify us promptly of any change in your address.';
  const noticesLines = doc.splitTextToSize(noticesText, contentWidth);
  doc.text(noticesLines, margin, y);
  y += noticesLines.length * 10 + 20;

  // ========== ARBITRATION AGREEMENT ==========
  addNewPageIfNeeded(300);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ARBITRATION AGREEMENT', pageWidth / 2, y, { align: 'center' });
  y += 20;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PLEASE READ THIS ARBITRATION AGREEMENT CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS.', margin, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  const arbText1 = 'Agreement to Arbitrate. You and we agree that any claim, dispute, or controversy between you and us arising from or relating to this Lease, the Vehicle, or any related transaction, whether based in contract, tort, statute, fraud, misrepresentation, or any other legal theory, will be resolved by binding arbitration administered by the American Arbitration Association ("AAA") under its Consumer Arbitration Rules.';
  const arbLines1 = doc.splitTextToSize(arbText1, contentWidth);
  doc.text(arbLines1, margin, y);
  y += arbLines1.length * 10 + 10;

  const arbText2 = 'Class Action Waiver. YOU AND WE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR OUR INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING. The arbitrator may not consolidate more than one person\'s claims and may not preside over any form of representative or class proceeding.';
  const arbLines2 = doc.splitTextToSize(arbText2, contentWidth);
  doc.text(arbLines2, margin, y);
  y += arbLines2.length * 10 + 10;

  const arbText3 = 'Arbitration Procedures. The arbitration will be conducted in the county where you reside or at another mutually agreed location. The arbitrator will apply applicable substantive law and the provisions of this Lease. The arbitrator\'s decision will be final and binding, and judgment may be entered in any court of competent jurisdiction.';
  const arbLines3 = doc.splitTextToSize(arbText3, contentWidth);
  doc.text(arbLines3, margin, y);
  y += arbLines3.length * 10 + 10;

  const arbText4 = 'Costs of Arbitration. We will pay all AAA filing, administration, and arbitrator fees for claims of $10,000 or less. For claims over $10,000, filing and arbitration fees will be shared equally. Each party will bear its own attorney fees unless the arbitrator determines that a claim was frivolous.';
  const arbLines4 = doc.splitTextToSize(arbText4, contentWidth);
  doc.text(arbLines4, margin, y);
  y += arbLines4.length * 10 + 10;

  const arbText5 = 'Right to Opt Out. You have the right to opt out of this Arbitration Agreement by sending written notice of your decision to opt out to us within 30 days of signing this Lease. If you opt out, you may still pursue claims in court.';
  const arbLines5 = doc.splitTextToSize(arbText5, contentWidth);
  doc.text(arbLines5, margin, y);
  y += arbLines5.length * 10 + 20;

  // ========== NOTICE ==========
  addNewPageIfNeeded(120);
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
  y += noticeLines.length * 10 + 20;

  // ========== FINAL SIGNATURES ==========
  addNewPageIfNeeded(200);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Signatures', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('By signing below, you acknowledge that you have read, understand, and agree to all terms of this Lease Agreement, including the Arbitration Agreement.', margin, y);
  y += 25;

  doc.setFontSize(9);
  doc.text('_'.repeat(50), margin, y);
  doc.text('_'.repeat(25), margin + 320, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.text('Lessee Signature', margin, y);
  doc.text('Date', margin + 320, y);
  y += 12;
  if (customer.lesseeName) {
    doc.text(`Print Name: ${customer.lesseeName}`, margin, y);
  } else {
    doc.text('Print Name: _________________________________', margin, y);
  }
  y += 25;

  doc.text('_'.repeat(50), margin, y);
  doc.text('_'.repeat(25), margin + 320, y);
  y += 12;
  doc.text('Co-Lessee Signature', margin, y);
  doc.text('Date', margin + 320, y);
  y += 12;
  if (customer.coLesseeName) {
    doc.text(`Print Name: ${customer.coLesseeName}`, margin, y);
  } else {
    doc.text('Print Name: _________________________________', margin, y);
  }
  y += 25;

  doc.text('_'.repeat(50), margin, y);
  doc.text('_'.repeat(25), margin + 320, y);
  y += 12;
  doc.text('Lessor Signature', margin, y);
  doc.text('Date', margin + 320, y);
  y += 12;
  doc.text('Print Name: _________________________________', margin, y);
  y += 30;

  // Acknowledgment
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('I/We acknowledge receipt of a completed copy of this Lease Agreement.', margin, y);
  y += 15;
  doc.text('Lessee Initials: _______     Co-Lessee Initials: _______     Date: _______________', margin, y);

  // Save the document
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  doc.save(`CarWorld_Lease_${timestamp}.pdf`);
}

export async function downloadLeasePDF(contractData: ContractData): Promise<void> {
  generateLeasePDF(contractData);
}
