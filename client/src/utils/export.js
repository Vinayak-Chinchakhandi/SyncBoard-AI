/**
 * export.js — Canvas export utilities
 */

/**
 * Export canvas content as PNG download
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
export function exportAsPNG(canvas, filename = 'syncboard-export') {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${filename}-${Date.now()}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get canvas as base64 data URL
 * @param {HTMLCanvasElement} canvas
 * @returns {string} base64 PNG data URL
 */
export function getCanvasDataURL(canvas) {
  return canvas.toDataURL('image/png');
}

/**
 * Export as SVG (outline only — best-effort)
 * For a proper SVG export, we'd need a separate SVG canvas layer.
 * This creates a simple wrapper that embeds the PNG in an SVG.
 */
export function exportAsSVG(canvas, filename = 'syncboard-export') {
  const dataURL = getCanvasDataURL(canvas);
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${canvas.width}" height="${canvas.height}">
  <image href="${dataURL}" width="${canvas.width}" height="${canvas.height}"/>
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${filename}-${Date.now()}.svg`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy canvas content to clipboard
 */
export async function copyToClipboard(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 'image/png');
  });
}
