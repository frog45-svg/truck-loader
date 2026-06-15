const PdfPrinter = require('pdfmake');
const path = require('path');

// Helper to format currency in INR style (₹ XX,XX,XXX.XX)
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  });
  return formatter.format(amount);
}

// Helper to format dates
function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

// Helper for professional status typography
function formatStatus(text) {
  let color = '#555555'; // default muted dark gray
  const val = text.toLowerCase();
  
  if (val === 'received' || val === 'settled' || val === 'completed') {
    color = '#15803d'; // Professional dark green
  } else if (val === 'pending' || val === 'unsettled' || val === 'open') {
    color = '#555555'; // Muted dark gray
  } else if (val === 'cancelled') {
    color = '#b91c1c'; // Professional dark red
  }

  return {
    text: text.toUpperCase(),
    color: color,
    bold: true,
    fontSize: 7.5,
    letterSpacing: 0.5
  };
}

module.exports = function generatePdf(payload) {
  const { trip, summary, incomeList = [], dieselList = [], advancesList = [], otherList = [] } = payload;

  const fontDescriptors = {
    Roboto: {
      normal: path.join(__dirname, 'fonts', 'Roboto-Regular.ttf'),
      bold: path.join(__dirname, 'fonts', 'Roboto-Bold.ttf'),
      italics: path.join(__dirname, 'fonts', 'Roboto-Italic.ttf'),
      bolditalics: path.join(__dirname, 'fonts', 'Roboto-BoldItalic.ttf')
    }
  };

  const printer = new PdfPrinter(fontDescriptors);

  // Calculations (fallback to payload stats if not provided)
  const freight = trip ? Number(trip.freight_amount || 0) : 0;
  const totalIncomeReceived = incomeList.reduce((acc, row) => row.is_received ? acc + Number(row.amount || 0) : acc, 0);
  const totalDieselExpense = dieselList.reduce((acc, row) => acc + Number(row.total_amount || (Number(row.liters || 0) * Number(row.rate_per_liter || 0))), 0);
  const totalAdvanceExpense = advancesList.reduce((acc, row) => acc + Number(row.amount || 0), 0);
  const totalOtherExpense = otherList.reduce((acc, row) => acc + Number(row.amount || 0), 0);
  const totalExpense = totalDieselExpense + totalAdvanceExpense + totalOtherExpense;
  const actualProfit = totalIncomeReceived - totalExpense;
  const balanceReceivable = freight > 0 ? Math.max(0, freight - totalIncomeReceived) : 0;

  const showFreight = trip.freight_amount || 0;
  const showIncome = summary ? summary.total_income_received : totalIncomeReceived;
  const showExpense = summary ? summary.total_expense : totalExpense;
  const showProfit = summary ? summary.actual_profit : actualProfit;
  const showBalance = summary ? summary.balance_receivable : balanceReceivable;

  const statusLabel = (trip.status || 'open');

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [45, 55, 45, 55],
    defaultStyle: {
      font: 'Roboto',
      color: '#000000', // Crisp Solid Black
      fontSize: 8.5,
      lineHeight: 1.3
    },
    content: [
      // 1. Executive Top Header (Clean whitespace layout, no horizontal line)
      {
        columns: [
          [
            { text: 'TRUCK LEDGER STATEMENT', style: 'docTypeHeader' },
            { text: trip.trip_code || 'TR-N/A', style: 'mainDocId' }
          ],
          [
            { text: 'STATUS', style: 'metaLabel', alignment: 'right' },
            { 
              stack: [formatStatus(statusLabel)], 
              alignment: 'right', 
              margin: [0, 2, 0, 0] 
            }
          ]
        ],
        margin: [0, 0, 0, 28] // Generous whitespace instead of lines
      },

      // 2. Operational Metadata (Pure grid layout)
      {
        columns: [
          {
            width: '25%',
            stack: [
              { text: 'TRUCK NUMBER', style: 'metaLabel' },
              { text: trip.truck_number || '-', style: 'infoVal' }
            ]
          },
          {
            width: '25%',
            stack: [
              { text: 'DRIVER NAME', style: 'metaLabel' },
              { text: trip.driver_name || '-', style: 'infoVal' }
            ]
          },
          {
            width: '25%',
            stack: [
              { text: 'ROUTE RUN', style: 'metaLabel' },
              { text: `${trip.from_location || '-'} to ${trip.to_location || '-'}`, style: 'infoVal' }
            ]
          },
          {
            width: '25%',
            stack: [
              { text: 'CONSIGNMENT', style: 'metaLabel' },
              { text: `${trip.goods_type || 'Unspecified'} ${trip.weight_tons ? `(${trip.weight_tons} Tons)` : ''}`, style: 'infoVal' }
            ]
          }
        ],
        margin: [0, 0, 0, 18]
      },

      {
        columns: [
          {
            width: '25%',
            stack: [
              { text: 'LOADING DATE', style: 'metaLabel' },
              { text: formatDate(trip.loading_date), style: 'infoVal' }
            ]
          },
          {
            width: '25%',
            stack: [
              { text: 'DELIVERY DATE', style: 'metaLabel' },
              { text: trip.delivery_date ? formatDate(trip.delivery_date) : 'ON ROAD', style: 'infoVal' }
            ]
          },
          {
            width: '25%',
            stack: [
              { text: 'ODOMETER RUN', style: 'metaLabel' },
              { 
                text: trip.start_km && trip.end_km 
                  ? `${(trip.end_km - trip.start_km).toLocaleString('en-IN')} KM` 
                  : '-', 
                style: 'infoVal' 
              }
            ]
          },
          {
            width: '25%',
            stack: [
              { text: 'PARTY / BROKER', style: 'metaLabel' },
              { text: trip.party_name || '-', style: 'infoVal' }
            ]
          }
        ],
        margin: [0, 0, 0, 32] // Generous spacing separating operational details from financial statement
      },

      // 3. Crisp Financial Statement Layout (Clean, thin soft-grey dividers)
      { text: 'FINANCIAL STATEMENT SUMMARY', style: 'sectionHeader', margin: [0, 0, 0, 8] },
      {
        table: {
          widths: ['20%', '20%', '20%', '20%', '20%'],
          body: [
            [
              { text: 'AGREED FREIGHT', style: 'finLabel' },
              { text: 'INCOME RECEIVED', style: 'finLabel' },
              { text: 'TOTAL EXPENSES', style: 'finLabel' },
              { text: 'NET PROFIT', style: 'finLabel' },
              { text: 'OUTSTANDING DUE', style: 'finLabel' }
            ],
            [
              { text: formatCurrency(showFreight), style: 'finVal' },
              { text: formatCurrency(showIncome), style: 'finVal', color: '#15803d' }, 
              { text: formatCurrency(showExpense), style: 'finVal', color: '#b91c1c' }, 
              { text: formatCurrency(showProfit), style: 'finVal', color: showProfit >= 0 ? '#15803d' : '#b91c1c' },
              { text: formatCurrency(showBalance), style: 'finVal', color: showBalance > 0 ? '#b91c1c' : '#000000' }
            ]
          ]
        },
        layout: {
          hLineWidth: (i) => (i === 0 || i === 2) ? 0.5 : 0,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0', // Soft-grey dividers instead of harsh black lines
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 6,
          paddingBottom: () => 6
        },
        margin: [0, 0, 0, 30]
      }
    ],

    styles: {
      docTypeHeader: {
        fontSize: 7.5,
        bold: true,
        color: '#666666',
        letterSpacing: 1.5
      },
      mainDocId: {
        fontSize: 16,
        bold: true,
        color: '#000000',
        margin: [0, 2, 0, 0]
      },
      metaLabel: {
        fontSize: 7,
        bold: true,
        color: '#666666',
        letterSpacing: 0.8,
        margin: [0, 0, 0, 3]
      },
      infoVal: {
        fontSize: 8.5,
        bold: true,
        color: '#000000'
      },
      sectionHeader: {
        fontSize: 8,
        bold: true,
        color: '#000000',
        letterSpacing: 1,
        margin: [0, 0, 0, 4]
      },
      finLabel: {
        fontSize: 7,
        bold: true,
        color: '#666666',
        letterSpacing: 0.5
      },
      finVal: {
        fontSize: 9.5,
        bold: true,
        margin: [0, 2, 0, 0]
      },
      tableHeader: {
        bold: true,
        fontSize: 7.5,
        color: '#666666',
        letterSpacing: 0.5,
        margin: [0, 4, 0, 4]
      },
      tableRow: {
        fontSize: 7.5,
        color: '#000000',
        margin: [0, 3.5, 0, 3.5]
      },
      tableRowBold: {
        fontSize: 7.5,
        bold: true,
        color: '#000000',
        margin: [0, 3.5, 0, 3.5]
      },
      notesHeader: {
        fontSize: 8,
        bold: true,
        color: '#000000',
        letterSpacing: 0.5
      },
      notesVal: {
        fontSize: 8,
        color: '#555555',
        lineHeight: 1.3
      }
    }
  };

  // Pure-minimalist table layout (clean, extremely thin soft-grey horizontal lines, no vertical lines)
  const elegantTableLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0,
    hLineColor: () => '#e2e8f0', // Soft-grey everywhere
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 4,
    paddingBottom: () => 4
  };

  // 4. Income Table
  if (incomeList.length > 0) {
    docDefinition.content.push(
      { text: 'INCOME PAYMENTS LOG', style: 'sectionHeader', margin: [0, 10, 0, 5], pageBreak: 'auto' },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '15%', '20%', '20%', '15%', '15%'],
          body: [
            [
              { text: 'DATE', style: 'tableHeader' },
              { text: 'MODE', style: 'tableHeader' },
              { text: 'TYPE', style: 'tableHeader' },
              { text: 'REF/TXN NO.', style: 'tableHeader' },
              { text: 'STATUS', style: 'tableHeader' },
              { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
            ],
            ...incomeList.map(row => [
              { text: formatDate(row.date), style: 'tableRow' },
              { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow' },
              { text: (row.income_type || '-').toUpperCase(), style: 'tableRow' },
              { text: row.reference_number || '-', style: 'tableRow' },
              { 
                stack: [formatStatus(row.is_received ? 'Received' : 'Pending')],
                margin: [0, 1.5, 0, 0]
              },
              { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right', color: '#15803d' }
            ])
          ]
        },
        layout: elegantTableLayout,
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 5. Diesel Table
  if (dieselList.length > 0) {
    docDefinition.content.push(
      { text: 'FUEL & DIESEL ACCOUNTS (EXPENSES)', style: 'sectionHeader', margin: [0, 10, 0, 5], pageBreak: 'auto' },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '25%', '15%', '15%', '15%', '15%'],
          body: [
            [
              { text: 'DATE', style: 'tableHeader' },
              { text: 'STATION', style: 'tableHeader' },
              { text: 'LITERS', style: 'tableHeader', alignment: 'right' },
              { text: 'RATE/LTR', style: 'tableHeader', alignment: 'right' },
              { text: 'ODOMETER', style: 'tableHeader', alignment: 'right' },
              { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
            ],
            ...dieselList.map(row => {
              const liters = Number(row.liters || 0);
              const rate = Number(row.rate_per_liter || 0);
              const calculatedAmount = liters * rate;
              const actualAmount = row.total_amount ? Number(row.total_amount) : calculatedAmount;
              
              return [
                { text: formatDate(row.date), style: 'tableRow' },
                { text: row.fuel_station || '-', style: 'tableRow' },
                { text: liters > 0 ? liters.toFixed(1) : '-', style: 'tableRow', alignment: 'right' },
                { text: rate > 0 ? `₹${rate.toFixed(2)}` : '-', style: 'tableRow', alignment: 'right' },
                { text: row.odometer_km ? `${row.odometer_km.toLocaleString('en-IN')} km` : '-', style: 'tableRow', alignment: 'right' },
                { text: formatCurrency(actualAmount), style: 'tableRowBold', alignment: 'right', color: '#b91c1c' }
              ];
            })
          ]
        },
        layout: elegantTableLayout,
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 6. Driver Advances Table
  if (advancesList.length > 0) {
    docDefinition.content.push(
      { text: 'DRIVER ADVANCES DISBURSEMENTS (EXPENSES)', style: 'sectionHeader', margin: [0, 10, 0, 5], pageBreak: 'auto' },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '25%', '15%', '15%', '15%', '15%'],
          body: [
            [
              { text: 'DATE', style: 'tableHeader' },
              { text: 'DISBURSEMENT REASON', style: 'tableHeader' },
              { text: 'MODE', style: 'tableHeader' },
              { text: 'AUTHORIZED BY', style: 'tableHeader' },
              { text: 'STATUS', style: 'tableHeader' },
              { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
            ],
            ...advancesList.map(row => [
              { text: formatDate(row.date), style: 'tableRow' },
              { text: row.reason || row.notes || '-', style: 'tableRow' },
              { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow' },
              { text: row.given_by || '-', style: 'tableRow' },
              { 
                stack: [formatStatus(row.is_settled ? 'Settled' : 'Unsettled')],
                margin: [0, 1.5, 0, 0]
              },
              { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right', color: '#b91c1c' }
            ])
          ]
        },
        layout: elegantTableLayout,
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 7. Other Expenses Table
  if (otherList.length > 0) {
    docDefinition.content.push(
      { text: 'TOLLS, FEES & OPERATIONAL EXPENSES', style: 'sectionHeader', margin: [0, 10, 0, 5], pageBreak: 'auto' },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '25%', '15%', '15%', '15%', '15%'],
          body: [
            [
              { text: 'DATE', style: 'tableHeader' },
              { text: 'CATEGORY', style: 'tableHeader' },
              { text: 'PAID BY', style: 'tableHeader' },
              { text: 'VENDOR / LOCATION', style: 'tableHeader' },
              { text: 'MODE', style: 'tableHeader' },
              { text: 'AMOUNT', style: 'tableHeader', alignment: 'right' }
            ],
            ...otherList.map(row => [
              { text: formatDate(row.date), style: 'tableRow' },
              { text: (row.category || '-').toUpperCase(), style: 'tableRow' },
              { text: row.paid_by || '-', style: 'tableRow' },
              { text: row.place_vendor || '-', style: 'tableRow' },
              { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow' },
              { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right', color: '#b91c1c' }
            ])
          ]
        },
        layout: elegantTableLayout,
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 8. Notes block
  if (trip.notes && trip.notes.toLowerCase() !== 'not known') {
    docDefinition.content.push(
      {
        stack: [
          { text: 'ADDITIONAL DISPATCH REMARKS', style: 'notesHeader', margin: [0, 10, 0, 4] },
          { text: trip.notes, style: 'notesVal' }
        ],
        margin: [0, 15, 0, 0],
        pageBreak: 'auto'
      }
    );
  }

  // Footer/Header page number callbacks
  docDefinition.footer = function(currentPage, pageCount) {
    return {
      columns: [
        { text: `CONFIDENTIAL REPORT - GENERATED ${new Date().toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST`, alignment: 'left', fontSize: 7, color: '#666666', letterSpacing: 0.5 },
        { text: `PAGE ${currentPage} OF ${pageCount}`, alignment: 'right', fontSize: 7, color: '#666666', letterSpacing: 0.5 }
      ],
      margin: [45, 10, 45, 0]
    };
  };

  return printer.createPdfKitDocument(docDefinition);
};
