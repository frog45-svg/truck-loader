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

// Helper to create a styled status badge
function makeBadge(text, type) {
  let bgColor = '#f1f5f9'; // default slate-100
  let textColor = '#475569'; // default slate-600

  if (type === 'success' || text.toLowerCase() === 'received' || text.toLowerCase() === 'settled' || text.toLowerCase() === 'completed') {
    bgColor = '#dcfce7'; // green-100
    textColor = '#15803d'; // green-700
  } else if (type === 'warning' || text.toLowerCase() === 'pending' || text.toLowerCase() === 'unsettled' || text.toLowerCase() === 'open') {
    bgColor = '#fef3c7'; // amber-100
    textColor = '#b45309'; // amber-700
  } else if (type === 'danger' || text.toLowerCase() === 'cancelled') {
    bgColor = '#fee2e2'; // red-100
    textColor = '#b91c1c'; // red-700
  }

  return {
    table: {
      body: [[
        { 
          text: text.toUpperCase(), 
          color: textColor, 
          bold: true, 
          fontSize: 7, 
          alignment: 'center',
          margin: [0, 2, 0, 2]
        }
      ]]
    },
    layout: 'noBorders',
    fillColor: bgColor,
    width: 'auto'
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
    pageMargins: [40, 50, 40, 50],
    defaultStyle: {
      font: 'Roboto',
      color: '#334155',
      fontSize: 9
    },
    content: [
      // 1. Sleek Header Banner
      {
        columns: [
          [
            { text: 'TRUCK LEDGER REPORT', style: 'headerSubTitle' },
            { text: `Trip Run Details`, style: 'headerTitle' }
          ],
          [
            { text: `ID: ${trip.trip_code || 'N/A'}`, style: 'tripCode', alignment: 'right' },
            { 
              stack: [
                makeBadge(statusLabel, statusLabel === 'completed' ? 'success' : (statusLabel === 'cancelled' ? 'danger' : 'warning'))
              ], 
              alignment: 'right', 
              margin: [0, 4, 0, 0] 
            }
          ]
        ],
        margin: [0, 0, 0, 15]
      },

      // Accent border below header
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#f97316' }],
        margin: [0, 0, 0, 20]
      },

      // 2. Operational Details (With clean vertical separators and left-borders)
      {
        table: {
          widths: ['4%', '44%', '4%', '48%'],
          body: [
            [
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 3, h: 48, r: 1.5, color: '#64748b' }]
              },
              {
                stack: [
                  { text: 'ROUTE DETAILS', style: 'sectionHeader' },
                  { text: `${trip.from_location || '-'} to ${trip.to_location || '-'}`, style: 'infoVal', fontSize: 11 },
                  { text: `Consignment: ${trip.goods_type || 'Unspecified'} ${trip.weight_tons ? `(${trip.weight_tons} Tons)` : ''}`, style: 'infoSubVal' }
                ],
                margin: [-5, 0, 0, 0]
              },
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 3, h: 48, r: 1.5, color: '#f97316' }]
              },
              {
                stack: [
                  { text: 'TRUCK & DRIVER', style: 'sectionHeader' },
                  { text: `${trip.truck_number || '-'}`, style: 'infoVal', fontSize: 11 },
                  { text: `Driver: ${trip.driver_name || '-'}`, style: 'infoSubVal' }
                ],
                margin: [-5, 0, 0, 0]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 15]
      },

      {
        table: {
          widths: ['4%', '44%', '4%', '48%'],
          body: [
            [
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 3, h: 48, r: 1.5, color: '#94a3b8' }]
              },
              {
                stack: [
                  { text: 'TIMELINE', style: 'sectionHeader' },
                  { text: `Loaded: ${formatDate(trip.loading_date)}`, style: 'infoVal' },
                  { text: `Delivered: ${trip.delivery_date ? formatDate(trip.delivery_date) : 'ON ROAD'}`, style: 'infoSubVal' }
                ],
                margin: [-5, 0, 0, 0]
              },
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 3, h: 48, r: 1.5, color: '#94a3b8' }]
              },
              {
                stack: [
                  { text: 'OPERATIONAL STATS', style: 'sectionHeader' },
                  { text: `Odometer Run: ${trip.start_km && trip.end_km ? `${(trip.end_km - trip.start_km).toLocaleString('en-IN')} KM` : '-'}`, style: 'infoVal' },
                  { text: `Party / Broker: ${trip.party_name || '-'}`, style: 'infoSubVal' }
                ],
                margin: [-5, 0, 0, 0]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 25]
      },

      // 3. Premium Financial Cards Grid (1 row table with 5 elegant cards, each having a left-accent border)
      {
        table: {
          widths: ['20%', '20%', '20%', '20%', '20%'],
          body: [
            [
              // Card 1: Freight
              {
                fillColor: '#f8fafc',
                border: [true, true, true, true],
                borderColor: '#e2e8f0',
                margin: [4, 6, 4, 6],
                stack: [
                  { text: 'FREIGHT', style: 'cardLabel' },
                  { text: formatCurrency(showFreight), style: 'cardValue', color: '#475569' }
                ]
              },
              // Card 2: Received (Green Left-Border)
              {
                fillColor: '#f0fdf4',
                border: [true, true, true, true],
                borderColor: '#bbf7d0',
                margin: [4, 6, 4, 6],
                stack: [
                  { text: 'RECEIVED', style: 'cardLabel', color: '#15803d' },
                  { text: formatCurrency(showIncome), style: 'cardValue', color: '#15803d' }
                ]
              },
              // Card 3: Expenses (Red Left-Border)
              {
                fillColor: '#fef2f2',
                border: [true, true, true, true],
                borderColor: '#fecaca',
                margin: [4, 6, 4, 6],
                stack: [
                  { text: 'EXPENSES', style: 'cardLabel', color: '#b91c1c' },
                  { text: formatCurrency(showExpense), style: 'cardValue', color: '#b91c1c' }
                ]
              },
              // Card 4: Profit (Green/Red depending on status)
              {
                fillColor: showProfit >= 0 ? '#f0fdf4' : '#fef2f2',
                border: [true, true, true, true],
                borderColor: showProfit >= 0 ? '#bbf7d0' : '#fecaca',
                margin: [4, 6, 4, 6],
                stack: [
                  { text: 'NET PROFIT', style: 'cardLabel', color: showProfit >= 0 ? '#15803d' : '#b91c1c' },
                  { text: formatCurrency(showProfit), style: 'cardValue', color: showProfit >= 0 ? '#15803d' : '#b91c1c' }
                ]
              },
              // Card 5: Receivable
              {
                fillColor: '#f8fafc',
                border: [true, true, true, true],
                borderColor: '#e2e8f0',
                margin: [4, 6, 4, 6],
                stack: [
                  { text: 'RECEIVABLE', style: 'cardLabel', color: '#64748b' },
                  { text: formatCurrency(showBalance), style: 'cardValue', color: '#0f172a' }
                ]
              }
            ]
          ]
        },
        margin: [0, 0, 0, 30]
      }
    ],

    styles: {
      headerSubTitle: {
        fontSize: 9,
        bold: true,
        color: '#f97316',
        letterSpacing: 1.5
      },
      headerTitle: {
        fontSize: 20,
        bold: true,
        color: '#0f172a',
        margin: [0, 1, 0, 0]
      },
      tripCode: {
        fontSize: 13,
        bold: true,
        color: '#64748b'
      },
      sectionHeader: {
        fontSize: 8,
        bold: true,
        color: '#94a3b8',
        letterSpacing: 0.5,
        margin: [0, 0, 0, 2]
      },
      infoVal: {
        fontSize: 9.5,
        bold: true,
        color: '#334155'
      },
      infoSubVal: {
        fontSize: 8.5,
        color: '#64748b',
        margin: [0, 1, 0, 0]
      },
      cardLabel: {
        fontSize: 7.5,
        bold: true,
        color: '#94a3b8',
        alignment: 'center'
      },
      cardValue: {
        fontSize: 10.5,
        bold: true,
        alignment: 'center',
        margin: [0, 3, 0, 0]
      },
      tableHeader: {
        bold: true,
        fontSize: 8.5,
        color: '#475569',
        fillColor: '#f8fafc',
        margin: [4, 5, 4, 5]
      },
      tableRow: {
        fontSize: 8.5,
        margin: [4, 4, 4, 4]
      },
      tableRowBold: {
        fontSize: 8.5,
        bold: true,
        color: '#0f172a',
        margin: [4, 4, 4, 4]
      },
      notesHeader: {
        fontSize: 9,
        bold: true,
        color: '#475569'
      },
      notesVal: {
        fontSize: 8.5,
        color: '#64748b',
        italics: true
      }
    }
  };

  // Modern Table layout formatter (Stripe design with light grey borders)
  const premiumTableLayout = {
    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? '#94a3b8' : '#e2e8f0',
    paddingLeft: () => 6,
    paddingRight: () => 6
  };

  // Add detail lists if they have data
  
  // 4. Income Table
  if (incomeList.length > 0) {
    docDefinition.content.push(
      { 
        text: 'INCOME PAYMENTS LEDGER', 
        fontSize: 10, 
        bold: true, 
        color: '#0f172a', 
        margin: [0, 10, 0, 6], 
        letterSpacing: 0.5, 
        pageBreak: 'auto' 
      },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '15%', '15%', '20%', '15%', '20%'],
          body: [
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Mode', style: 'tableHeader' },
              { text: 'Type', style: 'tableHeader' },
              { text: 'Ref/Txn No.', style: 'tableHeader' },
              { text: 'Status', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            ...incomeList.map((row, idx) => {
              const rowFill = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return [
                { text: formatDate(row.date), style: 'tableRow', fillColor: rowFill },
                { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow', fillColor: rowFill },
                { text: row.income_type || '-', style: 'tableRow', fillColor: rowFill },
                { text: row.reference_number || '-', style: 'tableRow', fillColor: rowFill },
                { 
                  stack: [makeBadge(row.is_received ? 'Received' : 'Pending', row.is_received ? 'success' : 'warning')],
                  fillColor: rowFill,
                  margin: [0, 2, 0, 2]
                },
                { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right', fillColor: rowFill }
              ];
            })
          ]
        },
        layout: premiumTableLayout,
        margin: [0, 0, 0, 18]
      }
    );
  }

  // 5. Diesel Table
  if (dieselList.length > 0) {
    docDefinition.content.push(
      { 
        text: 'FUEL / DIESEL FILLING LOGS', 
        fontSize: 10, 
        bold: true, 
        color: '#0f172a', 
        margin: [0, 10, 0, 6], 
        letterSpacing: 0.5, 
        pageBreak: 'auto' 
      },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '25%', '15%', '15%', '15%', '15%'],
          body: [
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Fuel Station', style: 'tableHeader' },
              { text: 'Liters', style: 'tableHeader', alignment: 'right' },
              { text: 'Rate/Ltr', style: 'tableHeader', alignment: 'right' },
              { text: 'Odometer', style: 'tableHeader', alignment: 'right' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            ...dieselList.map((row, idx) => {
              const rowFill = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const liters = Number(row.liters || 0);
              const rate = Number(row.rate_per_liter || 0);
              const calculatedAmount = liters * rate;
              const actualAmount = row.total_amount ? Number(row.total_amount) : calculatedAmount;
              
              return [
                { text: formatDate(row.date), style: 'tableRow', fillColor: rowFill },
                { text: row.fuel_station || '-', style: 'tableRow', fillColor: rowFill },
                { text: liters > 0 ? liters.toFixed(1) : '-', style: 'tableRow', alignment: 'right', fillColor: rowFill },
                { text: rate > 0 ? `₹${rate.toFixed(2)}` : '-', style: 'tableRow', alignment: 'right', fillColor: rowFill },
                { text: row.odometer_km ? `${row.odometer_km.toLocaleString('en-IN')} km` : '-', style: 'tableRow', alignment: 'right', fillColor: rowFill },
                { text: formatCurrency(actualAmount), style: 'tableRowBold', alignment: 'right', fillColor: rowFill }
              ];
            })
          ]
        },
        layout: premiumTableLayout,
        margin: [0, 0, 0, 18]
      }
    );
  }

  // 6. Advances Table
  if (advancesList.length > 0) {
    docDefinition.content.push(
      { 
        text: 'DRIVER ADVANCES LEDGER', 
        fontSize: 10, 
        bold: true, 
        color: '#0f172a', 
        margin: [0, 10, 0, 6], 
        letterSpacing: 0.5, 
        pageBreak: 'auto' 
      },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '25%', '15%', '15%', '15%', '15%'],
          body: [
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Reason / Notes', style: 'tableHeader' },
              { text: 'Mode', style: 'tableHeader' },
              { text: 'Given By', style: 'tableHeader' },
              { text: 'Status', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            ...advancesList.map((row, idx) => {
              const rowFill = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return [
                { text: formatDate(row.date), style: 'tableRow', fillColor: rowFill },
                { text: row.reason || row.notes || '-', style: 'tableRow', fillColor: rowFill },
                { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow', fillColor: rowFill },
                { text: row.given_by || '-', style: 'tableRow', fillColor: rowFill },
                { 
                  stack: [makeBadge(row.is_settled ? 'Settled' : 'Unsettled', row.is_settled ? 'success' : 'warning')],
                  fillColor: rowFill,
                  margin: [0, 2, 0, 2]
                },
                { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right', fillColor: rowFill }
              ];
            })
          ]
        },
        layout: premiumTableLayout,
        margin: [0, 0, 0, 18]
      }
    );
  }

  // 7. Other Expenses Table
  if (otherList.length > 0) {
    docDefinition.content.push(
      { 
        text: 'TOLLS & OTHER EXPENSES LEDGER', 
        fontSize: 10, 
        bold: true, 
        color: '#0f172a', 
        margin: [0, 10, 0, 6], 
        letterSpacing: 0.5, 
        pageBreak: 'auto' 
      },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '25%', '15%', '15%', '15%', '15%'],
          body: [
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Category', style: 'tableHeader' },
              { text: 'Paid By', style: 'tableHeader' },
              { text: 'Vendor / Place', style: 'tableHeader' },
              { text: 'Mode', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            ...otherList.map((row, idx) => {
              const rowFill = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return [
                { text: formatDate(row.date), style: 'tableRow', fillColor: rowFill },
                { text: row.category || '-', style: 'tableRow', capitalize: true, fillColor: rowFill },
                { text: row.paid_by || '-', style: 'tableRow', fillColor: rowFill },
                { text: row.place_vendor || '-', style: 'tableRow', fillColor: rowFill },
                { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow', fillColor: rowFill },
                { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right', fillColor: rowFill }
              ];
            })
          ]
        },
        layout: premiumTableLayout,
        margin: [0, 0, 0, 18]
      }
    );
  }

  // 8. Notes block
  if (trip.notes && trip.notes.toLowerCase() !== 'not known') {
    docDefinition.content.push(
      {
        stack: [
          { text: 'Trip Notes / Dispatches Remarks', style: 'notesHeader' },
          { text: trip.notes, style: 'notesVal', margin: [0, 4, 0, 0] }
        ],
        fillColor: '#f8fafc',
        border: [true, true, true, true],
        borderColor: '#e2e8f0',
        padding: [10, 10, 10, 10],
        margin: [0, 10, 0, 0],
        pageBreak: 'auto'
      }
    );
  }

  // Footer page number and metadata callbacks
  docDefinition.footer = function(currentPage, pageCount) {
    return {
      columns: [
        { text: `Report Generated: ${new Date().toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, alignment: 'left', fontSize: 7.5, color: '#94a3b8' },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7.5, color: '#94a3b8' }
      ],
      margin: [40, 10, 40, 0]
    };
  };

  return printer.createPdfKitDocument(docDefinition);
};
