/**
 * KiranaPilot — Simple & Clean Customer Statement PDF Generator
 * Creates a clean, minimal, easy-to-read financial statement for Khatabook customers.
 */

export async function generateCustomerStatementPDF({ customer, metrics, transactions = [], merchant = {} }) {
  const customerName = customer?.name || 'Customer';
  const customerPhone = customer?.phone || 'No phone recorded';
  const customerId = customer?.id || customer?.customer_id || '—';

  const storeName = merchant?.store_name || merchant?.name || 'Kirana Store';
  const storePhone = merchant?.phone || '';

  const outstanding = metrics?.outstanding_amount !== undefined
    ? Number(metrics.outstanding_amount)
    : (metrics?.outstanding !== undefined ? Number(metrics.outstanding) : 0);
  const totalCredit = metrics?.total_credit !== undefined ? Number(metrics.total_credit) : 0;
  const totalRepaid = metrics?.total_repaid !== undefined ? Number(metrics.total_repaid) : 0;

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const generatedTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  try {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Clean Store Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // #0F172A
    doc.text(storeName, 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // #64748B
    if (storePhone) {
      doc.text(`Phone: ${storePhone}`, 14, 23);
    }
    doc.text('Customer Khata Statement', 14, storePhone ? 28 : 24);

    // Right Header Metadata
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${generatedDate}`, 196, 18, { align: 'right' });
    doc.text(`Time: ${generatedTime}`, 196, 23, { align: 'right' });
    doc.text(`Customer ID: #${customerId}`, 196, 28, { align: 'right' });

    // Subtle Top Divider Line
    const dividerY = storePhone ? 32 : 31;
    doc.setDrawColor(226, 232, 240); // #E2E8F0
    doc.setLineWidth(0.4);
    doc.line(14, dividerY, 196, dividerY);

    // 2. Customer Profile & Financial Summary Box
    doc.setFillColor(248, 250, 252); // #F8FAFC
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, dividerY + 4, 182, 24, 2, 2, 'FD');

    // Customer info on left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(customerName, 18, dividerY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Phone: ${customerPhone}`, 18, dividerY + 19);

    // 3 Clean Summary Badges on right
    const summaryStartY = dividerY + 10;

    // Total Credit
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Credit Given', 90, summaryStartY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rs. ${totalCredit.toLocaleString('en-IN')}`, 90, summaryStartY + 6);

    // Total Repaid
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Repaid', 130, summaryStartY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(22, 101, 52); // Green
    doc.text(`Rs. ${totalRepaid.toLocaleString('en-IN')}`, 130, summaryStartY + 6);

    // Net Balance Due
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Net Balance Due', 165, summaryStartY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    if (outstanding > 0) {
      doc.setTextColor(180, 83, 9); // Amber
      doc.text(`Rs. ${outstanding.toLocaleString('en-IN')}`, 165, summaryStartY + 6);
    } else {
      doc.setTextColor(22, 101, 52); // Green
      doc.text('Rs. 0 (Settled)', 165, summaryStartY + 6);
    }

    // 3. Simple Ledger Transactions Table
    const tableRows = (transactions || []).map((t) => {
      let dateStr = '—';
      try {
        const d = new Date(t.transaction_date);
        dateStr = !isNaN(d.getTime())
          ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : String(t.transaction_date).slice(0, 10);
      } catch {
        dateStr = String(t.transaction_date || '—').slice(0, 10);
      }

      const amt = Number(t.amount || 0);
      const isRepayment = t.transaction_type === 'KHATA_REPAYMENT';
      const isCredit = t.transaction_type === 'CREDIT_SALE';

      const typeLabel = isRepayment
        ? 'Repayment'
        : isCredit
        ? 'Credit Sale'
        : (t.transaction_type === 'CASH_SALE' ? 'Cash Sale' : t.transaction_type || 'Entry');

      const youGave = isCredit || t.transaction_type === 'CASH_SALE' ? `Rs. ${amt.toLocaleString('en-IN')}` : '—';
      const youGot = isRepayment ? `Rs. ${amt.toLocaleString('en-IN')}` : '—';

      return [
        dateStr,
        t.description || 'General Ledger Entry',
        typeLabel,
        youGave,
        youGot
      ];
    });

    autoTable(doc, {
      startY: dividerY + 33,
      head: [['Date', 'Description / Note', 'Type', 'You Gave (+)', 'You Got (-)']],
      body: tableRows.length > 0 ? tableRows : [['—', 'No transaction history recorded', '—', '—', '—']],
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249], // #F1F5F9 (Very light clean gray)
        textColor: [51, 65, 85],   // #334155
        fontSize: 8.5,
        fontStyle: 'bold',
        cellPadding: 3.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [51, 65, 85],
        lineColor: [241, 245, 249],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 70 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28, halign: 'right', fontStyle: 'normal' },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] }
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      }
    });

    // 4. Simple Totals Summary Line below table
    const finalY = (doc).lastAutoTable?.finalY || 140;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, finalY + 4, 196, finalY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Total Summary:', 14, finalY + 10);

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Credit: Rs. ${totalCredit.toLocaleString('en-IN')}`, 50, finalY + 10);
    doc.text(`Total Repaid: Rs. ${totalRepaid.toLocaleString('en-IN')}`, 100, finalY + 10);

    doc.setFont('helvetica', 'bold');
    if (outstanding > 0) {
      doc.setTextColor(180, 83, 9);
      doc.text(`Balance Due: Rs. ${outstanding.toLocaleString('en-IN')}`, 155, finalY + 10);
    } else {
      doc.setTextColor(22, 101, 52);
      doc.text('Balance Due: Rs. 0 (Settled)', 150, finalY + 10);
    }

    // 5. Clean Simple Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Thank you for your business! • Official ledger statement generated via KiranaPilot.',
      105,
      Math.min(finalY + 20, 285),
      { align: 'center' }
    );

    // Save/Download PDF
    const filename = `Statement_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
    return true;
  } catch (err) {
    console.warn('[PDFGenerator] Falling back to simplified print statement:', err.message);

    openSimpleHtmlPrintStatement({
      customerName,
      customerPhone,
      customerId,
      storeName,
      storePhone,
      outstanding,
      totalCredit,
      totalRepaid,
      generatedDate,
      generatedTime,
      transactions
    });
    return true;
  }
}

/**
 * Fallback simple print statement
 */
function openSimpleHtmlPrintStatement(data) {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert('Please allow popups to download and print the statement.');
    return;
  }

  const rowsHtml = (data.transactions || []).map(t => {
    const isRepay = t.transaction_type === 'KHATA_REPAYMENT';
    const isCredit = t.transaction_type === 'CREDIT_SALE';
    const amt = Number(t.amount || 0);

    return `
      <tr>
        <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
          ${t.transaction_date ? String(t.transaction_date).slice(0, 10) : '—'}
        </td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
          ${t.description || 'General Ledger Entry'}
        </td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
          ${isRepay ? 'Repayment' : (isCredit ? 'Credit Sale' : t.transaction_type)}
        </td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 11px;">
          ${isCredit ? `Rs. ${amt.toLocaleString('en-IN')}` : '—'}
        </td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 11px; font-weight: bold; color: #16a34a;">
          ${isRepay ? `Rs. ${amt.toLocaleString('en-IN')}` : '—'}
        </td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Statement - ${data.customerName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
          .header { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
          .store-name { font-size: 18px; font-weight: bold; }
          .meta { font-size: 11px; color: #64748b; text-align: right; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .cust-name { font-size: 14px; font-weight: bold; }
          .cust-phone { font-size: 11px; color: #64748b; margin-top: 2px; }
          .stats { display: flex; gap: 24px; font-size: 11px; }
          .stat-val { font-size: 13px; font-weight: bold; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="store-name">${data.storeName}</div>
            <div style="font-size: 11px; color: #64748b;">Customer Khata Statement</div>
          </div>
          <div class="meta">
            <div>Date: ${data.generatedDate}</div>
            <div>Customer ID: #${data.customerId}</div>
          </div>
        </div>

        <div class="box">
          <div>
            <div class="cust-name">${data.customerName}</div>
            <div class="cust-phone">Phone: ${data.customerPhone}</div>
          </div>
          <div class="stats">
            <div>
              <div style="color: #64748b;">Total Credit</div>
              <div class="stat-val">Rs. ${Number(data.totalCredit).toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style="color: #64748b;">Total Repaid</div>
              <div class="stat-val" style="color: #16a34a;">Rs. ${Number(data.totalRepaid).toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div style="color: #64748b;">Net Balance Due</div>
              <div class="stat-val" style="color: ${data.outstanding > 0 ? '#b45309' : '#16a34a'};">
                ${data.outstanding > 0 ? `Rs. ${Number(data.outstanding).toLocaleString('en-IN')}` : 'Rs. 0 (Settled)'}
              </div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Note</th>
              <th>Type</th>
              <th style="text-align: right;">You Gave (+)</th>
              <th style="text-align: right;">You Got (-)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 16px;">No transactions recorded</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Thank you for your business! • Official statement generated via KhataAI
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Generate a complete, clean directory PDF of ALL customers
 */
export async function generateAllCustomersPDF({ customers = [], intelligenceList = [], summary = {}, merchant = {} }) {
  const storeName = merchant?.store_name || merchant?.name || 'KhataAI Store';
  const storePhone = merchant?.phone || '';
  const merchantId = merchant?.id || '';

  // Calculate totals from customers / intelligence
  let totalCustomers = customers.length;
  let totalCredit = 0;
  let totalRepaid = 0;
  let totalOutstanding = 0;

  // Build lookup map from intelligence if available
  const intelMap = new Map();
  (intelligenceList || []).forEach(item => {
    intelMap.set(item.id || item.customer_id, item);
  });

  const processedRows = (customers || []).map((c, index) => {
    const intel = intelMap.get(c.id) || {};
    const credit = Number(intel.total_credit ?? c.total_credit ?? c.total_credit_given ?? 0);
    const repaid = Number(intel.total_repaid ?? c.total_repaid ?? 0);
    const out = Number(intel.outstanding ?? c.outstanding_balance ?? c.outstanding ?? 0);
    const rate = intel.repayment_rate ?? c.repayment_rate ?? (credit > 0 ? Math.round((repaid / credit) * 100) : 100);

    totalCredit += credit;
    totalRepaid += repaid;
    totalOutstanding += out;

    const statusStr = out > 0 ? `Rs. ${out.toLocaleString('en-IN')} Due` : 'Settled';

    return [
      String(index + 1),
      c.name || 'Unnamed Customer',
      c.phone || 'No phone',
      credit > 0 ? `Rs. ${credit.toLocaleString('en-IN')}` : 'Rs. 0',
      repaid > 0 ? `Rs. ${repaid.toLocaleString('en-IN')}` : 'Rs. 0',
      `${rate}%`,
      out > 0 ? `Rs. ${out.toLocaleString('en-IN')}` : 'Rs. 0',
      statusStr
    ];
  });

  if (summary) {
    if (summary.total_credit_given !== undefined) totalCredit = Number(summary.total_credit_given);
    if (summary.total_repaid !== undefined) totalRepaid = Number(summary.total_repaid);
    if (summary.total_outstanding !== undefined) totalOutstanding = Number(summary.total_outstanding);
  }

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const generatedTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  try {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Clean Store Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // #0F172A
    doc.text(storeName, 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // #64748B
    if (storePhone) {
      doc.text(`Phone: ${storePhone}${merchantId ? ` • Merchant #${merchantId}` : ''}`, 14, 23);
    }
    doc.text('Complete Customer Khata Ledger & Directory', 14, storePhone ? 28 : 24);

    // Right Header Metadata
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${generatedDate}`, 196, 18, { align: 'right' });
    doc.text(`Time: ${generatedTime}`, 196, 23, { align: 'right' });
    doc.text(`Total Accounts: ${totalCustomers}`, 196, 28, { align: 'right' });

    // Top Divider Line
    const dividerY = storePhone ? 32 : 31;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, dividerY, 196, dividerY);

    // 2. Financial Overview Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, dividerY + 4, 182, 20, 2, 2, 'FD');

    const summaryY = dividerY + 9;

    // Total Accounts
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Active Accounts', 22, summaryY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalCustomers} Customers`, 22, summaryY + 6);

    // Total Credit Given
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Credit Given', 72, summaryY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rs. ${totalCredit.toLocaleString('en-IN')}`, 72, summaryY + 6);

    // Total Repaid
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Repaid', 120, summaryY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(22, 101, 52); // Green
    doc.text(`Rs. ${totalRepaid.toLocaleString('en-IN')}`, 120, summaryY + 6);

    // Total Outstanding Due
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Outstanding Due', 160, summaryY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(totalOutstanding > 0 ? 180 : 22, totalOutstanding > 0 ? 83 : 101, totalOutstanding > 0 ? 9 : 52);
    doc.text(`Rs. ${totalOutstanding.toLocaleString('en-IN')}`, 160, summaryY + 6);

    // 3. Customers Table
    autoTable(doc, {
      startY: dividerY + 28,
      head: [['#', 'Customer Name', 'Phone', 'Credit Given', 'Repaid', 'Rate', 'Outstanding', 'Status']],
      body: processedRows.length > 0 ? processedRows : [['—', 'No customer records found', '—', '—', '—', '—', '—', '—']],
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.8,
        textColor: [51, 65, 85],
        lineColor: [241, 245, 249],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 42, fontStyle: 'bold' },
        2: { cellWidth: 30 },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 24, halign: 'right', textColor: [22, 101, 52] },
        5: { cellWidth: 16, halign: 'center' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 22, halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 6) {
          const raw = String(data.cell.raw || '');
          if (raw !== 'Rs. 0' && raw !== '—') {
            data.cell.styles.textColor = [180, 83, 9]; // Amber for outstanding
          } else {
            data.cell.styles.textColor = [22, 101, 52]; // Green for settled
          }
        }
      }
    });

    // 4. Totals Footer
    const finalY = doc.lastAutoTable?.finalY || 140;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, finalY + 4, 196, finalY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Accounts: ${totalCustomers}`, 14, finalY + 9);
    doc.text(`Total Credit: Rs. ${totalCredit.toLocaleString('en-IN')}`, 60, finalY + 9);
    doc.text(`Total Repaid: Rs. ${totalRepaid.toLocaleString('en-IN')}`, 110, finalY + 9);

    if (totalOutstanding > 0) {
      doc.setTextColor(180, 83, 9);
      doc.text(`Total Outstanding: Rs. ${totalOutstanding.toLocaleString('en-IN')}`, 155, finalY + 9);
    } else {
      doc.setTextColor(22, 101, 52);
      doc.text('Total Outstanding: Rs. 0', 155, finalY + 9);
    }

    // 5. Page Numbers & Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `KhataAI • Official Customer Ledger Report • Page ${i} of ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
    }

    const filename = `Customers_Ledger_${storeName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    doc.save(filename);
    return true;
  } catch (err) {
    console.warn('[PDFGenerator] Falling back to HTML print for all customers:', err.message);
    openSimpleHtmlAllCustomersPrint({
      storeName,
      storePhone,
      merchantId,
      totalCustomers,
      totalCredit,
      totalRepaid,
      totalOutstanding,
      generatedDate,
      generatedTime,
      rows: processedRows
    });
    return true;
  }
}

/**
 * Fallback HTML Print for All Customers
 */
function openSimpleHtmlAllCustomersPrint(data) {
  const printWindow = window.open('', '_blank', 'width=900,height=950');
  if (!printWindow) {
    alert('Please allow popups to download and print the customer directory.');
    return;
  }

  const tableRowsHtml = (data.rows || []).map(r => `
    <tr>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 11px;">${r[0]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; font-size: 11px;">${r[1]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #64748b;">${r[2]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 11px;">${r[3]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 11px; color: #16a34a;">${r[4]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 11px;">${r[5]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold; font-size: 11px; color: ${r[6] !== 'Rs. 0' ? '#b45309' : '#16a34a'};">${r[6]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 11px;">${r[7]}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Customer Ledger - ${data.storeName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
          .header { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
          .store-name { font-size: 18px; font-weight: bold; }
          .meta { font-size: 11px; color: #64748b; text-align: right; }
          .summary { display: flex; gap: 32px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
          .stat-label { font-size: 10px; color: #64748b; }
          .stat-val { font-size: 13px; font-weight: bold; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
          .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="store-name">${data.storeName}</div>
            <div style="font-size: 11px; color: #64748b;">Complete Customer Khata Ledger</div>
          </div>
          <div class="meta">
            <div>Date: ${data.generatedDate} ${data.generatedTime}</div>
            <div>Total Accounts: ${data.totalCustomers}</div>
          </div>
        </div>

        <div class="summary">
          <div>
            <div class="stat-label">Total Accounts</div>
            <div class="stat-val">${data.totalCustomers} Customers</div>
          </div>
          <div>
            <div class="stat-label">Total Credit Given</div>
            <div class="stat-val">Rs. ${Number(data.totalCredit).toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="stat-label">Total Repaid</div>
            <div class="stat-val" style="color: #16a34a;">Rs. ${Number(data.totalRepaid).toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div class="stat-label">Total Outstanding</div>
            <div class="stat-val" style="color: ${data.totalOutstanding > 0 ? '#b45309' : '#16a34a'};">
              Rs. ${Number(data.totalOutstanding).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center;">#</th>
              <th>Customer Name</th>
              <th>Phone</th>
              <th style="text-align: right;">Credit Given</th>
              <th style="text-align: right;">Repaid</th>
              <th style="text-align: center;">Rate</th>
              <th style="text-align: right;">Outstanding</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 16px;">No customers found</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Official statement generated via KhataAI
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
