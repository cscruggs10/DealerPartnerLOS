import jsPDF from 'jspdf';
import type { ContractData } from '../components/DealCalculator';

// ============================================================================
// Constants
// ============================================================================

const ASSIGNEE_INFO = {
  name: 'I Finance LLC',
  address: '6440 Winchester Rd',
  cityStateZip: 'Memphis, TN 38115',
};

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

// ============================================================================
// Assignment Agreement PDF Generation
// ============================================================================

export function generateAssignmentAgreementPDF(contractData: ContractData): void {
  const { calculation, vehicle, customer, dealerProfile } = contractData;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;
  const bottomMargin = 50;
  let y = margin;

  const today = new Date().toLocaleDateString('en-US');
  const dealerName = dealerProfile?.name || '[DEALER NAME]';
  const dealerAddress = dealerProfile?.address || '[DEALER ADDRESS]';

  // Helper to add page if needed
  const checkPage = (needed: number): boolean => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Helper for wrapped text
  const addWrappedText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 1.3;
    checkPage(lines.length * lineHeight);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight;
  };

  // ==================== HEADER ====================

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ASSIGNMENT OF LEASE AGREEMENT', pageWidth / 2, y, { align: 'center' });
  y += 20;

  doc.setFontSize(12);
  doc.text('(Full Assignment Without Recourse)', pageWidth / 2, y, { align: 'center' });
  y += 30;

  // ==================== DATE AND REFERENCE ====================

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${today}`, margin, y);
  y += 20;

  // ==================== PARTIES ====================

  doc.setFont('helvetica', 'bold');
  doc.text('PARTIES:', margin, y);
  y += 15;

  doc.setFont('helvetica', 'bold');
  doc.text('ASSIGNOR (Dealer/Lessor):', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.text(dealerName, margin + 20, y);
  y += 12;
  const addressLines = dealerAddress.split('\n');
  for (const line of addressLines) {
    doc.text(line, margin + 20, y);
    y += 12;
  }
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('ASSIGNEE:', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.text(ASSIGNEE_INFO.name, margin + 20, y);
  y += 12;
  doc.text(ASSIGNEE_INFO.address, margin + 20, y);
  y += 12;
  doc.text(ASSIGNEE_INFO.cityStateZip, margin + 20, y);
  y += 20;

  // ==================== LESSEE INFORMATION ====================

  doc.setFont('helvetica', 'bold');
  doc.text('LESSEE (Customer):', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  const lesseeName = customer.lesseeName || '___________________________';
  const lesseeAddress = customer.lesseeAddress || '___________________________';
  const lesseeCityStateZip = `${customer.lesseeCity || '_________'}, ${customer.lesseeState || '____'} ${customer.lesseeZip || '_______'}`;
  doc.text(`Name: ${lesseeName}`, margin + 20, y);
  y += 12;
  doc.text(`Address: ${lesseeAddress}`, margin + 20, y);
  y += 12;
  doc.text(`City/State/ZIP: ${lesseeCityStateZip}`, margin + 20, y);
  y += 25;

  // ==================== VEHICLE INFORMATION ====================

  doc.setFont('helvetica', 'bold');
  doc.text('VEHICLE INFORMATION:', margin, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.text(`Year: ${vehicle.year || '______'}`, margin + 20, y);
  doc.text(`Make: ${vehicle.make || '________'}`, margin + 150, y);
  doc.text(`Model: ${vehicle.model || '________'}`, margin + 280, y);
  y += 12;
  doc.text(`VIN: ${vehicle.vin || '_______________________'}`, margin + 20, y);
  y += 12;
  doc.text(`Odometer: ${vehicle.odometer || '________'} miles`, margin + 20, y);
  y += 25;

  // ==================== LEASE TERMS ====================

  doc.setFont('helvetica', 'bold');
  doc.text('LEASE TERMS:', margin, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.text(`Lease Term: ${calculation.termMonths} months`, margin + 20, y);
  y += 12;
  doc.text(`Number of Payments: ${calculation.numberOfPayments}`, margin + 20, y);
  y += 12;
  doc.text(`Payment Amount: ${formatCurrency(calculation.totalPayment)}`, margin + 20, y);
  y += 12;
  doc.text(`Total of Payments: ${formatCurrency(calculation.totalOfPayments)}`, margin + 20, y);
  y += 12;
  doc.text(`Residual Value: ${formatCurrency(calculation.residualValue)}`, margin + 20, y);
  y += 30;

  // ==================== ASSIGNMENT TERMS ====================

  checkPage(200);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ASSIGNMENT TERMS AND CONDITIONS', margin, y);
  y += 20;

  // Section 1
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. ASSIGNMENT OF RIGHTS AND INTERESTS', margin, y);
  y += 15;
  addWrappedText(
    'For good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, Assignor hereby sells, assigns, transfers, and conveys to Assignee, without recourse, all of Assignor\'s right, title, and interest in and to:',
    10
  );
  y += 5;
  addWrappedText('(a) The Motor Vehicle Lease Agreement ("Lease") identified above between Assignor and Lessee;', 10);
  addWrappedText('(b) The Vehicle described above, including certificate of title;', 10);
  addWrappedText('(c) All monies due or to become due under the Lease;', 10);
  addWrappedText('(d) All security interests and liens in the Vehicle;', 10);
  addWrappedText('(e) All rights to enforce the Lease and collect payments thereunder;', 10);
  addWrappedText('(f) All insurance proceeds and other benefits relating to the Vehicle or Lease;', 10);
  addWrappedText('(g) All claims and rights of action arising from the Lease.', 10);
  y += 10;

  // Section 2
  checkPage(80);
  doc.setFont('helvetica', 'bold');
  doc.text('2. WITHOUT RECOURSE', margin, y);
  y += 15;
  addWrappedText(
    'This assignment is made WITHOUT RECOURSE to Assignor. Assignee assumes all risk of collection and performance under the Lease. Assignor shall have no liability to Assignee for:',
    10
  );
  y += 5;
  addWrappedText('(a) Lessee\'s failure to make payments when due;', 10);
  addWrappedText('(b) Lessee\'s default under any term of the Lease;', 10);
  addWrappedText('(c) Any deficiency balance upon early termination or repossession;', 10);
  addWrappedText('(d) The condition, value, or marketability of the Vehicle;', 10);
  addWrappedText('(e) Any claims by Lessee or third parties relating to the Vehicle or Lease.', 10);
  y += 10;

  // Section 3
  checkPage(80);
  doc.setFont('helvetica', 'bold');
  doc.text('3. ASSIGNOR REPRESENTATIONS AND WARRANTIES', margin, y);
  y += 15;
  addWrappedText('Assignor represents and warrants to Assignee that:', 10);
  y += 5;
  addWrappedText('(a) The Lease is genuine, valid, and enforceable according to its terms;', 10);
  addWrappedText('(b) Assignor has good and marketable title to the Lease and Vehicle, free of all liens and encumbrances except as disclosed;', 10);
  addWrappedText('(c) Assignor has full power and authority to execute this Assignment;', 10);
  addWrappedText('(d) All information provided to Assignee regarding the Lessee and Lease is true, accurate, and complete;', 10);
  addWrappedText('(e) The Lease has been duly executed and delivered by Lessee;', 10);
  addWrappedText('(f) To Assignor\'s knowledge, there are no defenses, offsets, or counterclaims against the Lease;', 10);
  addWrappedText('(g) All documents delivered to Assignee are true and correct copies of the originals.', 10);
  y += 10;

  // Section 4
  checkPage(60);
  doc.setFont('helvetica', 'bold');
  doc.text('4. DELIVERY OF DOCUMENTS', margin, y);
  y += 15;
  addWrappedText(
    'Upon execution of this Assignment, Assignor shall deliver to Assignee the following documents:',
    10
  );
  y += 5;
  addWrappedText('(a) Original executed Lease Agreement;', 10);
  addWrappedText('(b) Certificate of Title (or application therefor) endorsed to Assignee;', 10);
  addWrappedText('(c) All insurance policies and certificates naming Assignee as loss payee;', 10);
  addWrappedText('(d) Copies of Lessee\'s driver\'s license and proof of insurance;', 10);
  addWrappedText('(e) Any other documents reasonably requested by Assignee.', 10);
  y += 10;

  // Section 5
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.text('5. PAYMENT TO ASSIGNOR', margin, y);
  y += 15;
  addWrappedText(
    `Upon acceptance of this Assignment and receipt of all required documents, Assignee shall pay to Assignor the sum of ${formatCurrency(calculation.adjustedCapCost)} representing the adjusted capitalized cost of the Lease, less any dealer reserve or holdback as agreed between the parties.`,
    10
  );
  y += 10;

  // Section 6
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.text('6. TITLE TRANSFER', margin, y);
  y += 15;
  addWrappedText(
    'Assignor agrees to execute and deliver all documents necessary to transfer the certificate of title to the Vehicle to Assignee, including any power of attorney forms required by the applicable state motor vehicle department.',
    10
  );
  y += 10;

  // Section 7
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.text('7. COLLECTION AND SERVICING', margin, y);
  y += 15;
  addWrappedText(
    'From and after the date of this Assignment, Assignee shall be responsible for all collection and servicing of the Lease, including without limitation, billing, payment processing, customer service, and enforcement of Lease terms.',
    10
  );
  y += 10;

  // Section 8
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.text('8. GOVERNING LAW', margin, y);
  y += 15;
  addWrappedText(
    'This Assignment shall be governed by and construed in accordance with the laws of the State of Tennessee, without regard to conflicts of law principles.',
    10
  );
  y += 10;

  // Section 9
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.text('9. BINDING EFFECT', margin, y);
  y += 15;
  addWrappedText(
    'This Assignment shall be binding upon and inure to the benefit of the parties hereto and their respective successors and assigns.',
    10
  );
  y += 10;

  // Section 10
  checkPage(50);
  doc.setFont('helvetica', 'bold');
  doc.text('10. ENTIRE AGREEMENT', margin, y);
  y += 15;
  addWrappedText(
    'This Assignment constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements and understandings, whether written or oral.',
    10
  );
  y += 30;

  // ==================== SIGNATURES ====================

  checkPage(200);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SIGNATURES', pageWidth / 2, y + 14, { align: 'center' });
  y += 35;

  // Assignor Signature
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ASSIGNOR:', margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.text(dealerName, margin, y);
  y += 25;

  doc.text('By: ________________________________________', margin, y);
  y += 12;
  doc.setFontSize(8);
  doc.text('Authorized Representative Signature', margin + 25, y);
  y += 20;

  doc.setFontSize(10);
  doc.text('Print Name: ________________________________', margin, y);
  y += 15;
  doc.text('Title: _____________________________________', margin, y);
  y += 15;
  doc.text('Date: _____________________________________', margin, y);
  y += 30;

  // Assignee Signature
  checkPage(100);
  doc.setFont('helvetica', 'bold');
  doc.text('ASSIGNEE:', margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.text(ASSIGNEE_INFO.name, margin, y);
  y += 12;
  doc.text(ASSIGNEE_INFO.address, margin, y);
  y += 12;
  doc.text(ASSIGNEE_INFO.cityStateZip, margin, y);
  y += 25;

  doc.text('By: ________________________________________', margin, y);
  y += 12;
  doc.setFontSize(8);
  doc.text('Authorized Representative Signature', margin + 25, y);
  y += 20;

  doc.setFontSize(10);
  doc.text('Print Name: ________________________________', margin, y);
  y += 15;
  doc.text('Title: _____________________________________', margin, y);
  y += 15;
  doc.text('Date: _____________________________________', margin, y);

  // Save the document
  doc.save('Assignment_Agreement.pdf');
}

export function downloadAssignmentAgreementPDF(contractData: ContractData): void {
  generateAssignmentAgreementPDF(contractData);
}
