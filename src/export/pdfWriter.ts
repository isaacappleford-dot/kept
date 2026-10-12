/**
 * A tiny PDF writer: Helvetica text, lines and JPEG images. Enough for a
 * receipt sheet or an inventory list, without shipping a PDF library.
 * Coordinates are in points with the origin at the top-left.
 */

export type PdfOp =
  | { t: 'text'; x: number; y: number; size: number; text: string; bold?: boolean; color?: [number, number, number] }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; width?: number; gray?: number }
  | { t: 'image'; x: number; y: number; w: number; h: number; jpeg: Uint8Array; pxW: number; pxH: number };

export interface PdfPage {
  ops: PdfOp[];
}

export const A4 = { w: 595.28, h: 841.89 };
export const LETTER = { w: 612, h: 792 };

/** PDF string literal in WinAnsi (Latin-1-ish); unsupported characters become '?'. */
export function pdfString(s: string): string {
  const map: Record<string, number> = { '€': 0x80, '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '…': 0x85, '•': 0x95 };
  let out = '(';
  for (const ch of s) {
    let code = ch.codePointAt(0)!;
    if (map[ch] !== undefined) code = map[ch];
    else if (code > 0xff || (code >= 0x80 && code < 0xa0)) code = 0x3f;
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return `${out})`;
}

/** Rough Helvetica width, good enough for wrapping and truncation. */
export function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) {
    if ('il.,:;|!\'’'.includes(ch)) w += 0.28;
    else if ('mwMW@'.includes(ch)) w += 0.85;
    else if (ch === ' ') w += 0.28;
    else if (/[A-Z0-9$%&]/.test(ch)) w += 0.66;
    else w += 0.52;
  }
  return w * size * (bold ? 1.06 : 1);
}

export function wrapText(s: string, size: number, maxWidth: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, bold) <= maxWidth || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();

export function buildPdf(pages: PdfPage[], size = LETTER, title = 'Document'): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? latin1(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const objects: Array<() => void> = [];
  // Object ids are 1-based positions in `objects`; bodies are filled in by define().
  const alloc = () => objects.push(() => {});
  const define = (id: number, body: () => void) => {
    objects[id - 1] = () => {
      offsets[id] = length;
      write(`${id} 0 obj\n`);
      body();
      write('\nendobj\n');
    };
  };

  const catalogId = alloc();
  const pagesId = alloc();
  const fontId = alloc();
  const boldId = alloc();
  const infoId = alloc();
  define(fontId, () => write('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  define(boldId, () => write('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  define(infoId, () => write(`<< /Title ${pdfString(title)} /Producer (Kept) >>`));

  const pageIds: number[] = [];
  for (const page of pages) {
    const pageId = alloc();
    const contentId = alloc();
    pageIds.push(pageId);
    const images: Array<{ name: string; id: number; op: Extract<PdfOp, { t: 'image' }> }> = [];
    let content = '';
    for (const op of page.ops) {
      if (op.t === 'text') {
        const [r, g, b] = op.color ?? [0, 0, 0];
        content += `BT ${n(r)} ${n(g)} ${n(b)} rg /${op.bold ? 'F2' : 'F1'} ${n(op.size)} Tf ${n(op.x)} ${n(size.h - op.y)} Td ${pdfString(op.text)} Tj ET\n`;
      } else if (op.t === 'line') {
        content += `${n(op.gray ?? 0.8)} G ${n(op.width ?? 0.5)} w ${n(op.x1)} ${n(size.h - op.y1)} m ${n(op.x2)} ${n(size.h - op.y2)} l S\n`;
      } else {
        const id = alloc();
        const name = `Im${images.length + 1}`;
        images.push({ name, id, op });
        content += `q ${n(op.w)} 0 0 ${n(op.h)} ${n(op.x)} ${n(size.h - op.y - op.h)} cm /${name} Do Q\n`;
      }
    }
    for (const im of images) {
      define(im.id, () => {
        write(`<< /Type /XObject /Subtype /Image /Width ${im.op.pxW} /Height ${im.op.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.op.jpeg.length} >>\nstream\n`);
        write(im.op.jpeg);
        write('\nendstream');
      });
    }
    const contentBytes = enc.encode(content);
    define(contentId, () => {
      write(`<< /Length ${contentBytes.length} >>\nstream\n`);
      write(contentBytes);
      write('\nendstream');
    });
    const xobjects = images.map((im) => `/${im.name} ${im.id} 0 R`).join(' ');
    define(pageId, () =>
      write(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(size.w)} ${n(size.h)}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >>${xobjects ? ` /XObject << ${xobjects} >>` : ''} >> >>`,
      ),
    );
  }
  define(pagesId, () => write(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`));
  define(catalogId, () => write(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));

  write('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  objects.forEach((emit) => emit());
  const xref = length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  write(table);
  write(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
