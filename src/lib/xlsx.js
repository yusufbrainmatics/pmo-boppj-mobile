const encoder = new TextEncoder()

export function spreadsheetText(value) {
  const text = String(value ?? '').toWellFormed().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
  return /^[\s\u007f]*[=+\-@]/u.test(text) ? `'${text}` : text
}

const xml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char])

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function header(size, fields) {
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  for (const [offset, value, width] of fields) {
    if (width === 4) view.setUint32(offset, value, true)
    else view.setUint16(offset, value, true)
  }
  return bytes
}

function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}

// Stored ZIP entries keep these small fixture exports dependency-free and readable by Excel.
function zip(files) {
  const entries = [], directory = []
  let offset = 0, directorySize = 0
  for (const [path, content] of Object.entries(files)) {
    const name = encoder.encode(path), data = encoder.encode(content), crc = crc32(data)
    const local = header(30, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [12, 33, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2]])
    const central = header(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [14, 33, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, offset, 4]])
    entries.push(local, name, data)
    directory.push(central, name)
    offset += local.length + name.length + data.length
    directorySize += central.length + name.length
  }
  const count = Object.keys(files).length
  return concat([...entries, ...directory, header(22, [[0, 0x06054b50, 4], [8, count, 2], [10, count, 2], [12, directorySize, 4], [16, offset, 4]])])
}

function column(index) {
  let result = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result
  return result
}

export function makeXlsx({ title, metadata = [], headers, rows }) {
  if (!Array.isArray(headers) || !headers.length || !Array.isArray(rows) || !rows.length) throw new Error('Tidak ada data untuk diekspor.')
  if (rows.length > 100000 || headers.length > 256) throw new Error('Bagi ekspor menjadi periode yang lebih kecil.')
  const values = [[title], ...metadata.map((line) => [line]), [], headers, ...rows]
  const sheet = values.map((cells, index) => `<row r="${index + 1}">${cells.map((value, cell) => {
    const ref = `${column(cell)}${index + 1}`
    return typeof value === 'number' && Number.isFinite(value)
      ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(spreadsheetText(value))}</t></is></c>`
  }).join('')}</row>`).join('')
  const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  return zip({
    '[Content_Types].xml': `${prefix}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `${prefix}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${prefix}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Laporan" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${prefix}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `${prefix}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`,
  })
}
