function screenPdfName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `FloatGPT-Screen-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.pdf`;
}

function jpegToPdf(jpeg, width, height) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const image = Buffer.isBuffer(jpeg) ? jpeg : Buffer.from(jpeg);
  const content = Buffer.from(`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`, 'latin1');
  const parts = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [0];

  const add = (number, body) => {
    offsets[number] = parts.reduce((sum, part) => sum + part.length, 0);
    parts.push(Buffer.from(`${number} 0 obj\n`, 'latin1'));
    parts.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'));
    parts.push(Buffer.from('\nendobj\n', 'latin1'));
  };

  add(1, '<< /Type /Catalog /Pages 2 0 R >>');
  add(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`);
  add(4, Buffer.concat([
    Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'),
    content,
    Buffer.from('endstream', 'latin1'),
  ]));
  add(5, Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`, 'latin1'),
    image,
    Buffer.from('\nendstream', 'latin1'),
  ]));

  const xrefAt = parts.reduce((sum, part) => sum + part.length, 0);
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let number = 1; number <= 5; number += 1) {
    xref += `${String(offsets[number]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(parts);
}

module.exports = { screenPdfName, jpegToPdf };
