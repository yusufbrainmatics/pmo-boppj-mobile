import test from 'node:test';
import assert from 'node:assert/strict';
import { formalTable } from '../admin-operations.js';
import { createDemoProvider, STORAGE_KEY } from '../src/lib/demo-domain.js';
import projects from '../src/data/proyek.json' with { type: 'json' };
import contractor from '../src/data/kontraktor.json' with { type: 'json' };
import reports from '../src/data/laporan.json' with { type: 'json' };

const seed = { projects, contractor, reports, now: () => new Date('2026-11-06T14:00:00Z') };

function snapshot() {
  return {
    projects: [{ kode: 'PROYEK-A', nama: 'Proyek ilustratif A', provinsi: 'Jawa Tengah' }],
    packages: [
      { kode: 'PROYEK-A', packageId: 'paket-1', nama: 'Paket pertama', kontraktor: 'PT Penanggung Jawab Pertama' },
      { kode: 'PROYEK-A', packageId: 'paket-2', nama: 'Paket kedua', kontraktor: null },
    ],
    reports: [
      { kode: 'PROYEK-A', packageId: 'paket-1', reportId: 'laporan-1', tanggal: '2026-11-06', version: 1, createdBy: 'akun-pelapor-1' },
      { kode: 'PROYEK-A', packageId: 'paket-2', reportId: 'laporan-2', tanggal: '2026-11-06', version: 1, createdBy: 'akun-pelapor-2' },
    ],
    progress: {},
  };
}

test('sample companies are stable package metadata, not new account assignments', () => {
  const first = createDemoProvider(seed).getPackages();
  const second = createDemoProvider({ ...seed, projects: [...projects].reverse() }).getPackages();
  for (const pkg of first) {
    assert.ok(pkg.kontraktor);
    assert.doesNotMatch(pkg.kontraktor, /ilustratif/i);
    assert.equal(second.find((row) => row.packageId === pkg.packageId).kontraktor, pkg.kontraktor);
    if (pkg.contractorId === 'contractor-demo') {
      assert.equal(pkg.kontraktor, contractor.pengguna.perusahaan);
    } else {
      assert.equal(pkg.contractorId, null);
      assert.ok(contractor.perusahaanContoh.includes(pkg.kontraktor));
    }
  }
  assert.ok(new Set(first.filter((pkg) => pkg.contractorId === null).map((pkg) => pkg.kontraktor)).size > 1);
});

test('old sessions receive missing company metadata without replacing reports or saved companies', () => {
  const original = createDemoProvider(seed).getState();
  const assigned = original.packages.find((pkg) => pkg.contractorId === 'contractor-demo');
  assigned.kontraktor = 'PT Perusahaan Tersimpan';
  original.packages.filter((pkg) => pkg.contractorId === null).forEach((pkg) => { pkg.kontraktor = null; });
  const serialized = JSON.stringify(original);
  const storage = { getItem: (key) => key === STORAGE_KEY ? serialized : null };
  const restored = createDemoProvider({ ...seed, storage });
  assert.equal(restored.getState().persistence.status, 'ready');
  assert.deepEqual(restored.getState().reports, original.reports);
  assert.equal(restored.getPackages().find((pkg) => pkg.packageId === assigned.packageId).kontraktor, assigned.kontraktor);
  assert.ok(restored.getPackages().every((pkg) => pkg.kontraktor));
  assert.deepEqual(restored.getPackages().map((pkg) => pkg.contractorId), original.packages.map((pkg) => pkg.contractorId));
});

for (const kind of ['implementation', 'progress']) {
  test(`${kind} separates project identity, company and report authorship`, () => {
    const table = formalTable(snapshot(), kind);
    const column = (name) => table.rows.map((row) => row[table.headers.indexOf(name)]);
    assert.equal(new Set(table.headers).size, table.headers.length);
    assert.deepEqual(column('Kode proyek'), ['PROYEK-A', 'PROYEK-A']);
    assert.deepEqual(column('Proyek'), ['Proyek ilustratif A', 'Proyek ilustratif A']);
    assert.deepEqual(column('Paket'), ['Paket pertama', 'Paket kedua']);
    assert.deepEqual(column('Perusahaan penanggung jawab'), ['PT Penanggung Jawab Pertama', 'Tidak tersedia']);
    assert.equal(table.headers.includes('Pelapor'), false);
    assert.ok(table.rows.every((row) => row.length === table.headers.length));
    if (kind === 'implementation') {
      assert.deepEqual(column('Pembuat laporan'), ['akun-pelapor-1', 'akun-pelapor-2']);
    }
  });
}
