import JsBarcode from 'jsbarcode';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

// Kino-convert ang whole number price patungong letter code (hal. 280.00 -> WPL)
export function encodePriceToLetters(val) {
  const wholeNum = Math.trunc(Number(val) || 0);
  const codeMap = {
    '1': 'M', '2': 'W', '3': 'A', '4': 'N', '5': 'D',
    '6': 'E', '7': 'R', '8': 'P', '9': 'O', '0': 'L',
  };

  return String(wholeNum)
    .split('')
    .map((digit) => codeMap[digit] || '')
    .join('');
}

export function printVariantBarcodes(batch, master, qty) {
  return new Promise((resolve) => {
    const count = parseInt(qty, 10) || 0;
    if (count <= 0 || !batch) {
      resolve(false);
      return;
    }

    const bCode = batch.code || batch.variant_code || '';
    const barcodeValue = (batch.barcode || bCode).toUpperCase();
    const partName = master?.partName || master?.part_name || 'AUTO PART';
    const oem = master?.oem ? `(${master.oem})` : '';
    const partTitle = `${partName} ${oem}`.trim();
    const priceText = encodePriceToLetters(batch.price || 0);

    const tempSvg = document.createElementNS('http://w3.org', 'svg');
    JsBarcode(tempSvg, barcodeValue, {
      format: 'CODE128',
      width: 1.6,
      height: 36,
      fontSize: 11,
      fontOptions: 'bold',
      margin: 2,
      displayValue: true,
    });
    const svgMarkup = tempSvg.outerHTML;

    const singleLabelHtml = `
      <div class="sticker-label">
        <div class="sticker-part">${escapeHtml(partTitle)}</div>
        <div class="sticker-barcode">${svgMarkup}</div>
        <div class="sticker-footer">
          <span>${escapeHtml(batch.supplier || '')}</span>
          <span class="sticker-price">${priceText}</span>
        </div>
      </div>
    `;
    const allStickersHtml = Array(count).fill(singleLabelHtml).join('');

    const existingFrame = document.getElementById('barcodePrintFrame');
    if (existingFrame) existingFrame.remove();

    const printFrame = document.createElement('iframe');
    printFrame.id = 'barcodePrintFrame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes - ${escapeHtml(barcodeValue)} (${count} pcs)</title>
        <style>
          @page { size: 50mm 30mm; margin: 0; }
          * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
          body { margin: 0; padding: 0; background: #fff; }
          .sticker-label {
            width: 50mm; height: 30mm; padding: 2mm 3mm;
            display: flex; flex-direction: column; justify-content: space-between;
            align-items: center; text-align: center;
            page-break-after: always; break-after: page; overflow: hidden;
          }
          .sticker-label:last-child { page-break-after: auto; break-after: auto; }
          .sticker-part {
            font-size: 7.5pt; font-weight: 700; color: #000; width: 100%;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase;
          }
          .sticker-barcode svg { max-width: 44mm; max-height: 16mm; display: block; }
          .sticker-footer {
            width: 100%; display: flex; justify-content: space-between; align-items: center;
            font-size: 7pt; font-weight: 700; color: #000; border-top: 0.5pt solid #000; padding-top: 1px;
          }
          .sticker-price { font-size: 8.5pt; font-weight: 800; }
        </style>
      </head>
      <body>${allStickersHtml}</body>
      </html>
    `);
    frameDoc.close();

    let isDone = false;
    const finishPrintDialog = () => {
      if (isDone) return;
      isDone = true;
      resolve(true);
    };

    setTimeout(() => {
      const win = printFrame.contentWindow;
      if (!win) {
        finishPrintDialog();
        return;
      }
      win.onafterprint = finishPrintDialog;
      win.focus();
      win.print();
      setTimeout(finishPrintDialog, 500);
    }, 150);
  });
}
