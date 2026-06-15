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

  const statusLabel = (trip.status || 'open').toUpperCase();
  let statusColor = '#f59e0b'; // amber
  if (statusLabel === 'COMPLETED') statusColor = '#10b981'; // emerald
  if (statusLabel === 'CANCELLED') statusColor = '#ef4444'; // rose

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: {
      font: 'Roboto',
      color: '#334155'
    },
    content: [
      // 1. Header Section
      {
        columns: [
          [
            { text: 'TRUCK RUN LEDGER', style: 'headerSubTitle' },
            { text: `Trip Run Report`, style: 'headerTitle' }
          ],
          [
            { text: `CODE: ${trip.trip_code || 'N/A'}`, style: 'tripCode', alignment: 'right' },
            {
              text: statusLabel,
              alignment: 'right',
              color: statusColor,
              bold: true,
              fontSize: 12,
              margin: [0, 4, 0, 0]
            }
          ]
        ],
        margin: [0, 0, 0, 20]
      },

      // Divider Line
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#cbd5e1' }],
        margin: [0, 0, 0, 15]
      },

      // 2. Metadata / Run Details Section
      {
        style: 'sectionTitle',
        text: 'Operational Details'
      },
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: 'TRUCK NUMBER', style: 'metaLabel' },
              { text: 'DRIVER NAME', style: 'metaLabel' },
              { text: 'LOADING DATE', style: 'metaLabel' },
              { text: 'DELIVERY DATE', style: 'metaLabel' }
            ],
            [
              { text: trip.truck_number || '-', style: 'metaVal' },
              { text: trip.driver_name || '-', style: 'metaVal' },
              { text: formatDate(trip.loading_date), style: 'metaVal' },
              { text: trip.delivery_date ? formatDate(trip.delivery_date) : 'ON ROAD', style: 'metaVal' }
            ],
            [
              { text: 'ROUTE', style: 'metaLabel', margin: [0, 8, 0, 0] },
              { text: 'CONSIGNMENT', style: 'metaLabel', margin: [0, 8, 0, 0] },
              { text: 'PARTY / BROKER', style: 'metaLabel', margin: [0, 8, 0, 0] },
              { text: 'ODOMETER RUN', style: 'metaLabel', margin: [0, 8, 0, 0] }
            ],
            [
              { text: `${trip.from_location || '-'} → ${trip.to_location || '-'}`, style: 'metaVal' },
              { text: `${trip.goods_type || 'Unspecified'} ${trip.weight_tons ? `(${trip.weight_tons} Tons)` : ''}`, style: 'metaVal' },
              { text: trip.party_name || '-', style: 'metaVal' },
              { 
                text: trip.start_km && trip.end_km 
                  ? `${(trip.end_km - trip.start_km).toLocaleString('en-IN')} KM (${trip.start_km}-${trip.end_km})` 
                  : '-', 
                style: 'metaVal' 
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20]
      },

      // 3. Financial Summary Grid
      {
        style: 'sectionTitle',
        text: 'Financial Ledger Summary'
      },
      {
        table: {
          widths: ['20%', '20%', '20%', '20%', '20%'],
          body: [
            [
              {
                fillColor: '#f8fafc',
                border: [true, true, true, true],
                borderColor: '#e2e8f0',
                stack: [
                  { text: 'FREIGHT', style: 'summaryLabel' },
                  { text: formatCurrency(showFreight), style: 'summaryVal' }
                ],
                margin: [6, 8, 6, 8]
              },
              {
                fillColor: '#f0fdf4',
                border: [true, true, true, true],
                borderColor: '#bbf7d0',
                stack: [
                  { text: 'RECEIVED', style: 'summaryLabel', color: '#15803d' },
                  { text: formatCurrency(showIncome), style: 'summaryVal', color: '#15803d' }
                ],
                margin: [6, 8, 6, 8]
              },
              {
                fillColor: '#fef2f2',
                border: [true, true, true, true],
                borderColor: '#fecaca',
                stack: [
                  { text: 'EXPENSES', style: 'summaryLabel', color: '#b91c1c' },
                  { text: formatCurrency(showExpense), style: 'summaryVal', color: '#b91c1c' }
                ],
                margin: [6, 8, 6, 8]
              },
              {
                fillColor: showProfit >= 0 ? '#f0fdf4' : '#fef2f2',
                border: [true, true, true, true],
                borderColor: showProfit >= 0 ? '#bbf7d0' : '#fecaca',
                stack: [
                  { text: 'NET PROFIT', style: 'summaryLabel', color: showProfit >= 0 ? '#15803d' : '#b91c1c' },
                  { text: formatCurrency(showProfit), style: 'summaryVal', color: showProfit >= 0 ? '#15803d' : '#b91c1c' }
                ],
                margin: [6, 8, 6, 8]
              },
              {
                fillColor: '#f8fafc',
                border: [true, true, true, true],
                borderColor: '#e2e8f0',
                stack: [
                  { text: 'RECEIVABLE', style: 'summaryLabel' },
                  { text: formatCurrency(showBalance), style: 'summaryVal' }
                ],
                margin: [6, 8, 6, 8]
              }
            ]
          ]
        },
        margin: [0, 0, 0, 25]
      }
    ],

    styles: {
      headerSubTitle: {
        fontSize: 10,
        bold: true,
        color: '#f97316',
        letterSpacing: 1.5
      },
      headerTitle: {
        fontSize: 22,
        bold: true,
        color: '#0f172a',
        margin: [0, 2, 0, 0]
      },
      tripCode: {
        fontSize: 14,
        bold: true,
        color: '#475569'
      },
      sectionTitle: {
        fontSize: 12,
        bold: true,
        color: '#0f172a',
        margin: [0, 5, 0, 8],
        letterSpacing: 0.5
      },
      metaLabel: {
        fontSize: 8,
        bold: true,
        color: '#94a3b8'
      },
      metaVal: {
        fontSize: 10,
        bold: true,
        color: '#334155',
        margin: [0, 2, 0, 0]
      },
      summaryLabel: {
        fontSize: 8,
        bold: true,
        color: '#64748b',
        alignment: 'center'
      },
      summaryVal: {
        fontSize: 11,
        bold: true,
        color: '#0f172a',
        alignment: 'center',
        margin: [0, 4, 0, 0]
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: '#475569',
        fillColor: '#f1f5f9',
        margin: [4, 6, 4, 6]
      },
      tableRow: {
        fontSize: 9,
        margin: [4, 5, 4, 5]
      },
      tableRowBold: {
        fontSize: 9,
        bold: true,
        color: '#0f172a',
        margin: [4, 5, 4, 5]
      },
      notesHeader: {
        fontSize: 9,
        bold: true,
        color: '#475569'
      },
      notesVal: {
        fontSize: 9,
        color: '#64748b',
        italics: true
      }
    }
  };

  // Add detail lists if they have data
  
  // 4. Income Table
  if (incomeList.length > 0) {
    docDefinition.content.push(
      { style: 'sectionTitle', text: 'Income Payments Log', pageBreak: 'auto' },
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
            ...incomeList.map(row => [
              { text: formatDate(row.date), style: 'tableRow' },
              { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow' },
              { text: row.income_type || '-', style: 'tableRow' },
              { text: row.reference_number || '-', style: 'tableRow' },
              { 
                text: row.is_received ? 'Received' : 'Pending', 
                style: 'tableRowBold', 
                color: row.is_received ? '#059669' : '#d97706' 
              },
              { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right' }
            ])
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6
        },
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 5. Diesel Table
  if (dieselList.length > 0) {
    docDefinition.content.push(
      { style: 'sectionTitle', text: 'Fuel / Diesel Logs', pageBreak: 'auto' },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '20%', '15%', '15%', '15%', '20%'],
          body: [
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Fuel Station', style: 'tableHeader' },
              { text: 'Liters', style: 'tableHeader', alignment: 'right' },
              { text: 'Rate/Ltr', style: 'tableHeader', alignment: 'right' },
              { text: 'Odometer', style: 'tableHeader', alignment: 'right' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
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
                { text: formatCurrency(actualAmount), style: 'tableRowBold', alignment: 'right' }
              ];
            })
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6
        },
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 6. Advances Table
  if (advancesList.length > 0) {
    docDefinition.content.push(
      { style: 'sectionTitle', text: 'Driver Advances Log', pageBreak: 'auto' },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '20%', '15%', '15%', '15%', '20%'],
          body: [
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Reason / Notes', style: 'tableHeader' },
              { text: 'Mode', style: 'tableHeader' },
              { text: 'Given By', style: 'tableHeader' },
              { text: 'Status', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            ...advancesList.map(row => [
              { text: formatDate(row.date), style: 'tableRow' },
              { text: row.reason || row.notes || '-', style: 'tableRow' },
              { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow' },
              { text: row.given_by || '-', style: 'tableRow' },
              { 
                text: row.is_settled ? 'Settled' : 'Unsettled', 
                style: 'tableRowBold', 
                color: row.is_settled ? '#059669' : '#d97706' 
              },
              { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right' }
            ])
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6
        },
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 7. Other Expenses Table
  if (otherList.length > 0) {
    docDefinition.content.push(
      { style: 'sectionTitle', text: 'Tolls & Other Expenses Log', pageBreak: 'auto' },
      {
        table: {
          headerRows: 1,
          widths: ['15%', '20%', '15%', '15%', '15%', '20%'],
          body: [
            [
              { text: 'Date', style: 'tableHeader' },
              { text: 'Category', style: 'tableHeader' },
              { text: 'Paid By', style: 'tableHeader' },
              { text: 'Vendor / Place', style: 'tableHeader' },
              { text: 'Mode', style: 'tableHeader' },
              { text: 'Amount', style: 'tableHeader', alignment: 'right' }
            ],
            ...otherList.map(row => [
              { text: formatDate(row.date), style: 'tableRow' },
              { text: row.category || '-', style: 'tableRow', capitalize: true },
              { text: row.paid_by || '-', style: 'tableRow' },
              { text: row.place_vendor || '-', style: 'tableRow' },
              { text: (row.payment_mode || '-').toUpperCase(), style: 'tableRow' },
              { text: formatCurrency(row.amount), style: 'tableRowBold', alignment: 'right' }
            ])
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6
        },
        margin: [0, 0, 0, 20]
      }
    );
  }

  // 8. Notes block
  if (trip.notes && trip.notes.toLowerCase() !== 'not known') {
    docDefinition.content.push(
      {
        stack: [
          { text: 'Trip Notes / Dispatches Remark', style: 'notesHeader' },
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

  // Footer/Header page number callbacks
  docDefinition.footer = function(currentPage, pageCount) {
    return {
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#94a3b8',
      margin: [0, 10, 0, 0]
    };
  };

  return printer.createPdfKitDocument(docDefinition);
};
