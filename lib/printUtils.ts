/**
 * High-Performance Isolated Printing Utility for 80mm Thermal Receipts and A4 Reports.
 * 
 * Bypasses full-window DOM recalculation by rendering an isolated, lightweight HTML payload
 * into a hidden singleton iframe. This eliminates the 5-8s latency caused by browser reflows
 * and print spooler stalls on physical USB/Network thermal and A4 printers.
 */

// Global pre-cached image object to ensure logo is decoded in GPU memory
let preloadedLogo: HTMLImageElement | null = null;

export function preloadPrintAssets(): void {
  if (typeof window === 'undefined') return;
  if (!preloadedLogo) {
    preloadedLogo = new Image();
    preloadedLogo.src = '/logo-lib-modern.jpg';
    if ('decode' in preloadedLogo) {
      preloadedLogo.decode().catch(() => {});
    }
  }
}

// Auto-preload on module load in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    preloadPrintAssets();
  } else {
    window.addEventListener('load', preloadPrintAssets, { once: true });
  }
}

interface PrintOptions {
  type: 'thermal' | 'a4';
  title?: string;
}

const BASE_RESET_CSS = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    direction: rtl;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    font-feature-settings: "liga" 1;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  img {
    max-width: 100%;
    height: auto;
    display: block;
  }
`;

const THERMAL_PRINT_CSS = `
  ${BASE_RESET_CSS}
  
  @page {
    size: 80mm auto;
    margin: 0 !important;
  }
  
  @media print {
    @page {
      size: 80mm auto;
      margin: 0 !important;
    }
    html, body {
      width: 80mm !important;
      max-width: 80mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .receipt-single-copy {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  }

  body {
    width: 72mm;
    max-width: 72mm;
    margin: 0 auto;
    padding: 2mm 1mm;
    background: #fff;
    color: #000;
    font-size: 10px;
    line-height: 1.3;
  }

  .receipt-single-copy {
    width: 100%;
    background: #ffffff;
    color: #000000;
  }

  /* Utility classes matching Tailwind receipt markup */
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .font-cairo { font-family: 'Cairo', system-ui, sans-serif; }
  .dir-rtl { direction: rtl; }
  .dir-ltr { direction: ltr; }
  
  .font-black { font-weight: 900; }
  .font-extrabold { font-weight: 800; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .font-normal { font-weight: 400; }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

  .text-base { font-size: 14px; }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 10px; }
  .text-\\[10px\\] { font-size: 10px; }
  .text-\\[9\\.5px\\] { font-size: 9.5px; }
  .text-\\[8\\.5px\\] { font-size: 8.5px; }
  .text-\\[10\\.5px\\] { font-size: 10.5px; }

  .leading-tight { line-height: 1.2; }
  
  .border { border: 1px solid #000; }
  .border-t { border-top: 1px solid #000; }
  .border-b { border-bottom: 1px solid #000; }
  .border-b-2 { border-bottom: 2px solid #000; }
  .border-t-2 { border-top: 2px solid #000; }
  .border-dashed { border-style: dashed !important; }
  .border-black { border-color: #000 !important; }
  .border-neutral-300 { border-color: #d1d5db !important; }
  .border-neutral-400 { border-color: #9ca3af !important; }

  .bg-white { background-color: #ffffff !important; }
  .bg-neutral-50 { background-color: #f9fafb !important; }
  .bg-neutral-100 { background-color: #f3f4f6 !important; }
  .text-black { color: #000000 !important; }
  .text-neutral-700 { color: #374151 !important; }
  .text-neutral-800 { color: #1f2937 !important; }

  .p-1 { padding: 4px; }
  .p-2 { padding: 8px; }
  .py-1 { padding-top: 4px; padding-bottom: 4px; }
  .py-1\\.5 { padding-top: 6px; padding-bottom: 6px; }
  .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
  .px-1 { padding-left: 4px; padding-right: 4px; }
  .px-0\\.5 { padding-left: 2px; padding-right: 2px; }
  .px-2\\.5 { padding-left: 10px; padding-right: 10px; }
  
  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }
  .mt-0\\.5 { margin-top: 2px; }
  .mt-1 { margin-top: 4px; }
  .mt-1\\.5 { margin-top: 6px; }
  .my-1\\.5 { margin-top: 6px; margin-bottom: 6px; }
  .pt-1 { padding-top: 4px; }
  .pt-1\\.5 { padding-top: 6px; }
  .pt-2 { padding-top: 8px; }

  .h-10 { height: 40px; }
  .h-6 { height: 24px; }
  .w-auto { width: auto; }
  .w-5 { width: 20px; }
  .w-8 { width: 32px; }
  .w-12 { width: 48px; }
  .w-20 { width: 80px; }
  .w-full { width: 100%; }

  .mx-auto { margin-left: auto; margin-right: auto; }
  .block { display: block; }
  .inline-block { display: inline-block; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .items-end { align-items: flex-end; }
  .space-y-1 > * + * { margin-top: 4px; }
  .rounded { border-radius: 4px; }
  .object-contain { object-fit: contain; }

  .receipt-divider {
    border-top: 1px dashed #000;
    margin: 6px 0;
  }
`;

const A4_PRINT_CSS = `
  ${BASE_RESET_CSS}

  @page {
    size: A4 portrait;
    margin: 8mm !important;
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 8mm !important;
    }
    html, body {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    tr, td, th {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .printable-supplier {
      break-inside: auto !important;
    }
  }

  body {
    width: 100%;
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-size: 12px;
    line-height: 1.4;
  }

  .printable-supplier {
    width: 100%;
    background: #ffffff;
    color: #000000;
    padding: 0;
  }

  /* Utility classes matching Tailwind A4 markup */
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .font-cairo { font-family: 'Cairo', system-ui, sans-serif; }
  .dir-rtl { direction: rtl; }
  .dir-ltr { direction: ltr; }

  .font-black { font-weight: 900; }
  .font-extrabold { font-weight: 800; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .font-normal { font-weight: 400; }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

  .text-2xl { font-size: 24px; line-height: 28px; }
  .text-lg { font-size: 18px; }
  .text-base { font-size: 16px; }
  .text-sm { font-size: 14px; }
  .text-xs { font-size: 12px; }
  .text-\\[10px\\] { font-size: 10px; }

  .border-b-2 { border-bottom: 2px solid #171717; }
  .border-t-2 { border-top: 2px solid #171717; }
  .border-y-2 { border-top: 2px solid #171717; border-bottom: 2px solid #171717; }
  .border-t { border-top: 1px solid #d1d5db; }
  .border { border: 1px solid #d1d5db; }
  .border-neutral-900 { border-color: #171717 !important; }
  .border-neutral-300 { border-color: #d1d5db !important; }

  .bg-white { background-color: #ffffff !important; }
  .bg-neutral-50 { background-color: #f9fafb !important; }
  .bg-neutral-100 { background-color: #f3f4f6 !important; }
  .text-black { color: #000000 !important; }
  .text-neutral-700 { color: #374151 !important; }
  .text-neutral-800 { color: #1f2937 !important; }
  .text-neutral-900 { color: #111827 !important; }

  .divide-y > * + * { border-top: 1px solid #d1d5db; }

  .p-1 { padding: 4px; }
  .p-2 { padding: 8px; }
  .py-2\\.5 { padding-top: 10px; padding-bottom: 10px; }
  .py-3 { padding-top: 12px; padding-bottom: 12px; }
  .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
  .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
  .px-3 { padding-left: 12px; padding-right: 12px; }
  
  .mb-6 { margin-bottom: 24px; }
  .pb-4 { padding-bottom: 16px; }
  .mt-0\\.5 { margin-top: 2px; }
  .mt-1 { margin-top: 4px; }
  .mt-12 { margin-top: 48px; }
  .pt-6 { padding-top: 24px; }

  .h-14 { height: 56px; }
  .h-10 { height: 40px; }
  .w-auto { width: auto; }
  .w-10 { width: 40px; }
  .w-28 { width: 112px; }
  .w-full { width: 100%; }

  .block { display: block; }
  .flex { display: flex; }
  .flex-wrap { flex-wrap: wrap; }
  .gap-1 { gap: 4px; }
  .gap-3\\.5 { gap: 14px; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .items-end { align-items: flex-end; }
  .shrink-0 { flex-shrink: 0; }
  .rounded { border-radius: 4px; }
  .object-contain { object-fit: contain; }
`;

/**
 * Execute isolated printing by populating an invisible iframe with the targeted HTML content.
 */
export async function printIsolated(elementOrHtml: HTMLElement | string, options: PrintOptions): Promise<void> {
  if (typeof window === 'undefined') return;

  const htmlContent = typeof elementOrHtml === 'string' ? elementOrHtml : elementOrHtml.outerHTML;
  const isThermal = options.type === 'thermal';
  const customCss = isThermal ? THERMAL_PRINT_CSS : A4_PRINT_CSS;

  // Retrieve or create singleton hidden iframe
  let iframe = document.getElementById('isolated-print-frame') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'isolated-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.margin = '0';
    iframe.style.padding = '0';
    iframe.style.visibility = 'hidden';
    iframe.style.zIndex = '-9999';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    // Graceful fallback if iframe access is restricted
    window.print();
    return;
  }

  const docHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${options.title || (isThermal ? 'Receipt' : 'Report')}</title>
        <style>${customCss}</style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  iframeDoc.open();
  iframeDoc.write(docHtml);
  iframeDoc.close();

  // Wait for images inside iframe to decode before invoking print dialog
  const images = Array.from(iframeDoc.images);
  if (images.length > 0) {
    await Promise.race([
      Promise.all(
        images.map((img) => {
          if (img.complete) {
            return 'decode' in img ? img.decode().catch(() => {}) : Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      ),
      new Promise((resolve) => setTimeout(resolve, 300)), // Safe upper bound timeout (300ms)
    ]);
  }

  // Trigger print dialog on isolated window context with microtask delay
  requestAnimationFrame(() => {
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch (err) {
      console.warn('Isolated iframe print failed, falling back to window.print():', err);
      window.print();
    }
  });
}
