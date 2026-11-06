import test from 'node:test'
import assert from 'node:assert/strict'
import { makeXlsx, spreadsheetText } from '../src/lib/xlsx.js'

function entries(bytes) {
  const result = new Map(), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let cursor = 0
  while (view.getUint32(cursor, true) === 0x04034b50) {
    const size = view.getUint32(cursor + 18, true), nameLength = view.getUint16(cursor + 26, true)
    const extra = view.getUint16(cursor + 28, true), start = cursor + 30
    const name = new TextDecoder().decode(bytes.subarray(start, start + nameLength))
    const dataStart = start + nameLength + extra
    result.set(name, new TextDecoder().decode(bytes.subarray(dataStart, dataStart + size)))
    cursor = dataStart + size
  }
  assert.equal(view.getUint32(cursor, true), 0x02014b50)
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50)
  return result
}

test('spreadsheet text neutralizes formula prefixes after whitespace and controls', () => {
  for (const value of ['=1+1', '+1', '-2', '@SUM(A1)', ' \t=1', '\r\n+1', '\u0001=1', '\u007f@x']) {
    assert.ok(spreadsheetText(value).startsWith("'"), JSON.stringify(value))
  }
  assert.equal(spreadsheetText('Tanggul Laut'), 'Tanggul Laut')
  assert.equal(spreadsheetText(null), '')
})

test('XLSX is a genuine OpenXML ZIP with metadata and non-executable inline strings', () => {
  const files = entries(makeXlsx({ title: 'Laporan & Rekap', metadata: ['Data ilustratif', 'Periode: 2026-11-06'], headers: ['Proyek', 'Progres'], rows: [[' =HYPERLINK("https://example.test")', 25], ['<proyek>', null]] }))
  assert.equal(files.size, 5)
  assert.match(files.get('[Content_Types].xml'), /spreadsheetml\.sheet\.main\+xml/)
  assert.match(files.get('xl/_rels/workbook.xml.rels'), /worksheets\/sheet1\.xml/)
  const sheet = files.get('xl/worksheets/sheet1.xml')
  assert.match(sheet, /Data ilustratif/)
  assert.match(sheet, /2026-11-06/)
  assert.match(sheet, /&apos; =HYPERLINK/)
  assert.match(sheet, /&lt;proyek&gt;/)
  assert.match(sheet, /<v>25<\/v>/)
  assert.doesNotMatch(sheet, /<f[ >]/)
})

test('empty exports and excessive worksheet dimensions fail closed', () => {
  assert.throws(() => makeXlsx({ title: 'Kosong', headers: ['Proyek'], rows: [] }), /Tidak ada data/)
  assert.throws(() => makeXlsx({ title: 'Besar', headers: Array(257).fill('x'), rows: [['x']] }), /periode/)
})
