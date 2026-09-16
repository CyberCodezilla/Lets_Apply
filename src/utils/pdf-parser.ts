import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker - use bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface RawPdfItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

interface ProcessedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL: boolean;
}

/**
 * Extract all text content from a PDF file preserving reading order and layout.
 * Uses pdfjs-dist for client-side parsing — no server required.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rawItems = textContent.items as RawPdfItem[];

    // Filter valid text items
    const validItems: ProcessedItem[] = [];
    for (const item of rawItems) {
      if (typeof item.str === 'string' && item.str.length > 0) {
        const transform = Array.isArray(item.transform) && item.transform.length >= 6 ? item.transform : null;
        validItems.push({
          str: item.str.replace(/\u00A0/g, ' '),
          x: transform && typeof transform[4] === 'number' ? transform[4] : 0,
          y: transform && typeof transform[5] === 'number' ? transform[5] : 0,
          width: item.width || 0,
          height: item.height || 0,
          hasEOL: Boolean(item.hasEOL),
        });
      }
    }

    if (validItems.length === 0) continue;

    // Check if coordinates are available for sorting
    const hasCoordinates = validItems.some((i) => i.x !== 0 || i.y !== 0);

    let pageOutput = '';

    if (hasCoordinates) {
      // Sort reading order: Top-to-bottom (Y descending in PDF space), Left-to-right (X ascending)
      const LINE_Y_TOLERANCE = 3.5;
      validItems.sort((a, b) => {
        const yDiff = Math.abs(a.y - b.y);
        if (yDiff <= LINE_Y_TOLERANCE) {
          return a.x - b.x;
        }
        return b.y - a.y; // Higher Y first (top of page)
      });

      let lastX = 0;
      let lastY: number | null = null;
      let lastWidth = 0;
      let lastHasEOL = false;

      for (const item of validItems) {
        if (lastY === null) {
          pageOutput += item.str;
        } else {
          const deltaY = lastY - item.y; // positive if moving downwards
          const sameLine = Math.abs(deltaY) <= LINE_Y_TOLERANCE;

          if (lastHasEOL || (!sameLine && deltaY > LINE_Y_TOLERANCE)) {
            // New line or paragraph break
            if (deltaY > 14) {
              // Larger vertical jump indicates a distinct section or paragraph
              pageOutput += '\n\n' + item.str;
            } else {
              pageOutput += '\n' + item.str;
            }
          } else if (sameLine) {
            // Same line: check horizontal gap
            const gapX = item.x - (lastX + lastWidth);
            const needsSpace =
              gapX > 2.0 &&
              !pageOutput.endsWith(' ') &&
              !pageOutput.endsWith('\n') &&
              !item.str.startsWith(' ');

            if (needsSpace) {
              pageOutput += ' ' + item.str;
            } else {
              pageOutput += item.str;
            }
          } else {
            // Fallback for unexpected coordinate shifts
            pageOutput += ' ' + item.str;
          }
        }

        lastX = item.x;
        lastY = item.y;
        lastWidth = item.width;
        lastHasEOL = item.hasEOL;
      }
    } else {
      // Fallback if PDF has no transform coordinates
      pageOutput = validItems
        .map((i) => i.str + (i.hasEOL ? '\n' : ' '))
        .join('')
        .trim();
    }

    // Clean up excessive newlines and trailing whitespace per line
    const cleanedPage = pageOutput
      .split('\n')
      .map((line) => line.trim())
      .filter((line, idx, arr) => {
        // Remove multiple consecutive blank lines
        if (line === '' && arr[idx - 1] === '') return false;
        return true;
      })
      .join('\n')
      .trim();

    if (cleanedPage) {
      pageTexts.push(cleanedPage);
    }
  }

  // Combine pages with clear page separation
  return pageTexts.join('\n\n--- Page Break ---\n\n');
}
