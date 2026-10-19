// GulaSadar - front-end tanpa framework dan tanpa langkah build.
// Semua teks dari pengguna/AI dirender lewat textContent (anti-XSS), bukan innerHTML.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
function sv(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

const fmt = (n, d = 1) => Number(n).toLocaleString("id-ID", { maximumFractionDigits: d });
const tanggalHariIni = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const state = { tanggal: tanggalHariIni(), aiAktif: false, terpilih: null, fotoData: null, chat: [] };

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Terjadi kesalahan. Coba lagi."), { status: res.status, data });
  return data;
}

let toastTimer;
function toast(pesan) {
  const el = $("#toast");
  el.textContent = pesan;
  el.classList.add("tampil");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("tampil"), 2600);
}

const NAMA_LAMPU = { hijau: "Aman", kuning: "Hati-hati", merah: "Tinggi gula" };
const chipLampu = (lampu, teks) => h("span", { class: `lampu lampu-${lampu}` }, teks ?? NAMA_LAMPU[lampu]);

/* ================= Navigasi ================= */
const TAB = ["beranda", "pindai", "risiko", "sobat", "darah"];
const pemuat = { beranda: muatBeranda, risiko: muatRisiko, sobat: muatSobat, darah: muatDarah };

function tampilkan(tab) {
  if (!TAB.includes(tab)) tab = "beranda";
  $$(".tab").forEach((s) => (s.hidden = s.id !== `tab-${tab}`));
  $$(".nav-btn").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  history.replaceState(null, "", `#${tab}`);
  pemuat[tab]?.().catch((e) => toast(e.message));
}
$$(".nav-btn").forEach((b) => b.addEventListener("click", () => tampilkan(b.dataset.tab)));
$$("[data-goto]").forEach((b) => b.addEventListener("click", () => tampilkan(b.dataset.goto)));

/* ================= Beranda ================= */
function sendok(rasio, lebih, i) {
  const id = `mangkuk${i}`;
  const tinggi = 38 * Math.min(1, Math.max(0, rasio));
  return sv("svg", { class: "sendok", viewBox: "0 0 60 130", width: 64, height: 139, "aria-hidden": "true" },
    sv("defs", {}, sv("clipPath", { id }, sv("ellipse", { cx: 30, cy: 24, rx: 23, ry: 19 }))),
    sv("rect", { x: 27, y: 40, width: 6, height: 86, rx: 3, class: "gagang" }),
    sv("ellipse", { cx: 30, cy: 24, rx: 23, ry: 19, class: "mangkuk" }),
    sv("g", { "clip-path": `url(#${id})` }, sv("rect", { x: 5, y: 43 - tinggi, width: 50, height: tinggi, class: lebih ? "isi isi-lebih" : "isi" })),
    sv("ellipse", { cx: 30, cy: 24, rx: 23, ry: 19, class: "mangkuk-garis", fill: "none" }),
  );
}

function gambarSendok(s) {
  const wadah = $("#spoons");
  wadah.replaceChildren(...[0, 1, 2, 3].map((i) => sendok(s.sdm - i, s.status === "merah", i)));
  wadah.setAttribute("aria-label", `Gula tambahan terpakai ${fmt(s.tambahan)} gram dari batas ${s.batas} gram`);
}

function teksHero(s) {
  let kalimat, catatan;
  if (s.tambahan === 0) {
    kalimat = `Jatahmu masih utuh: 4 sendok makan gula (${s.batas} g).`;
    catatan = "Gula tambahan hanya dihitung dari gula yang ditambahkan ke makanan dan minuman.";
  } else if (s.status === "merah") {
    kalimat = `Jatah hari ini terlampaui ${fmt(s.tambahan - s.batas)} g.`;
    catatan = "Untuk sisa hari ini, pilih air putih atau teh tawar.";
  } else {
    kalimat = `Terpakai ${fmt(s.sdm)} dari 4 sendok makan.`;
    catatan = s.status === "kuning"
      ? `Sisa ${fmt(s.sisa)} g, hampir habis. Pilih minuman tanpa gula.`
      : `Sisa ${fmt(s.sisa)} g, setara ${fmt(s.sisa / s.gramPerSdm)} sendok makan.`;
  }
  $("#heroKalimat").textContent = kalimat;
  $("#heroCatatan").textContent = catatan;
  $("#streak").textContent = s.status === "merah"
    ? "Jatah terlampaui hari ini, jadi rangkaian hari sehat dimulai lagi besok."
    : s.streak > 0
      ? `${s.streak} hari berturut-turut di bawah batas. Pertahankan.`
      : "Catat makananmu hari ini untuk memulai rangkaian hari sehat.";
}

function gambarMinggu(minggu, batas) {
  const W = 440, H = 200, kiri = 8, kanan = 62, bawah = 28, atas = 22;
  const maks = Math.max(batas * 1.25, ...minggu.map((m) => m.tambahan));
  const lebar = (W - kiri - kanan) / minggu.length;
  const y = (v) => atas + (H - atas - bawah) * (1 - v / maks);
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Gula tambahan tujuh hari terakhir: ${minggu.map((m) => `${fmt(m.tambahan)} gram`).join(", ")}`, width: "100%" });
  minggu.forEach((m, i) => {
    const x = kiri + i * lebar + lebar * 0.16;
    const w = lebar * 0.68;
    const kelas = m.tambahan > batas ? "bar-merah" : m.tambahan >= batas * 0.7 ? "bar-kuning" : "bar-hijau";
    const tinggi = Math.max(m.tambahan > 0 ? 3 : 0, y(0) - y(m.tambahan));
    svg.append(sv("rect", { x, y: y(0) - tinggi, width: w, height: tinggi, rx: 4, class: kelas }));
    if (m.tambahan > 0) svg.append(sv("text", { x: x + w / 2, y: y(0) - tinggi - 5, "text-anchor": "middle" }, fmt(m.tambahan, 0)));
    const hari = new Date(`${m.tanggal}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short" });
    svg.append(sv("text", { x: x + w / 2, y: H - 8, "text-anchor": "middle" }, hari));
  });
  svg.append(sv("line", { x1: kiri, x2: W - kanan, y1: y(batas), y2: y(batas), class: "batas" }));
  svg.append(sv("text", { x: W - kanan + 6, y: y(batas) + 4 }, `batas ${batas} g`));
  $("#weekChart").replaceChildren(svg);
}

function barisLog(it) {
  return h("li", {},
    h("div", {}, h("span", { class: "nama" }, it.nama), h("span", { class: "sub" }, `${it.porsi ? `${it.porsi} x ` : ""}${fmt(it.qty, 2)}${it.tambahan ? "" : " (gula alami)"}`)),
    h("span", { class: "angka" }, `${fmt(it.gula)} g`),
    chipLampu(it.lampu),
    h("button", { class: "btn kecil", "aria-label": `Hapus ${it.nama}`, onclick: async () => { await api(`/api/log/${it.id}`, { method: "DELETE" }); toast("Catatan dihapus"); muatBeranda(); } }, "Hapus"),
  );
}

async function muatBeranda() {
  const [s, log] = await Promise.all([api(`/api/summary?date=${state.tanggal}`), api(`/api/log?date=${state.tanggal}`)]);
  gambarSendok(s);
  teksHero(s);
  gambarMinggu(s.minggu, s.batas);
  $("#logList").replaceChildren(...log.items.map(barisLog));
  $("#logEmpty").hidden = log.items.length > 0;
  $("#alamiNote").textContent = s.alami > 0 ? `Gula alami (buah utuh, susu): ${fmt(s.alami)} g, tidak dihitung ke batas harian.` : "";
}

/* ================= Pindai ================= */
$$(".seg-btn").forEach((b) => b.addEventListener("click", () => {
  $$(".seg-btn").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  $("#mode-ketik").hidden = b.dataset.mode !== "ketik";
  $("#mode-foto").hidden = b.dataset.mode !== "foto";
  $("#formLabel").hidden = b.dataset.mode !== "label";
  $("#detail").hidden = true;
}));

function daftarHasil(el, items) {
  el.replaceChildren(...items.map((it) => h("li", {},
    h("button", { type: "button", onclick: () => tampilDetail(it) },
      h("span", {}, h("strong", {}, it.nama), h("span", { class: "sub" }, `${it.porsi}${it.qty !== 1 ? `, perkiraan ${fmt(it.qty, 2)} porsi` : ""}`)),
      h("span", { class: "angka" }, `${fmt(it.gula)} g`),
      chipLampu(it.lampu)))));
}

let timerCari;
$("#q").addEventListener("input", (e) => {
  clearTimeout(timerCari);
  const q = e.target.value.trim();
  if (!q) { $("#hasilCari").replaceChildren(); return; }
  timerCari = setTimeout(async () => {
    try {
      const { items } = await api(`/api/foods?q=${encodeURIComponent(q)}`);
      if (!items.length) $("#hasilCari").replaceChildren(h("li", { class: "empty" }, "Tidak ditemukan. Coba kata lain, atau pakai menu Label kemasan."));
      else daftarHasil($("#hasilCari"), items);
    } catch (err) { toast(err.message); }
  }, 180);
});

function tampilDetail(item) {
  state.terpilih = item;
  const kotak = $("#detail");
  kotak.hidden = false;
  kotak.className = `detail l-${item.lampu}`;
  const isiQty = !item.kustom && item.id
    ? h("div", { class: "qty" },
        h("label", { for: "qtyInput" }, "Jumlah porsi"),
        h("input", { id: "qtyInput", type: "number", min: "0.25", max: "20", step: "0.25", value: item.qty, onchange: async (e) => {
          try { const { item: baru } = await api(`/api/foods/${item.id}?qty=${encodeURIComponent(e.target.value)}`); tampilDetail(baru); $("#qtyInput").focus(); }
          catch (err) { toast(err.message); e.target.value = item.qty; }
        } }))
    : null;
  kotak.replaceChildren(
    h("h2", {}, item.nama),
    h("p", { class: "muted" }, item.porsi),
    h("div", { class: "angka-besar" },
      h("div", {}, h("strong", {}, `${fmt(item.gula)} g`), h("span", {}, `gula, setara ${fmt(item.sdm)} sendok makan`)),
      item.karbo ? h("div", {}, h("strong", {}, `${fmt(item.karbo)} g`), h("span", {}, "karbohidrat")) : null,
      item.gi ? h("div", {}, h("strong", {}, item.gi), h("span", {}, "indeks glikemik")) : null),
    h("p", {}, chipLampu(item.lampu), " ", item.alasan),
    h("p", { class: "muted small" }, item.kustom ? "Angka berasal dari label yang kamu masukkan." : "Angka adalah estimasi per porsi umum. Untuk produk kemasan, cek label gizi."),
    isiQty,
    h("button", { class: "btn primary", type: "button", onclick: catatItem }, "Catat ke hari ini"),
  );
  kotak.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function catatItem() {
  const it = state.terpilih;
  if (!it) return;
  const body = it.kustom
    ? { kustom: { nama: it.nama, gula: it.gula, karbo: it.karbo, porsi: it.porsi }, date: state.tanggal }
    : { foodId: it.id, qty: it.qty, date: state.tanggal };
  try {
    await api("/api/log", { method: "POST", body });
    toast(`Tercatat: ${it.nama}`);
  } catch (e) { toast(e.message); }
}

// --- Foto ---
function aturInfoFoto() {
  $("#fotoInfo").textContent = state.aiAktif
    ? "AI mengenali makanan di fotomu, lalu angka gula diambil dari database makanan Indonesia, bukan ditebak AI."
    : "Fitur foto butuh mode AI: isi ANTHROPIC_API_KEY di file .env lalu jalankan ulang. Sementara itu, gunakan Ketik nama atau Label kemasan.";
}
$("#fileFoto").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  state.fotoData = null;
  $("#btnKenali").disabled = true;
  $("#hasilFoto").replaceChildren();
  if (!file) return;
  if (!file.type.startsWith("image/")) { $("#fotoStatus").textContent = "File harus berupa gambar."; return; }
  try {
    const bmp = await createImageBitmap(file);
    const skala = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
    const kanvas = document.createElement("canvas");
    kanvas.width = Math.round(bmp.width * skala);
    kanvas.height = Math.round(bmp.height * skala);
    kanvas.getContext("2d").drawImage(bmp, 0, 0, kanvas.width, kanvas.height);
    const dataUrl = kanvas.toDataURL("image/jpeg", 0.82);
    state.fotoData = dataUrl;
    const prev = $("#fotoPreview");
    prev.src = dataUrl;
    prev.hidden = false;
    $("#btnKenali").disabled = !state.aiAktif;
    $("#fotoStatus").textContent = state.aiAktif ? "" : "Mode AI belum aktif.";
  } catch { $("#fotoStatus").textContent = "Foto tidak bisa dibaca. Coba foto lain."; }
});
$("#btnKenali").addEventListener("click", async () => {
  if (!state.fotoData) return;
  $("#btnKenali").disabled = true;
  $("#fotoStatus").textContent = "Mengenali makanan...";
  try {
    const d = await api("/api/scan/photo", { method: "POST", body: { image: state.fotoData, mediaType: "image/jpeg" } });
    daftarHasil($("#hasilFoto"), d.items);
    $("#fotoStatus").textContent = d.items.length
      ? "Pilih satu untuk melihat detail. Perkiraan porsi bisa kamu ubah."
      : `Tidak ada yang cocok dengan database${d.tidakDikenal.length ? ` (terlihat: ${d.tidakDikenal.join(", ")})` : ""}. Coba ketik nama makanannya.`;
  } catch (e) { $("#fotoStatus").textContent = e.message; }
  $("#btnKenali").disabled = false;
});

// --- Label ---
$("#formLabel").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const { item } = await api("/api/label", { method: "POST", body: { nama: $("#labelNama").value, gulaPerSajian: $("#labelGula").value, sajian: $("#labelSajian").value } });
    tampilDetail(item);
  } catch (err) { toast(err.message); }
});

/* ================= Risiko ================= */
const LEVEL_LAMPU = { rendah: "hijau", agak_meningkat: "kuning", sedang: "kuning", tinggi: "merah" };

function tampilRisiko(hasil) {
  const kotak = $("#risikoHasil");
  kotak.hidden = false;
  kotak.className = `detail l-${LEVEL_LAMPU[hasil.level]}`;
  kotak.replaceChildren(
    h("div", { class: "angka-besar" },
      h("div", {}, h("strong", {}, `${hasil.skor}/${hasil.skorMaks}`), h("span", {}, "skor risiko")),
      h("div", {}, h("strong", {}, fmt(hasil.bmi)), h("span", {}, "indeks massa tubuh"))),
    h("h2", {}, hasil.label),
    h("p", {}, hasil.ringkasan),
    h("table", {}, h("caption", { class: "sr" }, "Rincian skor"),
      h("tbody", {}, hasil.rincian.map((r) => h("tr", {}, h("td", {}, h("strong", {}, r.faktor), h("br"), h("span", { class: "muted small" }, r.keterangan)), h("td", { class: "poin" }, `+${r.poin}`))))),
    h("h2", {}, "Langkah yang disarankan"),
    h("ul", { class: "saran" }, hasil.saran.map((s) => h("li", {}, s))),
    h("p", { class: "muted small" }, hasil.catatan),
  );
  kotak.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function muatRisiko() {
  const { terakhir } = await api("/api/risk/latest");
  if (!terakhir || $("#formRisiko").dataset.terisi) return;
  const f = $("#formRisiko");
  f.dataset.terisi = "1";
  for (const [k, v] of Object.entries(terakhir.jawaban)) {
    const el = f.elements[k];
    if (!el) continue;
    if (el.type === "checkbox") el.checked = v === true;
    else el.value = v;
  }
  tampilRisiko(terakhir.hasil);
}

$("#formRisiko").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const v = (n) => f.elements[n].value;
  const c = (n) => f.elements[n].checked;
  $("#risikoError").textContent = "";
  try {
    const { hasil } = await api("/api/risk", { method: "POST", body: {
      umur: v("umur"), tinggiCm: v("tinggiCm"), beratKg: v("beratKg"), pinggangCm: v("pinggangCm"),
      jenisKelamin: v("jenisKelamin"), riwayatKeluarga: v("riwayatKeluarga"),
      aktifFisik: c("aktifFisik"), sayurBuahHarian: c("sayurBuahHarian"), obatHipertensi: c("obatHipertensi"), gulaDarahTinggi: c("gulaDarahTinggi"),
    } });
    tampilRisiko(hasil);
  } catch (err) { $("#risikoError").textContent = err.message; }
});

/* ================= Sobat Gula ================= */
const SARAN_TANYA = [
  "Berapa batas gula harian?",
  "Apakah es teh manis berbahaya?",
  "Apa saja gejala awal diabetes?",
  "Ayahku dulu diabetes, bagaimana mencegahnya?",
];
const NAMA_MODE = { ai: "dijawab oleh AI", dasar: "mode dasar", aman: "pagar keamanan" };

function gelembung(peran, teks, mode) {
  const el = h("div", { class: `bubble ${peran === "user" ? "user" : "bot"}` }, teks, mode ? h("span", { class: "mode" }, NAMA_MODE[mode]) : null);
  $("#chatLog").append(el);
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
  return el;
}

async function muatSobat() {
  $("#modeChat").textContent = state.aiAktif
    ? "Mode AI aktif. Jawaban tetap dibatasi pagar keamanan: tidak ada diagnosis atau saran dosis obat."
    : "Mode dasar (tanpa AI): jawaban berasal dari pengetahuan bawaan dan database makanan. Isi ANTHROPIC_API_KEY untuk mengaktifkan AI.";
  if (!state.chat.length) {
    gelembung("bot", "Halo, aku Sobat Gula. Aku bisa bantu menjelaskan batas gula, gejala awal diabetes, pencegahan, dan menilai makanan yang kamu makan. Mau tanya apa?");
    $("#chips").replaceChildren(...SARAN_TANYA.map((t) => h("button", { class: "chip", type: "button", onclick: () => kirimChat(t) }, t)));
    state.chat.push({ role: "assistant", content: "sapaan" });
  }
}

async function kirimChat(pesan) {
  pesan = pesan.trim();
  if (!pesan) return;
  const riwayat = state.chat.filter((m) => m.content !== "sapaan").slice(-10);
  gelembung("user", pesan);
  state.chat.push({ role: "user", content: pesan });
  $("#chatInput").value = "";
  const menunggu = gelembung("bot", "Sobat Gula sedang mengetik...");
  try {
    const d = await api("/api/chat", { method: "POST", body: { message: pesan, history: riwayat, date: state.tanggal } });
    menunggu.remove();
    gelembung("bot", d.balasan, d.mode);
    state.chat.push({ role: "assistant", content: d.balasan });
  } catch (e) {
    menunggu.remove();
    gelembung("bot", e.message);
  }
}
$("#formChat").addEventListener("submit", (e) => { e.preventDefault(); kirimChat($("#chatInput").value); });

/* ================= Gula darah ================= */
const NAMA_KONTEKS = { puasa: "Puasa", sesudah_makan: "2 jam setelah makan", sewaktu: "Sewaktu" };
const LEVEL_G = { normal: "hijau", perhatian: "kuning", rendah: "kuning", tinggi: "merah" };
const NAMA_LEVEL = { normal: "Normal", perhatian: "Perlu perhatian", rendah: "Terlalu rendah", tinggi: "Tinggi" };

function gambarGlukosa(items) {
  const data = [...items].reverse().slice(-12);
  if (data.length < 2) { $("#glukosaChart").replaceChildren(); return; }
  const W = 520, H = 210, kiri = 36, kanan = 12, atas = 14, bawah = 30;
  const maks = Math.max(180, ...data.map((d) => d.nilai + 15));
  const min = Math.min(60, ...data.map((d) => d.nilai - 10));
  const x = (i) => kiri + ((W - kiri - kanan) * i) / (data.length - 1);
  const y = (v) => atas + (H - atas - bawah) * (1 - (v - min) / (maks - min));
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": `Grafik gula darah: ${data.map((d) => d.nilai).join(", ")} mg/dL` });
  svg.append(sv("line", { x1: kiri, x2: W - kanan, y1: y(100), y2: y(100), class: "batas" }));
  svg.append(sv("text", { x: kiri - 4, y: y(100) + 4, "text-anchor": "end" }, "100"));
  svg.append(sv("polyline", { points: data.map((d, i) => `${x(i)},${y(d.nilai)}`).join(" "), class: "garis-data" }));
  data.forEach((d, i) => {
    svg.append(sv("circle", { cx: x(i), cy: y(d.nilai), r: 5, class: "titik" }));
    svg.append(sv("text", { x: x(i), y: y(d.nilai) - 11, "text-anchor": "middle" }, fmt(d.nilai, 0)));
    svg.append(sv("text", { x: x(i), y: H - 10, "text-anchor": "middle" }, d.tanggal.slice(5).split("-").reverse().join("/")));
  });
  $("#glukosaChart").replaceChildren(svg);
}

async function muatDarah() {
  const { items } = await api("/api/glucose");
  $("#glukosaList").replaceChildren(...items.map((g) => h("li", {},
    h("div", {}, h("span", { class: "nama" }, `${fmt(g.nilai, 0)} mg/dL`), h("span", { class: "sub" }, `${g.tanggal}, ${NAMA_KONTEKS[g.konteks]}`)),
    h("span", {}),
    chipLampu(LEVEL_G[g.level], NAMA_LEVEL[g.level]),
    h("button", { class: "btn kecil", "aria-label": `Hapus catatan ${g.nilai} mg/dL`, onclick: async () => { await api(`/api/glucose/${g.id}`, { method: "DELETE" }); toast("Catatan dihapus"); muatDarah(); } }, "Hapus"))));
  $("#glukosaEmpty").hidden = items.length > 0;
  gambarGlukosa(items);
}

$("#formDarah").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const d = await api("/api/glucose", { method: "POST", body: { nilai: $("#gNilai").value, konteks: $("#gKonteks").value, date: state.tanggal } });
    const kotak = $("#glukosaHasil");
    kotak.hidden = false;
    kotak.className = `detail l-${LEVEL_G[d.hasil.level]}`;
    kotak.replaceChildren(h("p", {}, chipLampu(LEVEL_G[d.hasil.level], d.hasil.label), " ", d.hasil.pesan));
    $("#gNilai").value = "";
    muatDarah();
  } catch (err) { toast(err.message); }
});

/* ================= Mulai ================= */
(async function mulai() {
  try {
    const cfg = await api("/api/config");
    state.aiAktif = cfg.aiAktif;
  } catch { /* server tetap bisa dipakai tanpa config */ }
  aturInfoFoto();
  tampilkan(location.hash.slice(1) || "beranda");
})();
