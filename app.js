const p = [
    ["NCICD-A-03", 62, "green"],
    ["NCICD-A-01", 55, "green"],
    ["NCICD-A-02", 48, "green"],
    ["TOL-SMD-01", 30, "orange"],
    ["GSW-13", 25, "blue"],
    ["GSW-12", 22, "blue"],
    ["TOL-SMD-02", 20, "orange"],
    ["GSW-03", 18, "blue"],
    ["GSW-04", 15, "blue"],
    ["GSW-02", 12, "blue"],
    ["GSW-11", 12, "blue"],
    ["GSW-01", 10, "blue"],
    ["GSW-10", 10, "blue"],
    ["TOL-SMD-03", 10, "orange"],
    ["GSW-05", 8, "blue"],
    ["GSW-06", 6, "blue"],
    ["GSW-07", 5, "blue"],
    ["GSW-08", 5, "blue"],
    ["NCICD-B-01", 5, "green"],
    ["GSW-09", 4, "blue"],
    ["GSW-14", 3, "blue"],
    ["GSW-15", 3, "blue"],
  ],
  names = {
    GSW: "Tanggul Laut Pantura (GSW)",
    NCICD: "NCICD",
    TOL: "Integrasi Tol Semarang-Demak",
  };
document.querySelector("#project-bars").innerHTML = p
  .map(
    (x) =>
      `<div><label>${x[0]}</label><i class="${x[2]}" style="width:${x[1]}%"></i><b>${x[1]}%</b></div>`,
  )
  .join("");
document.querySelector("#projects-body").innerHTML = p
  .map((x, i) => {
    let g = x[0].startsWith("NCICD")
      ? "NCICD"
      : x[0].startsWith("TOL")
        ? "TOL"
        : "GSW";
    return `<tr><td>${x[0]}</td><td>${g === "NCICD" ? "Tanggul Pantai NCICD Fase A" : g === "TOL" ? "Integrasi Tol Semarang-Demak" : "Tanggul Pesisir Pantura Jawa"}</td><td>${names[g]}</td><td>${g === "NCICD" ? "DKI Jakarta" : "Jawa Tengah"}</td><td>${x[1] >= 48 ? "Konstruksi" : x[1] >= 20 ? "Pra-Konstruksi" : "Asesmen"}</td><td>${x[1]}</td></tr>`;
  })
  .join("");
const m = document.querySelectorAll(".menu-item"),
  pg = document.querySelectorAll(".page");
m.forEach(
  (a) =>
    (a.onclick = () => {
      m.forEach((x) => x.classList.toggle("active", x === a));
      pg.forEach((x) => x.classList.toggle("active", x.id === a.dataset.page));
    }),
);
const mapCanvas = document.querySelector(".map-canvas");
if (mapCanvas) {
  const pantura = [
    ["GSW-01", 18, 63, "green"],
    ["GSW-02", 20, 64, "green"],
    ["GSW-03", 22, 64, "blue"],
    ["GSW-04", 24, 64, "blue"],
    ["GSW-05", 27, 65, "green"],
    ["GSW-06", 29, 65, "blue"],
    ["GSW-07", 31, 65, "blue"],
    ["GSW-08", 33, 65, "blue"],
    ["GSW-09", 35, 65, "blue"],
    ["GSW-10", 37, 66, "amber"],
    ["GSW-11", 39, 66, "amber"],
    ["GSW-12", 41, 66, "blue"],
    ["GSW-13", 43, 66, "red"],
    ["GSW-14", 45, 67, "blue"],
    ["GSW-15", 47, 67, "blue"],
    ["NCICD-A-01", 23, 63, "green"],
    ["NCICD-A-02", 24, 63, "green"],
    ["NCICD-A-03", 25, 63, "green"],
  ];
  mapCanvas.insertAdjacentHTML(
    "beforeend",
    `<div class="pantura-markers">${pantura.map(([n, x, y, s]) => `<button class="pantura-marker ${s}" style="left:${x}%;top:${y}%" title="${n}">${n.replace(/.*-/, "")}</button>`).join("")}</div><div class="marker-legend"><b>Status proyek</b><span class="green">Hijau</span><span class="amber">Kuning</span><span class="red">Merah</span></div>`,
  );
}
(() => {
  const page = document.querySelector("#projects");
  if (!page) return;
  let rows = [
    [
      "PRJ-001",
      "Kawasan Pesisir Marunda",
      "Pembangunan Kawasan",
      "Jakarta Utara",
      "PT Pesisir Jaya",
      12,
      68,
      "Berjalan",
    ],
    [
      "GSW-013",
      "Giant Sea Wall Timbulsloko",
      "Giant Sea Wall",
      "Demak",
      "PT Konstruksi Pantura",
      18,
      42,
      "Berjalan",
    ],
    [
      "PRJ-003",
      "Perbaikan Jalan Akses Pelabuhan",
      "Perbaikan Jalan",
      "Cirebon",
      "Dinas PUPR",
      8,
      100,
      "Selesai",
    ],
    [
      "PRJ-004",
      "Revitalisasi Tambak Nelayan",
      "Pembangunan Kawasan",
      "Indramayu",
      "Pemkab Indramayu",
      6,
      25,
      "Persiapan",
    ],
    [
      "GSW-008",
      "Tanggul Pesisir Losari",
      "Giant Sea Wall",
      "Cirebon",
      "PT Laut Indonesia",
      10,
      55,
      "Berjalan",
    ],
    [
      "PRJ-006",
      "Jalan Lingkar Pesisir",
      "Perbaikan Jalan",
      "Pekalongan",
      "Dinas PUPR",
      14,
      35,
      "Berjalan",
    ],
    [
      "PRJ-007",
      "Kawasan Ekonomi Pesisir",
      "Pembangunan Kawasan",
      "Rembang",
      "BOPPJ",
      9,
      15,
      "Persiapan",
    ],
    [
      "GSW-015",
      "Tanggul Pesisir Tuban",
      "Giant Sea Wall",
      "Tuban",
      "PT Karya Bahari",
      11,
      100,
      "Selesai",
    ],
  ];
  let current = 1,
    step = 1,
    editing = null;
  page.innerHTML = `<div class="project-head"><div><h1>Data Proyek</h1><p>Kelola portofolio proyek pembangunan Pantai Utara Jawa.</p></div><button class="p-primary" id="add-project">＋ Tambah Proyek</button></div><div class="project-stats"><article><span>▦</span><p>Total Proyek<b id="stat-total">8</b></p></article><article><span>◷</span><p>Proyek Berjalan<b id="stat-active">4</b></p></article><article><span>✓</span><p>Proyek Selesai<b id="stat-done">2</b></p></article><article><span>◌</span><p>Dalam Persiapan<b id="stat-prep">2</b></p></article></div><section class="project-card"><header><div><h2>Daftar Proyek</h2><p>Portofolio proyek aktif dan terencana</p></div><button class="p-outline" id="export-project">⇩ Export</button></header><div class="project-filters"><input id="project-search" placeholder="Cari nama atau kode proyek"><select id="type-filter"><option value="">Semua jenis pembangunan</option><option>Giant Sea Wall</option><option>Pembangunan Kawasan</option><option>Perbaikan Jalan</option></select><select id="region-filter"><option value="">Semua wilayah</option><option>Demak</option><option>Cirebon</option><option>Jakarta Utara</option></select><select id="status-filter"><option value="">Semua status</option><option>Berjalan</option><option>Selesai</option><option>Persiapan</option></select></div><div class="project-table-wrap"><table class="project-data"><thead><tr><th>Kode Proyek</th><th>Nama Proyek</th><th>Jenis Pembangunan</th><th>Wilayah</th><th>Instansi/Pelaksana</th><th>Jumlah Titik</th><th>Progres</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="project-list"></tbody></table></div><footer class="project-pagination"><span id="page-label"></span><div><button id="prev-page">‹</button><button class="active">1</button><button id="next-page">›</button></div></footer></section><div class="p-modal" id="project-modal"><div class="p-dialog"><button class="p-close" data-close>×</button><h2 id="modal-title">Tambah Proyek</h2><div class="p-steps"><span class="active">1<small>Informasi</small></span><i></i><span>2<small>Lokasi & Segmen</small></span><i></i><span>3<small>Rincian Kerja</small></span><i></i><span>4<small>Penugasan</small></span></div><form id="project-form"><div class="p-step" data-step="1"><div class="p-grid"><label>Kode proyek*<input name="code" required></label><label>Nama proyek*<input name="name" required></label><label>Jenis pembangunan*<select name="type" required><option value="">Pilih jenis</option><option>Giant Sea Wall</option><option>Pembangunan Kawasan</option><option>Perbaikan Jalan</option></select></label><label>Instansi penanggung jawab*<input name="agency" required></label><label>Wilayah*<input name="region" required></label><label>Status*<select name="status" required><option>Persiapan</option><option>Berjalan</option><option>Selesai</option></select></label><label class="wide">Alamat<textarea name="address"></textarea></label><label class="wide">Deskripsi<textarea name="description"></textarea></label><label>Nilai proyek<input type="number" name="value"></label><label>Luas lahan (opsional)<input type="number" name="land"></label><label>Tanggal mulai<input type="date" name="start"></label><label>Target selesai<input type="date" name="end"></label></div></div><div class="p-step" data-step="2" hidden><div class="p-grid"><label>Nama titik/segmen<input id="loc-name"></label><label>Tipe lokasi<select id="loc-type"><option>Titik</option><option>Garis</option><option>Area</option></select></label><label>Latitude<input id="loc-lat" placeholder="-6.123"></label><label>Longitude<input id="loc-lng" placeholder="110.456"></label></div><button type="button" class="p-outline" id="add-location">＋ Tambah Lokasi</button><div class="location-placeholder">Pilih lokasi melalui peta<br><small>Area peta prototype</small></div><ul id="location-list"></ul></div><div class="p-step" data-step="3" hidden><label>Template KAK/WBS<select><option>Template Giant Sea Wall</option><option>Template Jalan</option><option>Template Kawasan</option></select></label><div class="work-list"><b>Rincian pekerjaan</b><div>▾ Persiapan pekerjaan <span>LS · 10% · 14 hari</span></div><div>　▸ Mobilisasi peralatan <span>LS · 5% · 7 hari</span></div><div>▾ Pekerjaan konstruksi <span>m³ · 70% · 180 hari</span></div><div>　▸ Dokumentasi dan pelaporan <span>LS · 20% · 30 hari</span></div></div></div><div class="p-step" data-step="4" hidden><div class="p-grid"><label>Pilih petugas<select><option>Andi Pratama</option><option>Siti Rahma</option><option>Budi Santoso</option></select></label><label>Peran<select><option>PIC</option><option>Pelapor</option><option>Verifikator</option></select></label><label class="wide">Cakupan akses<select><option>Seluruh proyek</option><option>Segmen tertentu</option></select></label></div><div class="assigned">Andi Pratama <span>PIC · Seluruh proyek</span></div></div><div class="p-actions"><button type="button" class="p-outline" id="previous">Sebelumnya</button><button type="button" class="p-primary" id="next">Selanjutnya</button><button type="submit" class="p-primary" id="save-project" hidden>Simpan Proyek</button></div></form></div></div><div class="p-modal" id="detail-modal"><div class="p-dialog detail"><button class="p-close" data-close>×</button><h2 id="detail-name"></h2><p id="detail-code"></p><div class="detail-tabs"><button class="active">Ringkasan</button><button>Lokasi & Segmen</button><button>Rincian Pekerjaan</button><button>Penugasan Petugas</button><button>Progres</button><button>Dokumentasi</button></div><div id="detail-body"></div></div></div><div class="p-toast" id="p-toast"></div>`;
  const notify = (t) => {
    let x = document.querySelector("#p-toast");
    x.textContent = t;
    x.classList.add("show");
    setTimeout(() => x.classList.remove("show"), 2400);
  };
  function render() {
    let q = document.querySelector("#project-search").value.toLowerCase(),
      t = document.querySelector("#type-filter").value,
      r = document.querySelector("#region-filter").value,
      s = document.querySelector("#status-filter").value,
      filtered = rows.filter(
        (x) =>
          (x[0] + x[1]).toLowerCase().includes(q) &&
          (!t || x[2] == t) &&
          (!r || x[3] == r) &&
          (!s || x[7] == s),
      ),
      cut = filtered.slice((current - 1) * 5, current * 5);
    document.querySelector("#project-list").innerHTML = cut
      .map(
        (x) =>
          `<tr><td><b>${x[0]}</b></td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td>${x[5]}</td><td><div class="progress"><i style="width:${x[6]}%"></i></div><small>${x[6]}%</small></td><td><span class="badge ${x[7].toLowerCase()}">${x[7]}</span></td><td><button class="action" data-code="${x[0]}">•••</button></td></tr>`,
      )
      .join("");
    document.querySelector("#page-label").textContent =
      `Menampilkan ${cut.length} dari ${filtered.length} proyek`;
    document.querySelector("#stat-total").textContent = rows.length;
    document.querySelector("#stat-active").textContent = rows.filter(
      (x) => x[7] == "Berjalan",
    ).length;
    document.querySelector("#stat-done").textContent = rows.filter(
      (x) => x[7] == "Selesai",
    ).length;
    document.querySelector("#stat-prep").textContent = rows.filter(
      (x) => x[7] == "Persiapan",
    ).length;
  }
  render();
  ["project-search", "type-filter", "region-filter", "status-filter"].forEach(
    (id) =>
      (document.querySelector("#" + id).oninput = () => {
        current = 1;
        render();
      }),
  );
  document.querySelector("#prev-page").onclick = () => {
    current = Math.max(1, current - 1);
    render();
  };
  document.querySelector("#next-page").onclick = () => {
    current++;
    render();
  };
  const modal = document.querySelector("#project-modal");
  document.querySelector("#add-project").onclick = () => {
    editing = null;
    document.querySelector("#project-form").reset();
    step = 1;
    showStep();
    modal.classList.add("open");
  };
  function showStep() {
    document
      .querySelectorAll(".p-step")
      .forEach((e) => (e.hidden = +e.dataset.step !== step));
    document
      .querySelectorAll(".p-steps span")
      .forEach((e, i) => e.classList.toggle("active", i < step));
    document.querySelector("#previous").style.visibility =
      step === 1 ? "hidden" : "visible";
    document.querySelector("#next").hidden = step === 4;
    document.querySelector("#save-project").hidden = step !== 4;
  }
  document.querySelector("#next").onclick = () => {
    let required = [
      ...document
        .querySelector(`.p-step[data-step="${step}"]`)
        .querySelectorAll("[required]"),
    ];
    if (required.some((e) => !e.value)) {
      notify("Lengkapi isian wajib terlebih dahulu.");
      return;
    }
    step++;
    showStep();
  };
  document.querySelector("#previous").onclick = () => {
    step--;
    showStep();
  };
  document.querySelector("#add-location").onclick = () => {
    let n = document.querySelector("#loc-name").value;
    if (!n) return notify("Masukkan nama titik atau segmen.");
    document
      .querySelector("#location-list")
      .insertAdjacentHTML(
        "beforeend",
        `<li>${n} · ${document.querySelector("#loc-type").value}</li>`,
      );
    document.querySelector("#loc-name").value = "";
  };
  document.querySelector("#project-form").onsubmit = (e) => {
    e.preventDefault();
    let f = new FormData(e.target),
      newRow = [
        f.get("code"),
        f.get("name"),
        f.get("type"),
        f.get("region"),
        f.get("agency"),
        1,
        0,
        f.get("status"),
      ];
    if (editing) {
      rows[rows.findIndex((x) => x[0] === editing)] = newRow;
    } else rows.unshift(newRow);
    modal.classList.remove("open");
    render();
    notify(
      editing
        ? "Proyek berhasil diperbarui."
        : "Proyek baru berhasil ditambahkan.",
    );
  };
  document.addEventListener("click", (e) => {
    if (e.target.dataset.close)
      e.target.closest(".p-modal").classList.remove("open");
    if (e.target.classList.contains("action")) {
      let x = rows.find((x) => x[0] === e.target.dataset.code);
      if (confirm(`OK = Detail, Cancel = Hapus proyek ${x[0]}`)) {
        document.querySelector("#detail-name").textContent = x[1];
        document.querySelector("#detail-code").textContent =
          x[0] + " · " + x[2];
        document.querySelector("#detail-body").innerHTML =
          `<div class="detail-grid"><b>Wilayah</b><span>${x[3]}</span><b>Pelaksana</b><span>${x[4]}</span><b>Jumlah titik</b><span>${x[5]}</span><b>Progres</b><span>${x[6]}%</span></div>`;
        document.querySelector("#detail-modal").classList.add("open");
      } else if (confirm(`Hapus proyek ${x[0]}?`)) {
        rows = rows.filter((r) => r !== x);
        render();
        notify("Proyek dihapus.");
      }
    }
  });
  document.querySelector("#export-project").onclick = () =>
    notify("File export proyek sedang disiapkan.");
})();
document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) {
    closeButton.closest(".p-modal")?.classList.remove("open");
    return;
  }
  if (event.target.classList.contains("p-modal"))
    event.target.classList.remove("open");
});
(() => {
  const page = document.querySelector("#regions");
  if (!page) return;
  let regions = [
    ["WIL-01", "DKI Jakarta", "Provinsi", "—", 3, "Aktif"],
    ["WIL-02", "Jawa Barat", "Provinsi", "—", 4, "Aktif"],
    ["WIL-03", "Jawa Tengah", "Provinsi", "—", 5, "Aktif"],
    ["WIL-04", "Banten", "Provinsi", "—", 2, "Aktif"],
    ["WIL-05", "Jawa Timur", "Provinsi", "—", 2, "Aktif"],
    ["WIL-11", "Jakarta Utara", "Kota Administrasi", "DKI Jakarta", 2, "Aktif"],
    ["WIL-21", "Kota Bekasi", "Kota", "Jawa Barat", 1, "Aktif"],
    ["WIL-22", "Kabupaten Bekasi", "Kabupaten", "Jawa Barat", 2, "Aktif"],
    ["WIL-23", "Kabupaten Karawang", "Kabupaten", "Jawa Barat", 1, "Aktif"],
    ["WIL-31", "Kota Semarang", "Kota", "Jawa Tengah", 2, "Aktif"],
    [
      "WIL-311",
      "Kecamatan Tarumajaya",
      "Kecamatan",
      "Kabupaten Bekasi",
      1,
      "Aktif",
    ],
    ["WIL-312", "Desa Segarajaya", "Desa", "Kecamatan Tarumajaya", 1, "Aktif"],
  ];
  let pageNo = 1,
    editing = null;
  page.innerHTML = `<div class="region-head"><div><h1>Data Wilayah</h1><p>Kelola data wilayah administratif sebagai referensi lokasi pembangunan dan monitoring proyek BOPPJ.</p></div></div><div class="region-stats"><article><span>⌖</span><p>Total Provinsi<b id="r-prov">5</b></p></article><article><span>▦</span><p>Total Kabupaten/Kota<b id="r-city">5</b></p></article><article><span>⌘</span><p>Total Kecamatan<b id="r-district">1</b></p></article><article><span>▤</span><p>Wilayah Terkait Proyek<b id="r-linked">10</b></p></article></div><section class="region-card"><header><div><h2>Daftar Wilayah Administratif</h2><p>Master data administratif wilayah cakupan BOPPJ</p></div><div class="region-tools"><button class="p-primary" id="add-region">＋ Tambah Wilayah</button><button class="p-outline" id="import-region">⇧ Import Data</button><button class="p-outline" id="export-region">⇩ Export Data</button></div></header><div class="region-tabs"><button class="active" data-view="table">▤ Tampilan Tabel</button><button data-view="tree">⌘ Tampilan Hierarki</button></div><div class="region-filters"><input id="region-search" placeholder="Cari nama atau kode wilayah"><select id="province-filter"><option value="">Semua provinsi</option><option>DKI Jakarta</option><option>Jawa Barat</option><option>Jawa Tengah</option><option>Banten</option><option>Jawa Timur</option></select><select id="level-filter"><option value="">Semua tingkat wilayah</option><option>Provinsi</option><option>Kabupaten</option><option>Kota</option><option>Kota Administrasi</option><option>Kecamatan</option><option>Desa</option></select><select id="rstatus-filter"><option value="">Semua status</option><option>Aktif</option><option>Nonaktif</option></select><button class="p-outline" id="reset-region">Reset Filter</button></div><div id="region-table-view"><div class="region-table-wrap"><table class="region-data"><thead><tr><th>Kode Wilayah</th><th>Nama Wilayah</th><th>Tingkat Wilayah</th><th>Induk Wilayah</th><th>Jumlah Proyek</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="region-list"></tbody></table></div><footer class="region-pagination"><span id="region-page-label"></span><div><button id="r-prev">‹</button><button class="active">1</button><button id="r-next">›</button></div></footer></div><div id="region-tree-view" hidden><div class="tree-note">Klik nama wilayah untuk memperluas atau menutup subwilayah.</div><div id="region-tree" class="region-tree"></div></div></section><div class="p-modal" id="region-modal"><div class="p-dialog region-dialog"><button class="p-close" data-close>×</button><h2 id="region-modal-title">Tambah Wilayah</h2><p class="modal-copy">Lengkapi data administratif wilayah.</p><form id="region-form"><div class="p-grid"><label>Kode Wilayah*<input name="code" required placeholder="Contoh: WIL-41"></label><label>Nama Wilayah*<input name="name" required></label><label>Tingkat Wilayah*<select name="level" id="region-level" required><option value="">Pilih tingkat</option><option>Provinsi</option><option>Kabupaten</option><option>Kota</option><option>Kota Administrasi</option><option>Kecamatan</option><option>Kelurahan</option><option>Desa</option></select></label><label>Induk Wilayah<span id="parent-required">*</span><select name="parent" id="region-parent"><option value="">Pilih induk wilayah</option></select></label><label>Status*<select name="status"><option>Aktif</option><option>Nonaktif</option></select></label><label class="wide">Keterangan<textarea name="note" placeholder="Keterangan opsional"></textarea></label></div><div class="p-actions"><button type="button" class="p-outline" data-close>Batal</button><button class="p-primary" type="submit">Simpan Wilayah</button></div></form></div></div><div class="p-modal" id="region-detail"><div class="p-dialog detail"><button class="p-close" data-close>×</button><h2 id="rd-name"></h2><p id="rd-breadcrumb" class="modal-copy"></p><div id="rd-body"></div></div></div><div class="p-toast" id="r-toast"></div>`;
  const toast = (x) => {
    let e = document.querySelector("#r-toast");
    e.textContent = x;
    e.classList.add("show");
    setTimeout(() => e.classList.remove("show"), 2200);
  };
  const typeParent = {
    Kabupaten: ["Provinsi"],
    Kota: ["Provinsi"],
    "Kota Administrasi": ["Provinsi"],
    Kecamatan: ["Kabupaten", "Kota", "Kota Administrasi"],
    Kelurahan: ["Kecamatan"],
    Desa: ["Kecamatan"],
  };
  function filtered() {
    let q = document.querySelector("#region-search").value.toLowerCase(),
      p = document.querySelector("#province-filter").value,
      l = document.querySelector("#level-filter").value,
      s = document.querySelector("#rstatus-filter").value;
    return regions.filter(
      (x) =>
        (x[0] + x[1]).toLowerCase().includes(q) &&
        (!l || x[2] === l) &&
        (!s || x[5] === s) &&
        (!p ||
          x[1] === p ||
          x[3] === p ||
          regions.find((z) => z[1] === x[3])?.[3] === p),
    );
  }
  function render() {
    let a = filtered(),
      cut = a.slice((pageNo - 1) * 6, pageNo * 6);
    document.querySelector("#region-list").innerHTML =
      cut
        .map(
          (x) =>
            `<tr><td><b>${x[0]}</b></td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td><span class="badge ${x[5].toLowerCase()}">${x[5]}</span></td><td><button class="action region-action" data-code="${x[0]}">•••</button></td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="7" class="empty">Tidak ada wilayah yang sesuai.</td></tr>`;
    document.querySelector("#region-page-label").textContent =
      `Menampilkan ${cut.length} dari ${a.length} wilayah`;
    document.querySelector("#r-prov").textContent = regions.filter(
      (x) => x[2] === "Provinsi",
    ).length;
    document.querySelector("#r-city").textContent = regions.filter((x) =>
      ["Kabupaten", "Kota", "Kota Administrasi"].includes(x[2]),
    ).length;
    document.querySelector("#r-district").textContent = regions.filter(
      (x) => x[2] === "Kecamatan",
    ).length;
    document.querySelector("#r-linked").textContent = regions.filter(
      (x) => x[4] > 0,
    ).length;
    renderTree();
  }
  function renderTree() {
    let roots = regions.filter((x) => x[2] === "Provinsi");
    const branch = (x) => {
      let kids = regions.filter((y) => y[3] === x[1]);
      return `<li><button class="tree-toggle" data-tree="${x[0]}">▸</button><span>${x[1]}</span><small>${x[2]} · ${kids.length} subwilayah · ${x[4]} proyek</small>${kids.length ? `<ul hidden>${kids.map(branch).join("")}</ul>` : ""}</li>`;
    };
    document.querySelector("#region-tree").innerHTML =
      `<ul>${roots.map(branch).join("")}</ul>`;
  }
  render();
  [
    "region-search",
    "province-filter",
    "level-filter",
    "rstatus-filter",
  ].forEach(
    (i) =>
      (document.querySelector("#" + i).oninput = () => {
        pageNo = 1;
        render();
      }),
  );
  document.querySelector("#reset-region").onclick = () => {
    [
      "region-search",
      "province-filter",
      "level-filter",
      "rstatus-filter",
    ].forEach((i) => (document.querySelector("#" + i).value = ""));
    render();
    toast("Filter wilayah direset.");
  };
  document.querySelector("#r-prev").onclick = () => {
    pageNo = Math.max(1, pageNo - 1);
    render();
  };
  document.querySelector("#r-next").onclick = () => {
    pageNo++;
    render();
  };
  document.querySelectorAll(".region-tabs button").forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll(".region-tabs button")
          .forEach((x) => x.classList.toggle("active", x === b));
        let tree = b.dataset.view === "tree";
        document.querySelector("#region-table-view").hidden = tree;
        document.querySelector("#region-tree-view").hidden = !tree;
      }),
  );
  document.querySelector("#region-tree").onclick = (e) => {
    let b = e.target.closest(".tree-toggle");
    if (!b) return;
    let u = b.parentElement.querySelector(":scope > ul");
    if (u) {
      u.hidden = !u.hidden;
      b.textContent = u.hidden ? "▸" : "▾";
    }
  };
  const modal = document.querySelector("#region-modal"),
    form = document.querySelector("#region-form"),
    level = document.querySelector("#region-level"),
    parent = document.querySelector("#region-parent");
  function parentOptions() {
    let allowed = typeParent[level.value] || [];
    parent.innerHTML = allowed.length
      ? `<option value="">Pilih induk wilayah</option>${regions
          .filter((x) => allowed.includes(x[2]))
          .map((x) => `<option>${x[1]}</option>`)
          .join("")}`
      : `<option value="">Tidak diperlukan untuk Provinsi</option>`;
    parent.disabled = !allowed.length;
    document.querySelector("#parent-required").style.display = allowed.length
      ? ""
      : "none";
  }
  level.onchange = parentOptions;
  document.querySelector("#add-region").onclick = () => {
    editing = null;
    form.reset();
    parentOptions();
    modal.classList.add("open");
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    let f = new FormData(form),
      code = f.get("code");
    if (regions.some((x) => x[0] === code && x[0] !== editing))
      return toast("Kode wilayah sudah digunakan.");
    if (typeParent[f.get("level")] && !f.get("parent"))
      return toast("Induk wilayah wajib dipilih.");
    let item = [
      code,
      f.get("name"),
      f.get("level"),
      f.get("parent") || "—",
      0,
      f.get("status"),
    ];
    if (editing) regions[regions.findIndex((x) => x[0] === editing)] = item;
    else regions.unshift(item);
    modal.classList.remove("open");
    render();
    toast(
      editing
        ? "Wilayah berhasil diperbarui."
        : "Wilayah baru berhasil ditambahkan.",
    );
  };
  document.addEventListener("click", (e) => {
    let a = e.target.closest(".region-action");
    if (!a) return;
    let x = regions.find((z) => z[0] === a.dataset.code),
      kids = regions.filter((z) => z[3] === x[1]);
    if (confirm(`OK untuk detail ${x[1]}; Cancel untuk hapus/nonaktifkan.`)) {
      document.querySelector("#rd-name").textContent = x[1];
      document.querySelector("#rd-breadcrumb").textContent =
        x[3] === "—" ? x[1] : x[3] + " / " + x[1];
      document.querySelector("#rd-body").innerHTML =
        `<div class="detail-grid"><b>Kode wilayah</b><span>${x[0]}</span><b>Tingkat administratif</b><span>${x[2]}</span><b>Induk wilayah</b><span>${x[3]}</span><b>Status</b><span>${x[5]}</span><b>Jumlah subwilayah</b><span>${kids.length}</span><b>Jumlah proyek terkait</b><span>${x[4]}</span></div><h3>Wilayah turunan</h3><p>${kids.length ? kids.map((z) => z[1]).join(", ") : "Belum ada wilayah turunan."}</p><h3>Proyek terkait</h3><p>${x[4] ? "Proyek Pantura dalam cakupan " + x[1] : "Belum ada proyek terkait."}</p>`;
      document.querySelector("#region-detail").classList.add("open");
    } else {
      if (kids.length || x[4]) {
        x[5] = "Nonaktif";
        toast("Wilayah memiliki relasi sehingga dinonaktifkan.");
      } else if (confirm(`Hapus ${x[1]} secara permanen?`)) {
        regions = regions.filter((z) => z !== x);
        toast("Wilayah dihapus.");
      }
      render();
    }
  });
  document.querySelector("#import-region").onclick = () =>
    toast("Import data siap dihubungkan ke template CSV.");
  document.querySelector("#export-region").onclick = () =>
    toast("Export data wilayah sedang disiapkan.");
})();
document.querySelector("#regions .region-stats")?.remove();
(() => {
  const page = document.querySelector("#management"),
    menu = document.querySelector('[data-page="management"]');
  if (!page) return;
  if (menu) menu.querySelector("span").textContent = "Setup KAK & Pekerjaan";
  let templates = [
    {
      id: "KAK-GSW",
      name: "Template Giant Sea Wall",
      type: "Giant Sea Wall",
      desc: "Tanggul laut, revetment, dan struktur pelindung pantai",
      works: [
        [
          "I",
          "Persiapan & mobilisasi",
          10,
          [
            ["Pengukuran dan pemasangan bouwplank", 3],
            ["Mobilisasi alat serta material", 7],
          ],
        ],
        [
          "II",
          "Pekerjaan struktur tanggul",
          55,
          [
            ["Pondasi dan perkuatan tanah", 20],
            ["Pemasangan batu pelindung", 35],
          ],
        ],
        [
          "III",
          "Drainase dan pekerjaan pelengkap",
          20,
          [
            ["Saluran drainase", 12],
            ["Akses inspeksi", 8],
          ],
        ],
        [
          "IV",
          "Dokumentasi dan serah terima",
          15,
          [["Pengujian dan as-built drawing", 15]],
        ],
      ],
    },
    {
      id: "KAK-JLN",
      name: "Template Perbaikan Jalan",
      type: "Perbaikan Jalan",
      desc: "Pekerjaan jalan akses serta prasarana pendukung",
      works: [
        ["I", "Persiapan lokasi", 8, [["Pembersihan dan pengukuran", 8]]],
        [
          "II",
          "Pekerjaan tanah dan pondasi",
          40,
          [
            ["Galian dan timbunan", 20],
            ["Lapis pondasi agregat", 20],
          ],
        ],
        [
          "III",
          "Perkerasan jalan",
          42,
          [
            ["Pengaspalan", 30],
            ["Marka jalan", 12],
          ],
        ],
        ["IV", "Penutupan pekerjaan", 10, [["Pemeriksaan akhir", 10]]],
      ],
    },
    {
      id: "KAK-KWS",
      name: "Template Kawasan Pesisir",
      type: "Pembangunan Kawasan",
      desc: "Prasarana kawasan ekonomi dan fasilitas pesisir",
      works: [
        [
          "I",
          "Perencanaan dan persiapan",
          15,
          [["Sosialisasi dan pengukuran", 15]],
        ],
        [
          "II",
          "Infrastruktur kawasan",
          60,
          [
            ["Utilitas dan drainase", 25],
            ["Bangunan fasilitas", 35],
          ],
        ],
        [
          "III",
          "Lanskap dan serah terima",
          25,
          [["Ruang terbuka dan dokumentasi", 25]],
        ],
      ],
    },
  ];
  let selected = templates[0].id;
  page.innerHTML = `<div class="kak-head"><div><h1>Setup KAK & Pekerjaan</h1><p>Kelola template KAK, tahapan pekerjaan, serta indikator pelaporan progres untuk setiap jenis pembangunan.</p></div><button class="p-primary" id="add-kak">＋ Buat Template KAK</button></div><div class="kak-info"><b>Bagaimana digunakan?</b><span>Admin memilih template saat membuat proyek. Kontraktor kemudian melaporkan progres berdasarkan pekerjaan dan bobot yang sudah dikonfigurasi.</span></div><section class="kak-card"><header><div class="kak-tabs"><button class="active" data-kak-tab="works">Daftar pekerjaan</button><button data-kak-tab="types">Jenis pembangunan</button></div><div><button class="p-outline" id="import-kak">⇧ Import KAK/WBS</button><button class="p-primary" id="add-work">＋ Tambah pekerjaan</button></div></header><div class="kak-layout"><aside id="kak-list" class="kak-list"></aside><main id="kak-content" class="kak-content"></main></div></section><div class="p-modal" id="kak-modal"><div class="p-dialog region-dialog"><button class="p-close" data-close>×</button><h2>Buat Template KAK</h2><p class="modal-copy">Template bisa dipakai ulang pada beberapa proyek dengan jenis pembangunan yang sama.</p><form id="kak-form" class="p-grid"><label>Kode template*<input name="code" required placeholder="KAK-BARU"></label><label>Nama template*<input name="name" required></label><label>Jenis pembangunan*<select name="type" required><option>Giant Sea Wall</option><option>Perbaikan Jalan</option><option>Pembangunan Kawasan</option></select></label><label>Status<select><option>Aktif</option><option>Draf</option></select></label><label class="wide">Deskripsi<textarea name="desc"></textarea></label><div class="p-actions wide"><button type="button" class="p-outline" data-close>Batal</button><button class="p-primary">Simpan Template</button></div></form></div></div><div class="p-toast" id="kak-toast"></div>`;
  const toast = (t) => {
    let x = document.querySelector("#kak-toast");
    x.textContent = t;
    x.classList.add("show");
    setTimeout(() => x.classList.remove("show"), 2200);
  };
  function current() {
    return templates.find((t) => t.id === selected);
  }
  function render() {
    let t = current();
    document.querySelector("#kak-list").innerHTML = templates
      .map(
        (x) =>
          `<button class="kak-template ${x.id === selected ? "active" : ""}" data-template="${x.id}"><b>${x.name}</b><span>${x.type}</span><small>${x.works.length} tahapan · bobot 100%</small></button>`,
      )
      .join("");
    document.querySelector("#kak-content").innerHTML =
      `<div class="kak-title"><div><span class="kak-badge">${t.type}</span><h2>${t.name}</h2><p>${t.desc}</p></div><button class="p-outline" id="edit-template">Edit template</button></div><div class="kak-headrow"><span>Pekerjaan / subpekerjaan</span><span>Jenis input</span><span>Bobot</span><span>Target waktu</span><span></span></div><div class="work-tree">${t.works.map((w, i) => `<section><div class="work-parent"><button class="work-toggle" data-work="${i}">▾</button><b>${w[0]} — ${w[1]}</b><span>Kelompok pekerjaan</span><strong>${w[2]}%</strong><span>${w[3].length} subpekerjaan</span><button class="action">•••</button></div><div class="sub-work">${w[3].map((s) => `<div><span>└ ${s[0]}</span><span>Volume / checklist</span><strong>${s[1]}%</strong><span>Diatur per proyek</span><button class="action">•••</button></div>`).join("")}</div></section>`).join("")}</div><footer class="kak-footer"><span>Total bobot pekerjaan</span><b>100%</b><button class="p-outline">Pratinjau form pelaporan</button></footer>`;
  }
  render();
  document.querySelector("#kak-list").onclick = (e) => {
    let b = e.target.closest("[data-template]");
    if (b) {
      selected = b.dataset.template;
      render();
    }
  };
  document.querySelector("#add-kak").onclick = () =>
    document.querySelector("#kak-modal").classList.add("open");
  document.querySelector("#kak-form").onsubmit = (e) => {
    e.preventDefault();
    let f = new FormData(e.target),
      id = f.get("code");
    if (templates.some((t) => t.id === id))
      return toast("Kode template sudah digunakan.");
    templates.push({
      id,
      name: f.get("name"),
      type: f.get("type"),
      desc: f.get("desc") || "Template pekerjaan baru",
      works: [["I", "Tahap persiapan", 100, [["Rincian pekerjaan awal", 100]]]],
    });
    selected = id;
    document.querySelector("#kak-modal").classList.remove("open");
    render();
    toast("Template KAK berhasil dibuat.");
  };
  document.querySelector("#add-work").onclick = () =>
    toast("Tambah pekerjaan dapat dilakukan pada template aktif.");
  document.querySelector("#import-kak").onclick = () =>
    toast("Import KAK/WBS siap menggunakan template Excel.");
  document.querySelectorAll("[data-kak-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll("[data-kak-tab]")
          .forEach((x) => x.classList.toggle("active", x === b));
        toast(
          b.dataset.kakTab === "types"
            ? "Jenis pembangunan: Giant Sea Wall, Perbaikan Jalan, dan Pembangunan Kawasan."
            : "Menampilkan struktur pekerjaan template.",
        );
      }),
  );
})();
(() => {
  const pg = document.querySelector("#management"),
    nav = document.querySelector('[data-page="management"]');
  if (!pg) return;
  if (nav) nav.querySelector("span").textContent = "Kerangka Acuan Kerja";
  let ts = [
    [
      "KAK-GSW-001",
      "Template Pembangunan Giant Sea Wall",
      "Giant Sea Wall",
      "v1",
      8,
      3,
      "Aktif",
      "03/11/2026",
    ],
    [
      "KAK-JLN-001",
      "Template Pembangunan Jalan",
      "Perbaikan Jalan",
      "v2",
      10,
      2,
      "Aktif",
      "30/10/2026",
    ],
    [
      "KAK-KWS-001",
      "Template Pengembangan Kawasan Pesisir",
      "Pembangunan Kawasan",
      "v1",
      7,
      1,
      "Aktif",
      "27/10/2026",
    ],
    [
      "KAK-DRN-001",
      "Template Pembangunan Drainase",
      "Pembangunan Drainase",
      "v1",
      0,
      0,
      "Draft",
      "01/11/2026",
    ],
  ];
  let cur = 1;
  pg.innerHTML = `<div class="kakv-head"><div><p class="crumb">Dashboard / Kerangka Acuan Kerja</p><h1>Kerangka Acuan Kerja</h1><p>Kelola template dan rincian struktur pekerjaan sebagai acuan pelaksanaan serta monitoring pembangunan.</p></div><div><button class="p-outline" id="kimport">⇧ Import Template</button><button class="p-primary" id="kadd">＋ Tambah Template KAK</button></div></div><div class="kstats"><article>Total Template KAK<b id="ktotal">4</b></article><article>Template Aktif<b id="kactive">3</b></article><article>Template Draft<b id="kdraft">1</b></article><article>Template Digunakan Proyek<b id="kused">6</b></article></div><div class="version-note"><b>Konsep versi template</b> Template dipilih saat proyek dibuat dan disalin menjadi rincian proyek. Perubahan master tidak mengubah proyek yang sedang berjalan.</div><section class="kakv-card"><header><h2>Daftar Template KAK / WBS</h2></header><div class="kfilters"><input id="kq" placeholder="Cari nama atau kode template"><select id="ktype"><option value="">Semua jenis pembangunan</option><option>Giant Sea Wall</option><option>Perbaikan Jalan</option><option>Pembangunan Kawasan</option><option>Pembangunan Drainase</option></select><select id="kstatus"><option value="">Semua status</option><option>Aktif</option><option>Draft</option></select><button class="p-outline" id="kreset">Reset Filter</button></div><div class="ktable"><table><thead><tr><th>Kode Template</th><th>Nama Template</th><th>Jenis Pembangunan</th><th>Versi</th><th>Item</th><th>Proyek Pengguna</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead><tbody id="klist"></tbody></table></div><footer class="region-pagination"><span id="klabel"></span><div><button id="kprev">‹</button><button class="active">1</button><button id="knext">›</button></div></footer></section><div class="p-modal" id="kmodal"><div class="p-dialog kdialog"><button class="p-close" data-close>×</button><h2>Tambah Template KAK</h2><div class="p-steps"><span class="active">1<small>Informasi</small></span><i></i><span>2<small>Struktur</small></span><i></i><span>3<small>Pratinjau</small></span></div><form id="kform"><div class="kstep" data-s="1"><div class="p-grid"><label>Kode Template*<input name="code" required></label><label>Nama Template*<input name="name" required></label><label>Jenis Pembangunan*<select name="type"><option>Giant Sea Wall</option><option>Perbaikan Jalan</option><option>Pembangunan Kawasan</option><option>Pembangunan Drainase</option></select></label><label>Status<select name="status"><option>Draft</option><option>Aktif</option></select></label><label class="wide">Deskripsi<textarea name="desc"></textarea></label><label class="wide">Tujuan Pekerjaan<textarea name="goal"></textarea></label></div></div><div class="kstep" data-s="2" hidden><div class="weight-box">Total bobot item terukur: <b id="weight">100%</b><span>Valid untuk publikasi</span></div><div class="wbs"><div><b>I</b> PEKERJAAN PERSIAPAN <span>Kelompok · 10%</span></div><div>　I.1 Mobilisasi <span>Paket · 4%</span></div><div>　I.2 Pembersihan lokasi <span>m² · 6%</span></div><div><b>II</b> PEKERJAAN STRUKTUR <span>Kelompok · 90%</span></div><div>　II.1 Pekerjaan fondasi <span>m³ · 40%</span></div><div>　II.2 Pekerjaan beton <span>m³ · 50%</span></div></div><button type="button" class="p-outline" id="additem">＋ Tambah kelompok / subpekerjaan</button></div><div class="kstep" data-s="3" hidden><div class="preview-box"><h3>Pratinjau & Validasi</h3><p>✓ Minimal satu item pekerjaan terukur</p><p>✓ Tidak ada kode item duplikat</p><p>✓ Total bobot item terukur mencapai 100%</p><p>✓ Struktur parent-child valid</p></div></div><div class="p-actions"><button type="button" class="p-outline" id="kback">Sebelumnya</button><button type="button" class="p-primary" id="knext">Selanjutnya</button><button type="submit" class="p-primary" id="ksave" hidden>Simpan Draft</button><button type="button" class="p-primary" id="kpublish" hidden>Publikasikan Template</button></div></form></div></div><div class="p-modal" id="kdetail"><div class="p-dialog detail"><button class="p-close" data-close>×</button><h2 id="kdname"></h2><div class="detail-tabs"><button class="active">Informasi Umum</button><button>Struktur Pekerjaan</button><button>Riwayat Versi</button><button>Proyek Pengguna</button></div><div id="kdbody"></div></div></div><div class="p-toast" id="ktoast"></div>`;
  const toast = (t) => {
    let e = document.querySelector("#ktoast");
    e.textContent = t;
    e.classList.add("show");
    setTimeout(() => e.classList.remove("show"), 2200);
  };
  function draw() {
    let q = kq.value.toLowerCase(),
      a = ts.filter(
        (x) =>
          (x[0] + x[1]).toLowerCase().includes(q) &&
          (!ktype.value || x[2] === ktype.value) &&
          (!kstatus.value || x[6] === kstatus.value),
      ),
      c = a.slice((cur - 1) * 5, cur * 5);
    klist.innerHTML = c
      .map(
        (x) =>
          `<tr><td><b>${x[0]}</b></td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td>${x[5]}</td><td><span class="badge ${x[6].toLowerCase()}">${x[6]}</span></td><td>${x[7]}</td><td><button class="action ka" data-id="${x[0]}">•••</button></td></tr>`,
      )
      .join("");
    klabel.textContent = `Menampilkan ${c.length} dari ${a.length} template`;
    ktotal.textContent = ts.length;
    kactive.textContent = ts.filter((x) => x[6] === "Aktif").length;
    kdraft.textContent = ts.filter((x) => x[6] === "Draft").length;
    kused.textContent = ts.reduce((n, x) => n + x[5], 0);
  }
  draw();
  [kq, ktype, kstatus].forEach((e) => (e.oninput = draw));
  kreset.onclick = () => {
    kq.value = ktype.value = kstatus.value = "";
    draw();
  };
  kadd.onclick = () => {
    kform.reset();
    step = 1;
    show();
    kmodal.classList.add("open");
  };
  let step = 1;
  function show() {
    document
      .querySelectorAll(".kstep")
      .forEach((x) => (x.hidden = +x.dataset.s !== step));
    document
      .querySelectorAll("#kmodal .p-steps span")
      .forEach((x, i) => x.classList.toggle("active", i < step));
    kback.style.visibility = step === 1 ? "hidden" : "visible";
    knext.hidden = step === 3;
    ksave.hidden = kpublish.hidden = step !== 3;
  }
  knext.onclick = () => {
    if (
      step === 1 &&
      [...kform.querySelectorAll('.kstep[data-s="1"] [required]')].some(
        (x) => !x.value,
      )
    )
      return toast("Lengkapi field wajib.");
    step++;
    show();
  };
  kback.onclick = () => {
    step--;
    show();
  };
  ksave.onclick = () => {
    let f = new FormData(kform);
    ts.unshift([
      f.get("code"),
      f.get("name"),
      f.get("type"),
      "v1",
      6,
      0,
      "Draft",
      "Hari ini",
    ]);
    kmodal.classList.remove("open");
    draw();
    toast("Template disimpan sebagai draft.");
  };
  kpublish.onclick = () => {
    let f = new FormData(kform);
    ts.unshift([
      f.get("code"),
      f.get("name"),
      f.get("type"),
      "v1",
      6,
      0,
      "Aktif",
      "Hari ini",
    ]);
    kmodal.classList.remove("open");
    draw();
    toast("Template berhasil dipublikasikan.");
  };
  kform.onsubmit = (e) => {
    e.preventDefault();
    ksave.click();
  };
  document.addEventListener("click", (e) => {
    let b = e.target.closest(".ka");
    if (!b) return;
    let x = ts.find((z) => z[0] === b.dataset.id);
    kdname.textContent = x[1];
    kdbody.innerHTML = `<div class="detail-grid"><b>Kode</b><span>${x[0]}</span><b>Jenis pembangunan</b><span>${x[2]}</span><b>Versi</b><span>${x[3]}</span><b>Status</b><span>${x[6]}</span></div><h3>Struktur pekerjaan</h3><table><tr><th>Kode</th><th>Uraian Pekerjaan</th><th>Satuan</th><th>Bobot</th></tr><tr><td>I</td><td><b>PEKERJAAN PERSIAPAN</b></td><td>-</td><td>10%</td></tr><tr><td>I.1</td><td>　Mobilisasi</td><td>Paket</td><td>4%</td></tr><tr><td>I.2</td><td>　Pembersihan Lokasi</td><td>m²</td><td>6%</td></tr><tr><td>II</td><td><b>PEKERJAAN STRUKTUR</b></td><td>-</td><td>90%</td></tr></table>`;
    kdetail.classList.add("open");
  });
  kimport.onclick = () =>
    toast("Pilih file CSV/XLSX untuk simulasi import template.");
})();
(() => {
  const dashboard = document.querySelector("#dashboard");
  if (!dashboard || document.querySelector("#dashboard-map")) return;
  dashboard.insertAdjacentHTML(
    "beforeend",
    `<section class="dash-card dashboard-map-card" id="dashboard-map"><div class="dashboard-map-head"><div><h2>Peta Sebaran Proyek</h2><p>Lokasi ilustratif proyek pada koridor Pantai Utara Jawa</p></div><button class="p-outline" id="open-full-map">Buka peta penuh →</button></div><div class="dashboard-map"><img src="assets/indonesia-basemap.png" alt="Peta sebaran proyek Indonesia"><span class="dmap-marker green" style="left:18%;top:63%">1</span><span class="dmap-marker green" style="left:22%;top:64%">3</span><span class="dmap-marker blue" style="left:27%;top:65%">5</span><span class="dmap-marker blue" style="left:32%;top:65%">7</span><span class="dmap-marker amber" style="left:37%;top:66%">10</span><span class="dmap-marker red" style="left:43%;top:66%">13</span><span class="dmap-marker blue" style="left:47%;top:67%">15</span><div class="dmap-legend"><span class="green">Normal</span><span class="amber">Perlu perhatian</span><span class="red">Prioritas</span></div></div></section>`,
  );
  document.querySelector("#open-full-map").onclick = () =>
    document.querySelector('[data-page="map"]').click();
})();
document
  .querySelector("#dashboard .metrics")
  ?.after(document.querySelector("#dashboard-map"));
