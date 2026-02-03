import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageBreak,
  CheckBox,
  convertInchesToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import type { DealCalculation } from './calculations';

// ============================================================================
// Types
// ============================================================================

export interface LeaseDocumentData {
  calculation: DealCalculation;
  // These fields are filled in by hand, but we need placeholders
  lessorName: string;
  lessorAddress: string;
}

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

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    spacing: { before: 200, after: 100 },
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 150, after: 50 },
  });
}

function bodyText(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    spacing: { after: 100 },
  });
}

function noBorderCell(children: Paragraph[], width?: number): TableCell {
  return new TableCell({
    children,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
  });
}

function borderedCell(children: Paragraph[], width?: number): TableCell {
  return new TableCell({
    children,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  });
}

// ============================================================================
// Document Sections
// ============================================================================

function createHeader(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: 'Motor Vehicle Lease Agreement – Closed End',
          bold: true,
          size: 32,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];
}

function createPartyInfo(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: 'Name, Address (Lessor): ', bold: true }),
        new TextRun({ text: 'Car World Leasing' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________________________________________________________________________' }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Name, Address, Phone (Lessee): ', bold: true }),
        new TextRun({ text: '___________________________________________________________________' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________________________________________________________________________' }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Name, Address, Phone (Co-Lessee): ', bold: true }),
        new TextRun({ text: '________________________________________________________________' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________________________________________________________________________' }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

function createPaymentScheduleAndDate(calculation: DealCalculation): Table {
  const isWeekly = calculation.paymentFrequency === 'weekly';
  const isBiweekly = calculation.paymentFrequency === 'biweekly';
  const isMonthly = calculation.paymentFrequency === 'monthly';

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          noBorderCell([
            new Paragraph({
              children: [
                new TextRun({ text: 'Payment Schedule: ', bold: true }),
                new CheckBox({ checked: isWeekly }),
                new TextRun({ text: ' Weekly  ' }),
                new CheckBox({ checked: isBiweekly }),
                new TextRun({ text: ' Bi-weekly  ' }),
                new CheckBox({ checked: isMonthly }),
                new TextRun({ text: ' Monthly' }),
              ],
            }),
          ]),
          noBorderCell([
            new Paragraph({
              children: [
                new TextRun({ text: 'Date: ', bold: true }),
                new TextRun({ text: '________________' }),
              ],
            }),
          ]),
          noBorderCell([
            new Paragraph({
              children: [
                new TextRun({ text: 'Stock Number: ', bold: true }),
                new TextRun({ text: '____________' }),
              ],
            }),
          ]),
        ],
      }),
    ],
  });
}

function createPurposeAndCounty(calculation: DealCalculation): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new CheckBox({ checked: false }),
        new TextRun({ text: ' The Purpose of this Lease is for Business, Commercial, or agricultural.' }),
      ],
      spacing: { before: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'County: ', bold: true }),
        new TextRun({ text: '________________________' }),
        new TextRun({ text: '     State: ', bold: true }),
        new TextRun({ text: calculation.state }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new CheckBox({ checked: false }),
        new TextRun({ text: ' Refer to the attached addendum for additional Lessees and their signatures.' }),
      ],
    }),
    bodyText('By signing this Lease, you agree that the insurance you are required to provide under this Lease will be the Vehicle\'s primary insurance for liability and personal injury protection coverage and for all other purposes.'),
  ];
}

function createVehicleDescription(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Vehicle Description:', bold: true })] })], 2000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Year' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Make' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Model' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Style' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Odometer' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'VIN' })] })], 3000),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [] })], 2000),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })], 3000),
        ],
      }),
      new TableRow({
        children: [
          noBorderCell([
            new Paragraph({
              children: [
                new CheckBox({ checked: false }),
                new TextRun({ text: ' New  ' }),
                new CheckBox({ checked: true }),
                new TextRun({ text: ' Used' }),
              ],
            }),
          ], 2000),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Special Equipment:', bold: true })],
            }),
          ], 8000),
        ],
      }),
    ],
  });
}

function createTradeInVehicle(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Trade-In-Vehicle:', bold: true })] })], 2000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Year' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Make' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Model' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Style' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Odometer' })] })]),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'VIN' })] })], 3000),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [] })], 2000),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })]),
          borderedCell([new Paragraph({ children: [] })], 3000),
        ],
      }),
    ],
  });
}

function createTradeInValues(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: 'Net Trade Allowance: $ ________________ (enter 0, if less than zero)' }),
      ],
      spacing: { before: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Gross Amount of Trade-In Allowance: $ ________________' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Prior Credit or Lease Balance: $ ________________' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Lienholder Name: ________________________________________' }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

function createFederalConsumerDisclosure(calculation: DealCalculation): (Paragraph | Table)[] {
  const dispositionFee = 395;
  // totalOfPayments already includes tax in the new model
  const totalOfPayments = calculation.totalOfPayments + dispositionFee;

  return [
    sectionHeading('Federal Consumer Disclosure:'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            borderedCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Amount Due At Signing', bold: true }),
                  new TextRun({ text: '\n(Itemization below*)' }),
                ],
              }),
              new Paragraph({
                children: [new TextRun({ text: formatCurrency(calculation.amountDueAtSigning), bold: true, size: 24 })],
                alignment: AlignmentType.CENTER,
              }),
            ], 3000),
            borderedCell([
              new Paragraph({
                children: [new TextRun({ text: 'Payments', bold: true })],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'a. Periodic payments. Your first periodic payment of ' }),
                  new TextRun({ text: formatCurrency(calculation.totalPayment), bold: true }),
                  new TextRun({ text: ' is due on _____________ followed by ' }),
                  new TextRun({ text: `${calculation.numberOfPayments - 1}`, bold: true }),
                  new TextRun({ text: ' payments of ' }),
                  new TextRun({ text: formatCurrency(calculation.totalPayment), bold: true }),
                  new TextRun({ text: '. The total of your periodic payments is: ' }),
                  new TextRun({ text: formatCurrency(calculation.totalOfPayments), bold: true }),
                  new TextRun({ text: '.' }),
                ],
              }),
            ], 7000),
          ],
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            borderedCell([
              new Paragraph({
                children: [new TextRun({ text: 'Miscellaneous Charges', bold: true })],
              }),
              new Paragraph({
                children: [new TextRun({ text: '(Not part of your periodic payment)' })],
              }),
            ], 5000),
            borderedCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Disposition fee (if you do not purchase this Vehicle)' }),
                ],
              }),
            ], 4000),
            borderedCell([
              new Paragraph({
                children: [new TextRun({ text: formatCurrency(dispositionFee) })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
        new TableRow({
          children: [
            borderedCell([new Paragraph({ children: [] })], 5000),
            borderedCell([
              new Paragraph({
                children: [new TextRun({ text: 'Total', bold: true })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 4000),
            borderedCell([
              new Paragraph({
                children: [new TextRun({ text: formatCurrency(dispositionFee), bold: true })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Total of Payments', bold: true }),
        new TextRun({ text: ' (The amount you will have paid by the end of the Lease) ' }),
        new TextRun({ text: formatCurrency(totalOfPayments), bold: true, size: 24 }),
      ],
      spacing: { before: 100, after: 200 },
    }),
  ];
}

function createItemizationOfAmountDue(calculation: DealCalculation): Table {
  // In the new model:
  // - Down payment includes tax
  // - Cap cost reduction = down payment / (1 + tax rate)
  // - Tax collected at signing = down payment - cap cost reduction
  // - First payment is NOT collected at signing
  // - Doc fee is capitalized (included in gross cap cost)
  const capCostReduction = calculation.capCostReduction;
  const taxAtSigning = calculation.taxCollectedAtSigning;
  const total = calculation.amountDueAtSigning;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          borderedCell([
            sectionHeading('* Itemization of Amount Due at Lease Signing or Delivery'),
          ], 10500),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Amount due at Signing:', bold: true })],
            }),
          ], 3500),
          borderedCell([new Paragraph({ children: [] })], 1500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'How the amount due at Lease signing or delivery will be paid:', bold: true })],
            }),
          ], 3500),
          borderedCell([new Paragraph({ children: [] })], 2000),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Capitalized Cost Reduction' })],
            }),
          ], 3500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: `+${formatCurrency(capCostReduction)}` })],
              alignment: AlignmentType.RIGHT,
            }),
          ], 1500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Net Trade-In allowance' })],
            }),
          ], 3500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: '$ ___________' })],
              alignment: AlignmentType.RIGHT,
            }),
          ], 2000),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Tax Collected at Signing' })],
            }),
          ], 3500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: `+${formatCurrency(taxAtSigning)}` })],
              alignment: AlignmentType.RIGHT,
            }),
          ], 1500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Rebates and non-cash credits' })],
            }),
          ], 3500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: '+$ ___________' })],
              alignment: AlignmentType.RIGHT,
            }),
          ], 2000),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Total', bold: true })],
              alignment: AlignmentType.RIGHT,
            }),
          ], 3500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: `=${formatCurrency(total)}`, bold: true })],
              alignment: AlignmentType.RIGHT,
            }),
          ], 1500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: 'Amount to be paid in cash' })],
            }),
          ], 3500),
          borderedCell([
            new Paragraph({
              children: [new TextRun({ text: `+${formatCurrency(total)}` })],
              alignment: AlignmentType.RIGHT,
            }),
          ], 2000),
        ],
      }),
    ],
  });
}

function createMannerOfPayment(calculation: DealCalculation): (Paragraph | Table)[] {
  // Manner of Payment calculations
  const grossCapCost = calculation.grossCapCost;
  const capCostReduction = calculation.capCostReduction;
  const adjustedCapCost = calculation.adjustedCapCost;
  const residualValue = calculation.residualValue;
  const depreciation = calculation.depreciation;
  const rentCharge = calculation.rentCharge;
  const totalBasePayments = calculation.totalBasePayments;  // Without tax
  const leaseTerm = calculation.termMonths;
  const numberOfPayments = calculation.numberOfPayments;
  const basePayment = calculation.basePayment;
  const salesTaxTotal = calculation.salesTax;
  const taxPerPayment = calculation.taxPerPayment;
  const totalPayment = calculation.totalPayment;

  return [
    bodyText('If you do not meet your Contract obligations, you may lose the rights to use the Vehicle under the Lease.'),
    sectionHeading('Manner of Payment Described Below:'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Gross capitalized cost. ', bold: true }),
                  new TextRun({ text: `The agreed upon value of the Vehicle (${formatCurrency(grossCapCost)}) and any items you pay over the Lease Term (such as service contracts, insurance, and any outstanding prior credit or lease balance).` }),
                ],
              }),
            ], 5500),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: formatCurrency(grossCapCost) })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 2000),
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Rent charge. ', bold: true }),
                  new TextRun({ text: 'The amount charged in addition to the depreciation and any amortized amounts.' }),
                ],
              }),
            ], 4000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `+${formatCurrency(rentCharge)}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
        new TableRow({
          children: [
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Capitalized cost reduction. ', bold: true }),
                  new TextRun({ text: 'The amount of any net trade-in allowance, rebate, non-cash credit, or cash you pay that reduces the gross capitalized cost.' }),
                ],
              }),
            ], 5500),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `-${formatCurrency(capCostReduction)}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 2000),
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Total of base payments. ', bold: true }),
                  new TextRun({ text: 'The depreciation and any amortized amounts plus the rent charge.' }),
                ],
              }),
            ], 4000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `=${formatCurrency(totalBasePayments)}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
        new TableRow({
          children: [
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Adjusted capitalized cost. ', bold: true }),
                  new TextRun({ text: 'The amount used in calculating your base payment.' }),
                ],
              }),
            ], 5500),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `=${formatCurrency(adjustedCapCost)}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 2000),
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Lease Term. ', bold: true }),
                  new TextRun({ text: 'The number of months in your Lease.' }),
                ],
              }),
            ], 4000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `${leaseTerm} months` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
        new TableRow({
          children: [
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Residual Value. ', bold: true }),
                  new TextRun({ text: 'The value of the Vehicle at the end of the Lease used in calculating your base payment.' }),
                ],
              }),
            ], 5500),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `-${formatCurrency(residualValue)}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 2000),
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Lease payments. ', bold: true }),
                  new TextRun({ text: 'The number of payments in your Lease.' }),
                ],
              }),
            ], 4000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `÷${numberOfPayments}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
        new TableRow({
          children: [
            noBorderCell([
              new Paragraph({
                children: [
                  new TextRun({ text: 'Depreciation and any amortized amounts. ', bold: true }),
                  new TextRun({ text: 'The amount charged for the Vehicle\'s decline in value through normal wear and for other items paid over the Lease Term.' }),
                ],
              }),
            ], 5500),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `=${formatCurrency(depreciation)}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 2000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: 'Base Payment', bold: true })],
              }),
            ], 4000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `=${formatCurrency(basePayment)}`, bold: true })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
        new TableRow({
          children: [
            noBorderCell([new Paragraph({ children: [] })], 5500),
            noBorderCell([new Paragraph({ children: [] })], 2000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `Sales/use tax (${formatCurrency(salesTaxTotal)} total)` })],
              }),
            ], 4000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `+${formatCurrency(taxPerPayment)}` })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
        new TableRow({
          children: [
            noBorderCell([new Paragraph({ children: [] })], 5500),
            noBorderCell([new Paragraph({ children: [] })], 2000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: 'Total Payment', bold: true })],
              }),
            ], 4000),
            noBorderCell([
              new Paragraph({
                children: [new TextRun({ text: `=${formatCurrency(totalPayment)}`, bold: true })],
                alignment: AlignmentType.RIGHT,
              }),
            ], 1500),
          ],
        }),
      ],
    }),
  ];
}

function createEarlyTermination(): Paragraph[] {
  return [
    sectionHeading('Early Termination.'),
    bodyText('You may have to pay a substantial charge if you end this Lease early. The charge may be up to several thousand dollars. The actual charge will depend on when the Lease is terminated. The earlier you end the Lease, the greater this charge is likely to be.'),
  ];
}

function createExcessiveWearAndMileage(): Paragraph[] {
  return [
    sectionHeading('Excessive Wear and Use.'),
    bodyText('You may be charged for excessive wear based on our standards for normal use and mileage in excess of 12,000 miles per year at the rate of $0.25 per mile. (Excess Mileage Charge)'),
  ];
}

function createPurchaseOption(calculation: DealCalculation): Paragraph[] {
  const purchaseOptionPrice = calculation.residualValue + 300;
  const purchaseOptionFee = 0;

  return [
    sectionHeading('Purchase Option at End of Lease Term.'),
    new Paragraph({
      children: [
        new CheckBox({ checked: true }),
        new TextRun({ text: ' If the box in this line is checked, you have the option to purchase the Vehicle at the end of the Lease Term for ' }),
        new TextRun({ text: formatCurrency(purchaseOptionPrice), bold: true }),
        new TextRun({ text: ' and a purchase option fee of ' }),
        new TextRun({ text: formatCurrency(purchaseOptionFee), bold: true }),
        new TextRun({ text: '. The purchase option price does not include official fees such as those for taxes, tags, license and registration which you will also be required to pay.' }),
      ],
      spacing: { after: 100 },
    }),
  ];
}

function createOtherImportantTerms(): Paragraph {
  return bodyText('Other Important Terms. See Lease documents for additional information on early termination, purchase options and maintenance responsibilities, warranties, late and default charges, insurance, and any security interest, if applicable.');
}

function createBreakdownOfCapitalizedCost(calculation: DealCalculation): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          borderedCell([sectionHeading('Breakdown of Capitalized Cost')], 10500),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Agreed-upon Vehicle Valuation' })] })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: formatCurrency(calculation.agreedPrice) })], alignment: AlignmentType.RIGHT })], 1500),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Service Contract and Extended Warranty' })] })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: '$ ___________' })], alignment: AlignmentType.RIGHT })], 1500),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Acquisition Fee' })] })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: '$ ___________' })], alignment: AlignmentType.RIGHT })], 1500),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Sales or Use Tax and any other relevant Taxes' })] })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: formatCurrency(calculation.salesTax) })], alignment: AlignmentType.RIGHT })], 1500),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Documentation Fee' })] })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: formatCurrency(calculation.docFee) })], alignment: AlignmentType.RIGHT })], 1500),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Unpaid balances from previous credit or leases and negative equity' })] })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: '$ ___________' })], alignment: AlignmentType.RIGHT })], 1500),
        ],
      }),
      new TableRow({
        children: [
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Registration, license, and title Fees' })] })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: '$ ___________' })], alignment: AlignmentType.RIGHT })], 1500),
          borderedCell([new Paragraph({ children: [new TextRun({ text: 'Total:', bold: true })], alignment: AlignmentType.RIGHT })], 4000),
          borderedCell([new Paragraph({ children: [new TextRun({ text: formatCurrency(calculation.agreedPrice), bold: true })], alignment: AlignmentType.RIGHT })], 1500),
        ],
      }),
    ],
  });
}

function createVoluntaryProtectionProducts(): Paragraph[] {
  return [
    sectionHeading('Voluntary Protection Products'),
    bodyText('Any of the following voluntary protection policies are available for purchase. They are not a required condition of this Lease and will not impact our choice to let you lease the vehicle. By signing below, you confirm that you have read and received a copy of the contract(s) for the product(s) and that you wish to purchase the item as described. You have rejected any coverage we offered if there is no coverage or fee for an item.'),
    new Paragraph({
      children: [
        new CheckBox({ checked: false }),
        new TextRun({ text: ' Service Contract: Price: $ ___________ Term: ___________ Coverage: ___________' }),
      ],
    }),
    new Paragraph({
      children: [
        new CheckBox({ checked: false }),
        new TextRun({ text: ' Gap Coverage or Gap Waiver: Price: $ ___________ Term: ___________ Coverage: ___________' }),
      ],
    }),
    new Paragraph({
      children: [
        new CheckBox({ checked: false }),
        new TextRun({ text: ' Mechanical Breakdown Protection (MBP): Price: $ ___________ Term: ___________ Coverage: ___________' }),
      ],
    }),
    new Paragraph({
      children: [
        new CheckBox({ checked: false }),
        new TextRun({ text: ' Extended Warranty: Price: $ ___________ Term: ___________ Coverage: ___________' }),
      ],
      spacing: { after: 100 },
    }),
    createSignatureLine(),
    createSignatureLine(),
    createSignatureLine(),
  ];
}

function createSignatureLine(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: '________________________________________  ' }),
      new TextRun({ text: '________________' }),
    ],
    spacing: { before: 200 },
  });
}

function createWarranties(): Paragraph[] {
  return [
    sectionHeading('Service Fee for Unclaimed Refunds of Security Deposits.'),
    bodyText('If we send you a check to refund the remaining portion of any Security Deposit after this Lease ends and you fail to collect it within six months, you acknowledge that we have the right to deduct a monthly service charge from the remaining portion of the Security Deposit until it is fully refunded to you or depleted.'),
    sectionHeading('Warranties.'),
    bodyText('The Vehicle is covered by the express warranties that are applicable to this Lease.'),
    new Paragraph({
      children: [
        new CheckBox({ checked: true }),
        new TextRun({ text: ' The warranty provided by the manufacturer. This warranty is provided by the manufacturer and is NOT the responsibility of the Lessor.' }),
      ],
    }),
    new Paragraph({
      children: [
        new CheckBox({ checked: true }),
        new TextRun({ text: ' By signing this Lease, you confirm that you have received a copy of the written warranties mentioned above. We want to clarify that we (the Lessor) do not provide any explicit or implicit guarantees beyond what has been mentioned earlier (if applicable). Unless legally mandated, the Lessor does not provide any implied warranty of merchantability or any warranty regarding the suitability of the Vehicle for a specific purpose. With the exception of what has been mentioned previously, you will accept the Vehicle in its current condition, AS IS, including WITH ANY AND ALL FAULTS.' }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

function createOtherTerms(): Paragraph[] {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    sectionHeading('Other Terms'),
    subHeading('Additional Terms'),
    subHeading('Additional Fees and Charges.'),
    bodyText('You can find information about a Security Deposit and a Late Charge in the Additional Lease Terms section. Furthermore, you are responsible for paying the following amounts in addition to what has been previously mentioned in this Lease agreement.'),
    bodyText('Vehicle Return Fee. If this Lease is terminated before the end of the scheduled Lease Term and the Vehicle is returned to us or to our agents, a Vehicle Return Fee of $ ___________ will be required. This fee will be waived if the Lease is terminated early due to your decision to purchase the vehicle.'),
    bodyText('Disposition Fee. You will pay us a Disposition Fee of $395.00 when you return the Vehicle at the end of the scheduled Lease Term. This Fee will not apply if the Lease ends early or if you buy the Vehicle at the end of the Lease Term (if you have that option).'),
    bodyText('Official Fees and Taxes. The estimated total amount you will pay for official and license fees, registration, title, and taxes over the term of your Lease, whether included with your periodic payment or assessed separately: $ ___________. The final amount of fees and taxes may vary, depending on the prevailing tax rates or the assessed value of the leased property.'),
  ];
}

function createAdditionalLeaseTerms(): Paragraph[] {
  return [
    sectionHeading('Additional Lease Terms'),
    subHeading('Definitions.'),
    bodyText('Each person or legal entity that signs this Lease as the "Lessee" individually and collectively is referred to as "you," "your," and "Lessee." The Lessor who signs this Lease, as well as any successors and assigns, are referred to as "we," "our," "us," and "Lessor."'),
    subHeading('Lease Agreement.'),
    bodyText('You accept that we will lease you the automobile (referred to as the "Vehicle") for the duration of this Lease. You promise to fulfil your end of the Lease and to pay any owed sums. Except in the event the "Business, commercial, or agricultural purpose lease" box is ticked, you plan to use the vehicle primarily for personal, family, or domestic reasons. This Lease includes all applicable Federal Consumer Leasing Act requirements.'),
    subHeading('General Terms.'),
    bodyText('The governing law of this Lease will be determined by the state where it is signed unless there are any restrictions. Should any portion of this Lease prove unenforceable, the remaining provisions of the Lease shall remain binding and enforceable.'),
    subHeading('Indemnity.'),
    bodyText('You are responsible for any legal consequences that may arise from the possession, operation, condition, maintenance, or use of the Vehicle during the Lease Term and for any period thereafter while the Vehicle is still in your possession. You agree to protect us and our successors and assigns from any liability, claims, losses, demands, damages, expenses (including reasonable legal fees and expenses), fines, and penalties incurred as a result.'),
    subHeading('Notices.'),
    bodyText('Unless otherwise mandated by legal obligations, you acknowledge that any communication we send you will be deemed reasonable and satisfactory if it is sent via regular mail, addressed to the location provided in this Lease or to your most recent address as indicated in our files. Please ensure that you inform us in writing within 30 days of any changes to your address or the location where the Vehicle is kept.'),
    subHeading('Security deposit.'),
    bodyText('If you choose to include a refundable Security Deposit in the Itemization of Amount Due at Lease Signing or Delivery section, you will be required to provide the refundable and specified Security Deposit amount. It can be utilized to cover any outstanding payments that you fail to make on time. Once all of your obligations have been fulfilled under this Lease, any remaining amount will be promptly returned to you. You are obligated to handle any check we send you for the purpose of refunding the remaining portion of the Security Deposit within a six-month period from the date stated on the check. If not prohibited, you also acknowledge that we have the right to impose a monthly service charge as outlined in the Service Charge for Unclaimed Security Deposit Refunds section, starting six months after the date of any uncollected refund check. Unless expressly prohibited, you will not receive any interest on your Security Deposit or be entitled to any other benefits, increases, or profits that may arise from us holding the Security Deposit.'),
    subHeading('Late Charge.'),
    bodyText('In the event that a payment or any part of it is not received within 5 days of the due date, a late charge of 5% will be applied to the outstanding amount.'),
  ];
}

function createVehicleUsage(): Paragraph[] {
  return [
    subHeading('Vehicle Usage.'),
    bodyText('These terms are binding upon you:'),
    bodyText('You agree to operate the Vehicle only as recommended by the manufacturer.'),
    bodyText('You agree to allow the Vehicle only to be operated by licensed drivers for lawful purposes and in a lawful manner.'),
    bodyText('You agree not to use the Vehicle as a taxi or for other public or private hire or delivery.'),
    bodyText('You agree not to use the Vehicle in a way that causes the cancellation or suspension of any warranty, insurance or other similar vehicle protection agreement.'),
    bodyText('You agree not to take the Vehicle out of the state where you reside for more than 30 consecutive days without our prior written approval.'),
    bodyText('You agree not to take the Vehicle out of the United States without our prior written approval.'),
  ];
}

function createMaintenanceAndInsurance(): Paragraph[] {
  return [
    subHeading('Maintenance and Operating Costs.'),
    bodyText('It will be expected that you will maintain the Vehicle in its original condition, with the exception of normal wear and tear and mileage. You are obligated to adhere to the manufacturer\'s recommendations and perform necessary maintenance to ensure the proper functioning of the product. It is your responsibility to properly maintain the Vehicle in order to uphold any warranties or agreements and ensure it meets all necessary legal inspections. It is your responsibility to cover all expenses related to the service, repair, and maintenance of the Vehicle, as well as its operation, such as gas, oil, parking, storage, violations, and so on. You are obligated to provide access to the Vehicle for inspection at our request, at any reasonable time and location, throughout the Lease Term.'),
    bodyText('You are responsible for a $500 deductible per warranty claim.'),
    subHeading('Required Insurance.'),
    bodyText('You are responsible for any injury, death, or damage that may occur as a result of using the Vehicle. You are obligated to maintain the following insurance coverage ("Required Insurance") on the Vehicle throughout the duration of this Lease and for any period thereafter while the Vehicle is still in your possession.'),
    bodyText('Liability for bodily injury or death of others in an amount of at least $100,000 per person and $300,000 per occurrence.'),
    bodyText('Liability for property damage to others in an amount of at least $50,000.'),
    bodyText('Collision and comprehensive (including fire and theft coverage) with a deductible not to exceed $500.'),
    bodyText('It is your responsibility to obtain insurance coverage from a licensed insurer in your state or an eligible surplus lines insurer, and you will be responsible for any associated costs. This insurance can be offered through policies that you already possess or have authority over. It is also required that you designate us or our assignee as the loss payee and additional insured. It is essential that the insurance policy includes a provision for giving us a minimum of 10 days\' notice in advance of any cancellation or significant alteration in coverage. Upon our request, we kindly ask that you promptly provide us with a copy of the policy and proof of premium payment. In the event that you do not fulfill these obligations, it is possible that we will secure insurance on your behalf, which you will be responsible for covering.'),
    bodyText('You are entering into a lease agreement with us for the Vehicle. We are the legal owners of the vehicle. It is necessary for you to maintain insurance on the Vehicle in order to safeguard our interest. If you do not provide proof of insurance for the Vehicle, we have the right to obtain insurance for the Vehicle and you will be responsible for covering the cost of that insurance.'),
    bodyText('It is crucial that you notify us in writing immediately if there are any changes to the information of your insurance provider. We have your authorization to endorse your name on any check we receive for insurance proceeds.'),
    bodyText('Attention. This Lease does not provide liability insurance coverage for bodily injury and motor vehicle damage caused to others.'),
  ];
}

function createDamageAndDefault(): Paragraph[] {
  return [
    subHeading('Damage to the Vehicle and Insurance Claims.'),
    bodyText('It is vital that you promptly inform us in writing of any incidents involving the Vehicle that result in loss or damage to individuals or property. Please ensure that you promptly inform us in writing as soon as you become aware of any demand, claim, or legal action related to the Vehicle. You are obligated to provide complete cooperation to us and your insurer in any investigation, lawsuit, or other legal proceedings arising from the use or control of the Vehicle.'),
    bodyText('You are obligated to repair or compensate us for any loss or damage to the Vehicle that may occur during this Lease. We will assess the condition of the Vehicle and make a determination on whether it is feasible to repair it. If the vehicle is repaired, you will apply any insurance proceeds you receive for its loss or damage to the costs of repair. It is important to note that you are responsible for covering any expenses or damages that are not covered by insurance. It is important to continue making payments as they become due throughout the Lease, even if the Vehicle is damaged or unusable for a certain period of time. The section on Theft, Loss or Irreparable Damage outlines the course of action if it is determined that the Vehicle is beyond repair or should not be repaired.'),
    subHeading('Theft, Loss or Irreparable Damage.'),
    bodyText('If the vehicle is stolen and not recovered, lost, destroyed, or damaged beyond repair, we will assess whether to proceed with or terminate this Lease. If the situation persists, you are obligated to accept a suitable alternative vehicle that is of comparable value, condition, mileage, and accessories as a replacement for the original vehicle. If the Lease is terminated under this section, it will be considered an early termination and you will be obligated to pay the specified amounts outlined in the Early Termination section. Upon early termination, you are obligated to surrender any insurance or other compensation you receive for damages or loss to the Vehicle (including any refunds on the Required Insurance), up to the amount you owe us.'),
    subHeading('Default.'),
    bodyText('If any of the following events take place (unless prohibited by law), you will be considered in default of this Lease.'),
    bodyText('You fail to make any payment when it is due.'),
    bodyText('You fail to fulfill any significant obligations outlined in this Lease, including actions you agreed not to take.'),
    bodyText('The vehicle has been taken, either by legal or governmental means.'),
    bodyText('If the Required Insurance on the Vehicle is not provided or proof of such coverage is not provided after we request it, there may be consequences.'),
    bodyText('If any other event occurs that results in a default as per the relevant legal provisions.'),
    bodyText('If this Lease is in default, we have the right to pursue legal actions against any or all Lessees and Co-Lessees.'),
  ];
}

function createRemedies(): Paragraph[] {
  return [
    subHeading('Remedies.'),
    bodyText('If this Lease is in default, we have the right to take any one or more of the following actions. If it is mandated by the law, we will provide you with notice and adhere to any necessary waiting period before proceeding with any or all of these actions.'),
    bodyText('We have the authority to terminate this Lease and your rights to use the Vehicle.'),
    bodyText('We are authorized to take necessary measures to rectify any breach on your part or to mitigate any potential losses (such as procuring the insurance you were obligated to provide). Any payment made will be applied to your outstanding balance and will become immediately payable.'),
    bodyText('We may require you return the Vehicle and any related records or make them available to us in a reasonable manner, as may be required.'),
    bodyText('If required, we have the option to reclaim the Vehicle through legal means or by taking appropriate action. However, it is important to ensure that we do so without causing any disturbances or breaking any laws.'),
    bodyText('We have the option to utilize any other available remedy outlined in this Lease or provided by law.'),
    bodyText('You understand and agree that, subject to your ability to reclaim any such property, we have the authority to seize any personal belongings left in or on the Vehicle upon repossession.'),
    bodyText('You are obligated to reimburse us for any reasonable expenses we incur to rectify or address your breach, unless prohibited by applicable law. You are responsible for reimbursing us for any costs and expenses incurred in the Vehicle\'s return and disposition or as a result of early termination, unless prohibited by applicable law. This amount includes, for instance, our court costs and, as allowed by applicable law, reasonable attorneys\' fees. By selecting any one or more of these solutions, we retain the option to pursue additional remedies. By choosing not to utilize any remedy in the event of a default in this Lease, we retain our right to employ that remedy in the event of a similar default in the future.'),
  ];
}

function createLeaseTermination(): Paragraph[] {
  return [
    subHeading('Lease Termination.'),
    bodyText('This Lease will come to an end ("terminate") upon the occurrence of one of the following events, whichever happens first.'),
    bodyText('If you decide to terminate the Lease ahead of schedule and return the Vehicle to us.'),
    bodyText('If you have the option, you may choose to purchase the vehicle. At the conclusion of the designated Lease Term, the Vehicle is to be returned.'),
    bodyText('We will terminate the Lease if the vehicle is stolen and not recovered, lost or destroyed, or if it is damaged beyond repair or replacement.'),
    bodyText('You return the Vehicle at the end of the scheduled Lease Term.'),
    bodyText('We terminate the Lease as a result of your default.'),
    bodyText('Upon termination, you are obligated to fulfill the financial obligations outlined in this Lease. You do not have the right to retain the Vehicle beyond the scheduled Lease Term or the date of early termination without obtaining our prior written consent.'),
    subHeading('Gap Waiver or Gap Coverage.'),
    bodyText('If this Lease ends early due to the Vehicle being stolen and not recovered, lost or destroyed, or damaged beyond repair, you will be responsible for the early termination charges outlined in the Early Termination section. Upon termination, it is possible that the insurance proceeds we receive from you for the Vehicle may not cover the early termination charges. This distinction is commonly known as the "Gap Amount". You have the option to purchase a Gap Waiver or Gap Coverage Contract ("Gap Product") to assist in covering the Gap Amount, which is subject to certain conditions and limitations outlined in the separate Gap Product.'),
  ];
}

function createEarlyTerminationDetails(): Paragraph[] {
  return [
    subHeading('Early Termination.'),
    bodyText('If the Lease terminates before the end of the scheduled Lease Term, this section will apply. This provision does not apply if you decide to purchase the Vehicle prior to the conclusion of the designated Lease Term. Upon early termination, the Vehicle shall be returned to us. We expect the delivery to be made to our designated address or any other suitable location as per our request.'),
    subHeading('Early Termination Liability.'),
    bodyText('On early termination, you agree to pay us the following items.'),
    bodyText('There may be a Vehicle Return Fee, if applicable, as outlined in the Additional Fees and Charges section.'),
    bodyText('All outstanding and unpaid balances that are currently due or overdue (including any amounts outlined in the Remedies section).'),
    bodyText('The difference between the Adjusted Lease Balance at that time and the Realized Value. If the Realized Value exceeds the Adjusted Lease Balance, any surplus will be credited towards your liability. If this is a Single Payment Lease, any remaining excess amount will be credited to you.'),
    bodyText('All applicable fees and taxes associated with the termination of the Lease.'),
    bodyText('If the early termination is due to theft, loss, or irreparable damage to the Vehicle, any insurance or Gap Product proceeds received by us for that theft, loss, or damage will be used to cover the early termination liability.'),
    subHeading('Determining the Adjusted Lease Balance.'),
    bodyText('The calculation for your early termination liability will be based on the "Adjusted Lease Balance". A "Month" refers to a span of around 30 days that starts on the same day of a month when the payment(s) are due. If there is no same day in that month, the month begins on the last day of the month. It is important to note that the Adjusted Lease Balance at the start of this Lease is equivalent to the Adjusted Capitalized Cost. Every Month, the Adjusted Lease Balance will be adjusted by adding the Rent Charge for that Month and subtracting the Base Periodic Payments for that Month. The Rent Charge is calculated by subtracting the Base Periodic Payment amount for that Month from the Adjusted Lease Balance at the beginning of the Month, and then multiplying it by the Lease Rate. The Lease Rate is the rate that will result in the monthly reductions mentioned earlier, ultimately reducing the Adjusted Lease Balance to the Residual Value throughout the Lease Term. The calculations mentioned above assume that each month consists of exactly 30 days.'),
    subHeading('Determining the Realized Value.'),
    bodyText('If necessary, we will provide you with a notice and adhere to any mandated waiting period before proceeding with the determination of the Vehicle\'s Realized Value. Unless otherwise mandated by legal obligations, the Realized Value will be determined using one of the following methods.'),
    bodyText('The determination will be based on a written agreement that you and we must reach within 10 days of the Vehicle\'s return.'),
    bodyText('The determination will be made by a professional appraiser who is independent and agreed upon by both parties. You will be responsible for the cost of obtaining the appraisal within 10 days of the vehicle\'s return, unless all parties agree to a longer period or if it is required by law. The appraisal will determine the wholesale value of the Vehicle and will be considered as the final and binding decision for both parties involved.'),
    bodyText('If the determination is not made within 10 days of the Vehicle\'s return, we will determine the Realized Value at our sole discretion. This will be done either by obtaining a wholesale cash bid for the purchase of the Vehicle, in accordance with accepted practices in the automobile industry for determining the wholesale value of used vehicles, or by disposing of the Vehicle in an otherwise commercially reasonable manner. We will adhere to any necessary methods or processes as mandated by the law. If we utilize a bid procedure, you have the option to submit a cash bid that will be taken into account alongside any other offers we receive. We are not obligated to sell the Vehicle, but we will take into account the highest offer amount we receive when determining your liability. If the vehicle is not returned to us, the realized value will be zero.'),
  ];
}

function createPurchaseOptions(): Paragraph[] {
  return [
    subHeading('Option to Purchase Before the End of the Lease Term.'),
    bodyText('You are entitled to buy the Vehicle at any point, provided that we have not deemed the Lease to be in default. Please be advised that it is necessary to provide us with a minimum of 30 days\' advance notice regarding your intention to make a purchase. The total price for the vehicle will include all fees, taxes, and other costs associated with the purchase, as well as any outstanding fees and charges from the Lease. Additionally, it will also include the Adjusted Lease Balance.'),
    subHeading('Scheduled Termination.'),
    bodyText('Upon the conclusion of the Lease Term, it is expected that you will promptly return the Vehicle to our possession, unless otherwise specified in this Lease. Please ensure that you return it to our designated address or any other suitable location as per our request. You have the option to return the Vehicle up to 15 days before the last day of the scheduled Lease Term, purely for your own convenience. There will be no adjustments, charges, or credits for this "early" return.'),
    bodyText('Upon termination as outlined in this section, you are obligated to remit payment for the following items.'),
    bodyText('If applicable, there may be a Disposition Fee as outlined in the Additional Fees and Charges section.'),
    bodyText('There may be an Excess Wear Charge and an Excess Mileage Charge, if applicable, outlined in the Excess Wear and Mileage section.'),
    bodyText('All other amounts that are currently owed or overdue under this Lease.'),
    bodyText('These amounts must be paid when you return the Vehicle or as soon as they can be determined, unless there are other legal provisions. If the Vehicle is not returned at the end of the scheduled Lease Term, you will be responsible for compensating us for any reasonable losses and expenses incurred.'),
    subHeading('Option to Purchase at the End of the Lease Term.'),
    bodyText('The section on the Purchase Option at the end of the Lease Term in the Federal Consumer Leasing Act Disclosures explains the available option to buy the Vehicle once the Lease Term is completed, along with the corresponding purchase price. If you have the option, it is only available if we have not already declared the Lease to be in default. Please ensure that you provide us with a minimum of 30 days advance notice regarding your intention to make a purchase.'),
  ];
}

function createExcessiveWearDetails(): Paragraph[] {
  return [
    subHeading('Excessive wear and mileage.'),
    bodyText('Upon returning the Vehicle at the conclusion of the scheduled Lease Term, you are responsible for covering any costs associated with excessive wear and tear on the Vehicle. The Excess Wear Charge will be calculated based on the actual or estimated costs of repair, or the estimated loss in value, resulting from any excessive wear, regardless of whether the Vehicle is repaired or not. The following are considered examples of excessive wear.'),
    bodyText('Possible causes of mechanical damage, failure, or defect.'),
    bodyText('We require prior written approval for any repairs or replacement parts, including tires, that are not made with original equipment manufacturer\'s parts.'),
    bodyText('Exterior parts, grilles, bumpers, trim, paint and glass may exhibit signs of damage, such as dents, scratches, chips, discoloration, or wear beyond ordinary use.'),
    bodyText('If the interior parts, upholstery, dashboard, carpeting, or trunk liner are stained, torn, burned, or otherwise damaged, missing, or worn beyond ordinary use, they may require attention.'),
    bodyText('Missing, damaged, or malfunctioning accessories, tools, and equipment that were included with the vehicle upon delivery.'),
    bodyText('Tires that do not meet safety standards include retreads, those with less than 1/8 inch tread at the shallowest point, or those that are not part of a matching set of four.'),
    bodyText('Any other part or condition that may render the Vehicle unsafe or unlawful to use.'),
    bodyText('Any additional damage or wear that exceeds $50 in repair or replacement costs.'),
    bodyText('We will inform you of the charges and provide any other necessary information as required by applicable law. Payment will be required once the exact amount is determined, unless there are specific legal provisions stating otherwise. Upon returning the Vehicle at the conclusion of the scheduled Lease Term, it is expected that you will assume responsibility for any Excess Mileage Charge, as outlined in the Federal Consumer Leasing Act Disclosures section.'),
  ];
}

function createTitlingAndAssignments(): Paragraph[] {
  return [
    subHeading('Titling, Official Fees and Taxes.'),
    bodyText('You acknowledge and accept that this Lease is solely a lease agreement. We are the rightful owners of the Vehicle, and it will be officially registered under our name or the name of our assignee. You do not possess any ownership rights in the Vehicle, except for any potential options to purchase that may be provided in this Lease. You agree to pay all title, registration, license, sales, use, excise, personal property, ad valorem, inspection, testing and all other taxes, fees and charges imposed by government authorities in connection with the Vehicle and this Lease during the Lease Term, except our income taxes. You are obligated to pay any assessed amounts, even if they are due after the Lease Term. We have the authority to decide when and how these payments will be made. Please ensure that you make timely payments for the amounts specified in this Lease, unless stated otherwise. The final amount of official fees and taxes you pay may vary depending on the tax rates in effect or the value of the Vehicle at the time a fee or tax is assessed.'),
    subHeading('Assignments and Transfers.'),
    bodyText('We have the option to sell, assign, or transfer our rights and responsibilities in the Vehicle and this Lease to another party.'),
    bodyText('Under no circumstances are you allowed to sublease the Vehicle, transfer your interests or responsibilities in any way, or create a security interest in the Vehicle and in this Lease. We have the authority to grant you permission to make a transfer that would otherwise be prohibited. Written permission must be obtained before any transfer can take place.'),
  ];
}

function createArbitrationAgreement(): Paragraph[] {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    sectionHeading('Arbitration Agreement'),
    new Paragraph({
      children: [new TextRun({ text: 'Please Read Carefully! Notice of Arbitration.', bold: true, size: 22 })],
      spacing: { after: 100 },
    }),
    bodyText('By agreeing to this Arbitration Agreement, you are waiving your right to pursue legal action in court for any claims or disputes that may arise from this Lease, should you or we opt for arbitration.'),
    bodyText('If there is a dispute between us, it can be resolved through arbitration rather than going to court or having a jury trial.'),
    bodyText('By opting for arbitration, you forfeit the opportunity to participate as a representative or member of a class in any class action or class arbitration against us.'),
    bodyText('During arbitration, the scope of discovery and the ability to appeal are typically more restricted compared to a traditional court case. Additionally, certain rights that both parties would have in court may not be accessible in arbitration.'),
    bodyText('Any claim or dispute that arises from your credit application, this Lease, or any related transaction or relationship will be resolved through neutral, binding arbitration. This applies to any disagreements between you, us, or our employees, agents, successors, or assigns. Furthermore, within the confines of legal provisions, the determination of the legitimacy, extent, and understanding of this Arbitration Agreement shall be resolved through impartial and obligatory arbitration.'),
    bodyText('If either party decides to resolve a claim or dispute through arbitration, both parties acknowledge and agree that a trial by jury or any other judicial proceeding will not be pursued. Furthermore, you are prohibited from acting as a representative or member of a class in any class claim against us, including class arbitration. We both agree that any claim or dispute will be resolved by a single arbitrator, on an individual basis, and not as a class action.'),
    bodyText('During the arbitration process, both parties will utilize the services of National Arbitration and Mediation (NAM) and adhere to their relevant rules. NAM is located at 990 Stewart Ave., Garden City, NY 11530 and more information can be found on their website at www.namadr.com. If you\'re interested in obtaining a copy of NAM\'s rules, you have the option of reaching out to them directly or accessing their website. If NAM is not willing or able to serve as the arbitration provider, the arbitrator will be chosen in accordance with 9 U.S.C. sections 5 and 6.'),
    bodyText('The arbitration hearing will take place in the federal district of your residence, unless both parties reach a different agreement. If arbitration is initiated, we will advance your filing, administration, service, or case management fee, as well as your arbitrator or hearing fee, up to a maximum total of $1,500. Both parties are responsible for covering the expenses of their respective attorney(s), experts, witnesses, and any other fees and costs associated with arbitration, unless the arbitrator decides otherwise. This includes any amount that we have already provided in advance.'),
    bodyText('The arbitrator will have a legal background, either as a lawyer or a former judge. When making an award, the arbitrator is required to adhere to the applicable substantive law. The arbitrator has the power to issue orders for specific performance, compensatory damages, punitive damages, and any other remedies permitted by the law. In addition to the grounds for review provided by the Federal Arbitration Act, it is important to note that the arbitration award is considered to be final and binding for all parties involved. The arbitrator\'s award can be enforced by any court with jurisdiction.'),
    bodyText('You or we can do the following without relinquishing the right to demand arbitration.'),
    bodyText('Consider pursuing legal recourse in small claims court for claims that fall within its jurisdiction, unless these claims are transferred, removed, or appealed to a different court. If necessary, either party can request the transfer of these claims to arbitration.'),
    bodyText('Pursue legal measures for interim relief.'),
    bodyText('Consider utilizing alternative methods to resolve issues, such as taking action outside of the legal system, like using a deposit account or reclaiming property.'),
    bodyText('Initiate foreclosure proceedings on any real or personal property, collateral, or other security.'),
    bodyText('This Arbitration Agreement is governed by the Federal Arbitration Act (9 U.S.C. § 1 et seq.), which takes precedence over any state laws related to arbitration, including state arbitration rules and procedures. This Arbitration Agreement remains in effect even after the Lease is terminated, paid off, or transferred. In the event that any portion of this Arbitration Agreement cannot be enforced, the remaining parts will still be enforceable. However, if the waiver of class action rights cannot be enforced, the entire Arbitration Agreement will be rendered unenforceable.'),
    bodyText('By signing this Lease, both parties acknowledge and accept the terms outlined within. Furthermore, we mutually agree to forgo our entitlement to a trial by jury and traditional judicial process, with the exception of any legal provisions. Please be advised to carefully review this Arbitration Agreement prior to signing this Lease. By signing it, you are acknowledging that you have carefully reviewed, comprehended, and consented to this Arbitration Agreement, and have been provided with a copy of it. If there is anything in this Arbitration Agreement that you find unclear, it is advisable not to sign this Lease. Instead, it would be wise to seek guidance from a legal professional. If you or we wish to reject this Arbitration Agreement, you can do so by sending a rejection notice via certified or registered mail, or through a messenger service, within 10 days of signing this Lease.'),
  ];
}

function createNotices(): Paragraph[] {
  return [
    sectionHeading('Notices'),
    bodyText('Notice. Your ownership rights in the Vehicle will only be established once you decide to exercise your option to purchase the Vehicle.'),
    new Paragraph({
      children: [
        new TextRun({
          text: 'THIS DOCUMENT CONSTITUTES A LEGALLY BINDING LEASE AGREEMENT. THIS DOCUMENT IS NOT INTENDED TO BE A PURCHASE AGREEMENT. PLEASE CAREFULLY REVIEW THESE MATTERS AND CONSIDER SEEKING INDEPENDENT PROFESSIONAL ADVICE IF YOU HAVE ANY QUESTIONS REGARDING THIS TRANSACTION. YOU HAVE THE RIGHT TO RECEIVE AN EXACT COPY OF THE AGREEMENT YOU SIGN.',
          bold: true,
        }),
      ],
      spacing: { before: 100, after: 100 },
    }),
    bodyText('Arbitration. This Lease contains an Arbitration Agreement that affects your rights. Please be aware that this Lease includes an Arbitration Agreement that may have an impact on your rights. By signing this Lease, you are acknowledging and accepting the terms of the Arbitration Agreement.'),
  ];
}

function createSignatures(): Paragraph[] {
  return [
    sectionHeading('Signatures'),
    subHeading('Entire Lease Agreement.'),
    bodyText('All the terms of our agreement are outlined in: (a) this Lease; and (b) any additional agreement between you and us regarding post-delivery conditions of the Vehicle. There are no informal agreements regarding this Lease. All modifications to this Lease must be documented and mutually agreed upon by both parties.'),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________  ' }),
        new TextRun({ text: '________________' }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Lessee Name                                                              Date' })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________  ' }),
        new TextRun({ text: '________________' }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Co-Lessee Name                                                        Date' })],
      spacing: { after: 200 },
    }),
    subHeading('Notice to Lessee.'),
    bodyText('Before signing this Lease, (1) it is important that you thoroughly read it and ensure that there are no blank spaces, (2) you have the right to receive a fully completed copy of this Lease.'),
    bodyText('By signing below, you are acknowledging your acceptance of the terms outlined in this Lease agreement. It is important to note that you were provided with a copy of this Lease and given the opportunity to thoroughly read and review its contents prior to signing.'),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________  ' }),
        new TextRun({ text: '________________' }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Lessee Name                                                              Date' })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________  ' }),
        new TextRun({ text: '________________' }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Co-Lessee Name                                                        Date' })],
      spacing: { after: 200 },
    }),
    subHeading('Lessor\'s Acceptance.'),
    bodyText('By signing below, the Lessor agrees to the terms and conditions of this Lease Agreement.'),
    bodyText('Inspection of the lessee\'s driver\'s license. The Lessor carefully examined the driver\'s licenses of each Lessee and meticulously compared and confirmed the signature on each license with a signature provided by each Lessee, all done in the presence of the Lessor. The Lessor has the belief that each Lessee who provides such information is presently licensed to drive by the state of their residence.'),
    bodyText('Task. The Lessor transfers this Lease and all rights and ownership of the Vehicle to the Assignee mentioned below (if applicable). This assignment is contingent upon any distinct Assignment Agreement between the Lessor and Assignee.'),
    new Paragraph({
      children: [
        new TextRun({ text: 'Assignee Name: ', bold: true }),
        new TextRun({ text: '_______________________________________________' }),
      ],
      spacing: { before: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Address: ', bold: true }),
        new TextRun({ text: '______________________________________________________' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Phone: ', bold: true }),
        new TextRun({ text: '________________________________________________________' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '________________________________________  ' }),
        new TextRun({ text: '________________' }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Assignee Name                                                        Date' })],
    }),
  ];
}

// ============================================================================
// Main Document Generation
// ============================================================================

export function generateLeaseDocument(data: LeaseDocumentData): Document {
  const { calculation } = data;

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        children: [
          // Header
          ...createHeader(),

          // Party Information
          ...createPartyInfo(),

          // Payment Schedule and Date
          createPaymentScheduleAndDate(calculation),

          // Purpose and County
          ...createPurposeAndCounty(calculation),

          // Vehicle Description
          new Paragraph({ spacing: { before: 200 } }),
          createVehicleDescription(),

          // Trade-In Vehicle
          new Paragraph({ spacing: { before: 200 } }),
          createTradeInVehicle(),

          // Trade-In Values
          ...createTradeInValues(),

          // Federal Consumer Disclosure
          ...createFederalConsumerDisclosure(calculation),

          // Itemization of Amount Due
          createItemizationOfAmountDue(calculation),

          // Manner of Payment
          ...createMannerOfPayment(calculation),

          // Early Termination
          ...createEarlyTermination(),

          // Excessive Wear and Mileage
          ...createExcessiveWearAndMileage(),

          // Purchase Option
          ...createPurchaseOption(calculation),

          // Other Important Terms
          createOtherImportantTerms(),

          // Breakdown of Capitalized Cost
          new Paragraph({ spacing: { before: 200 } }),
          createBreakdownOfCapitalizedCost(calculation),

          // Voluntary Protection Products
          ...createVoluntaryProtectionProducts(),

          // Warranties
          ...createWarranties(),

          // Other Terms
          ...createOtherTerms(),

          // Additional Lease Terms
          ...createAdditionalLeaseTerms(),

          // Vehicle Usage
          ...createVehicleUsage(),

          // Maintenance and Insurance
          ...createMaintenanceAndInsurance(),

          // Damage and Default
          ...createDamageAndDefault(),

          // Remedies
          ...createRemedies(),

          // Lease Termination
          ...createLeaseTermination(),

          // Early Termination Details
          ...createEarlyTerminationDetails(),

          // Purchase Options
          ...createPurchaseOptions(),

          // Excessive Wear Details
          ...createExcessiveWearDetails(),

          // Titling and Assignments
          ...createTitlingAndAssignments(),

          // Arbitration Agreement
          ...createArbitrationAgreement(),

          // Notices
          ...createNotices(),

          // Signatures
          ...createSignatures(),
        ],
      },
    ],
  });
}

export async function downloadLeaseDocument(calculation: DealCalculation): Promise<void> {
  const { Packer } = await import('docx');

  const doc = generateLeaseDocument({
    calculation,
    lessorName: 'Car World Leasing',
    lessorAddress: '',
  });

  const blob = await Packer.toBlob(doc);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  saveAs(blob, `CarWorld_Lease_${timestamp}.docx`);
}
