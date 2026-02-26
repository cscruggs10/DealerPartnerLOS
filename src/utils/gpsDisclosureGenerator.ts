import jsPDF from 'jspdf';
import type { ContractData } from '../components/DealCalculator';

// ============================================================================
// GPS Disclosure Agreement Generator
// PassTime GPS Device Disclosure Form
// ============================================================================

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function generateGPSDisclosurePDF(contractData: ContractData): void {
  const { vehicle, customer, dealerProfile, contractDate } = contractData;

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

  // Use contractDate for backdated deals, otherwise use current date
  const today = contractDate || new Date().toLocaleDateString('en-US');

  // Helper to check if we need a new page
  const checkPage = (needed: number): void => {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }
  };

  // ==================== PAGE 1: GPS DISCLOSURE HEADER ====================

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('GPS TRACKING DEVICE', pageWidth / 2, y, { align: 'center' });
  y += 20;
  doc.text('DISCLOSURE AND ACKNOWLEDGMENT', pageWidth / 2, y, { align: 'center' });
  y += 28;

  // PassTime Device Notice
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 20, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PassTime GPS Device', pageWidth / 2, y + 14, { align: 'center' });
  y += 30;

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${today}`, margin, y);
  y += 20;

  // Vehicle Information Box
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 85, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, contentWidth, 85, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('VEHICLE INFORMATION:', margin + 10, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const vehicleYear = vehicle.year || '____________';
  const vehicleMake = vehicle.make || '____________';
  const vehicleModel = vehicle.model || '____________';
  const vehicleVin = vehicle.vin || '________________________________';
  const vehicleOdometer = vehicle.odometer || '____________';
  const vehicleBodyStyle = vehicle.bodyStyle || '';

  // Vehicle description line
  const vehicleDesc = `${vehicleYear} ${vehicleMake} ${vehicleModel}${vehicleBodyStyle ? ' ' + vehicleBodyStyle : ''}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(vehicleDesc, margin + 10, y + 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`VIN: ${vehicleVin}`, margin + 10, y + 52);
  doc.text(`Odometer: ${vehicleOdometer} miles`, margin + 10, y + 66);
  doc.text(`Body Style: ${vehicleBodyStyle || 'N/A'}`, margin + 10, y + 80);
  y += 100;

  // Customer Information Box
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 85, 'F');
  doc.rect(margin, y, contentWidth, 85, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('LESSEE INFORMATION:', margin + 10, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lesseeName = customer.lesseeName || '________________________________';
  const lesseeAddress = customer.lesseeAddress || '________________________________';
  const lesseeCity = customer.lesseeCity || '____________';
  const lesseeState = customer.lesseeState || '____';
  const lesseeZip = customer.lesseeZip || '_______';
  const lesseePhone = customer.lesseePhone || '________________';

  // Customer name prominently
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(lesseeName, margin + 10, y + 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Address: ${lesseeAddress}`, margin + 10, y + 52);
  doc.text(`City/State/ZIP: ${lesseeCity}, ${lesseeState} ${lesseeZip}`, margin + 10, y + 66);
  doc.text(`Phone: ${lesseePhone}`, margin + 10, y + 80);
  y += 100;

  // ==================== DISCLOSURE SECTION ====================

  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 18, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DISCLOSURE OF GPS TRACKING DEVICE', pageWidth / 2, y + 12, { align: 'center' });
  y += 28;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const disclosureText = `The vehicle described above is equipped with a PassTime GPS tracking device. By signing this disclosure, you acknowledge that you have been informed of the following:`;
  const disclosureLines = doc.splitTextToSize(disclosureText, contentWidth);
  doc.text(disclosureLines, margin, y);
  y += disclosureLines.length * 12 + 10;

  // Numbered disclosure points
  const disclosurePoints = [
    'A GPS (Global Positioning System) tracking device has been installed in the above-described vehicle.',
    'The GPS device allows the Lessor and/or its agents to remotely determine the physical location of the vehicle at any time.',
    'The GPS device may include a starter interrupt feature that can prevent the vehicle from starting if payments are not made in accordance with the lease agreement.',
    'The GPS device will remain installed and active throughout the entire term of the lease agreement.',
    'You agree not to remove, disconnect, tamper with, or otherwise interfere with the GPS device. Tampering with or removing the device is a violation of your lease agreement and may result in default.',
    'The GPS device may collect and transmit location data, vehicle diagnostic information, and other data to the Lessor or its authorized service providers.',
    'Location data may be used to locate and recover the vehicle in the event of default, theft, or other circumstances as permitted by law.',
    'In the event of late payment or default, the starter interrupt feature may be activated after appropriate notice has been provided as required by applicable law.',
  ];

  doc.setFontSize(9);
  for (let i = 0; i < disclosurePoints.length; i++) {
    checkPage(40);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}.`, margin, y);
    doc.setFont('helvetica', 'normal');
    const pointLines = doc.splitTextToSize(disclosurePoints[i], contentWidth - 20);
    doc.text(pointLines, margin + 15, y);
    y += pointLines.length * 11 + 6;
  }

  y += 10;

  // ==================== EMERGENCY NOTICE ====================
  checkPage(80);

  doc.setFillColor(255, 240, 220);
  doc.rect(margin, y, contentWidth, 60, 'F');
  doc.setDrawColor(200, 150, 100);
  doc.rect(margin, y, contentWidth, 60, 'S');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTANT NOTICE REGARDING STARTER INTERRUPT:', margin + 10, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const emergencyText = `If the starter interrupt feature is activated, the vehicle will not start. This feature will NEVER be activated while the vehicle is in motion. If you experience a medical emergency or other urgent situation and your vehicle will not start, please contact us immediately at the number below. We maintain 24/7 emergency contact availability.`;
  const emergencyLines = doc.splitTextToSize(emergencyText, contentWidth - 20);
  doc.text(emergencyLines, margin + 10, y + 30);
  y += 75;

  // ==================== PRIVACY NOTICE ====================
  checkPage(100);

  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 18, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRIVACY NOTICE', pageWidth / 2, y + 12, { align: 'center' });
  y += 28;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const privacyText = `Location data collected through the GPS device will be used solely for the purposes of securing the Lessor's interest in the vehicle, including but not limited to: locating the vehicle for repossession in the event of default; locating the vehicle in the event of theft; and verifying vehicle location for insurance or law enforcement purposes when required.

Location data will not be sold to third parties or used for marketing purposes. Data may be shared with law enforcement when required by law or court order, or with insurance companies in connection with theft or accident claims.

You may request access to location data collected about your vehicle by submitting a written request to the Lessor. Data will be retained for the duration of the lease agreement plus any period required by applicable law.`;
  const privacyLines = doc.splitTextToSize(privacyText, contentWidth);
  doc.text(privacyLines, margin, y);
  y += privacyLines.length * 11 + 15;

  // ==================== ACKNOWLEDGMENT AND CONSENT ====================
  checkPage(180);

  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 18, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ACKNOWLEDGMENT AND CONSENT', pageWidth / 2, y + 12, { align: 'center' });
  y += 28;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const ackText = `By signing below, I/we acknowledge that:

1. I have read and understand this GPS Tracking Device Disclosure.

2. I consent to the installation and use of the GPS tracking device in the vehicle described above.

3. I understand that the GPS device may include a starter interrupt feature and that this feature may be activated if I fail to make timely payments under my lease agreement.

4. I agree not to remove, disconnect, tamper with, or otherwise interfere with the GPS device.

5. I understand that tampering with the GPS device may constitute default under my lease agreement and may subject me to liability for damage to the device.

6. I have received a copy of this disclosure for my records.`;
  const ackLines = doc.splitTextToSize(ackText, contentWidth);
  doc.text(ackLines, margin, y);
  y += ackLines.length * 11 + 20;

  // ==================== SIGNATURE SECTION ====================
  checkPage(150);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LESSEE SIGNATURE:', margin, y);
  y += 25;

  doc.setFont('helvetica', 'normal');
  doc.text('_____________________________________________', margin, y);
  doc.text('________________', margin + 350, y);
  y += 12;
  doc.setFontSize(8);
  doc.text('Lessee Signature', margin, y);
  doc.text('Date', margin + 350, y);
  y += 20;

  doc.setFontSize(9);
  // Pre-fill the print name with customer name if available
  if (customer.lesseeName) {
    doc.text(`Print Name: ${customer.lesseeName}`, margin, y);
  } else {
    doc.text('Print Name: _____________________________________________', margin, y);
  }
  y += 25;

  // Co-Lessee if applicable
  if (customer.coLesseeName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CO-LESSEE SIGNATURE:', margin, y);
    y += 25;

    doc.setFont('helvetica', 'normal');
    doc.text('_____________________________________________', margin, y);
    doc.text('________________', margin + 350, y);
    y += 12;
    doc.setFontSize(8);
    doc.text('Co-Lessee Signature', margin, y);
    doc.text('Date', margin + 350, y);
    y += 20;

    doc.setFontSize(9);
    // Pre-fill co-lessee name
    doc.text(`Print Name: ${customer.coLesseeName}`, margin, y);
    y += 25;
  }

  // ==================== DEALER/LESSOR SECTION ====================
  checkPage(100);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LESSOR/DEALER REPRESENTATIVE:', margin, y);
  y += 25;

  doc.setFont('helvetica', 'normal');
  const dealerName = dealerProfile?.name || '______________________________';
  doc.text(`Dealer: ${dealerName}`, margin, y);
  y += 20;

  doc.text('_____________________________________________', margin, y);
  doc.text('________________', margin + 350, y);
  y += 12;
  doc.setFontSize(8);
  doc.text('Authorized Representative Signature', margin, y);
  doc.text('Date', margin + 350, y);
  y += 20;

  doc.setFontSize(9);
  doc.text('_____________________________________________', margin, y);
  y += 12;
  doc.setFontSize(8);
  doc.text('Print Name and Title', margin, y);
  y += 30;

  // ==================== CONTACT INFORMATION ====================
  checkPage(60);

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 50, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, contentWidth, 50, 'S');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTACT INFORMATION:', margin + 10, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('I Finance LLC', margin + 10, y + 30);
  doc.text('6440 Winchester Rd, Memphis, TN 38115', margin + 10, y + 42);

  // Save the document
  const customerName = customer.lesseeName?.replace(/\s+/g, '_') || 'Customer';
  doc.save(`GPS_Disclosure_${customerName}.pdf`);
}

export function downloadGPSDisclosurePDF(contractData: ContractData): void {
  generateGPSDisclosurePDF(contractData);
}
