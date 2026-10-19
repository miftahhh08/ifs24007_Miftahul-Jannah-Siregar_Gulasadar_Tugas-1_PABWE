// Pembuat aplikasi: menerima dependensi (db, ai) lalu mengembalikan handler fetch standar.
// Dipisah dari server.js supaya mudah diuji tanpa membuka port.
import { join, normalize, sep } from "node:path";
import { HttpError } from "./errors.js";
import { tanggalLokal } from "./db.js";
import {
  BATAS_GULA_G, GRAM_PER_SDM, getFood, searchFoods, bentukItem, lampuInfo, round1,
} from "./foods.js";
import { hitungRisiko } from "./risk.js";
import { klasifikasiGlukosa } from "./glucose.js";
import { saringPesan } from "./safety.js";
import { balasDasar, bangunKonteks } from "./chat.js";

const PUBLIC_DIR = join(import.meta.dir, "..", "public");
const MEDIA_FOTO = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAKS_FOTO_BASE64 = 7_000_000; // ~5 MB biner

const HEADER_KEAMANAN = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...HEADER_KEAMANAN },
  });

const adaTanggal = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const ambilTanggal = (s) => {
  if (s == null || s === "") return tanggalLokal();
  if (!adaTanggal(s)) throw new HttpError(400, "Format tanggal harus YYYY-MM-DD.");
  return s;
};
const ambilQty = (v) => {
  const n = v == null ? 1 : Number(v);
  if (!Number.isFinite(n) || n < 0.25 || n > 20) throw new HttpError(400, "Jumlah porsi harus antara 0,25 dan 20.");
  return n;
};
const teks = (v, nama, maks) => {
  const s = String(v ?? "").trim();
  if (!s) throw new HttpError(400, `${nama} wajib diisi.`);
  return s.slice(0, maks);
};
const bacaJson = async (req) => {
  try { return await req.json(); } catch { throw new HttpError(400, "Body harus berupa JSON yang valid."); }
};

/** Pembatas laju sederhana (in-memory) agar kuota API AI tidak terkuras. */
function buatPembatas(maks, jendelaMs) {
  const waktu = [];
  return () => {
    const sekarang = Date.now();
    while (waktu.length && sekarang - waktu[0] > jendelaMs) waktu.shift();
    if (waktu.length >= maks) throw new HttpError(429, "Terlalu banyak permintaan. Coba lagi sebentar.");
    waktu.push(sekarang);
  };
}

export function createApp({ db, ai }) {
  const batasAi = buatPembatas(20, 60_000);

  async function api(req, url) {
    const { pathname: p, searchParams: sp } = url;
    const m = req.method;

    if (p === "/api/config" && m === "GET") {
      return json({ aiAktif: ai.enabled, batasGulaG: BATAS_GULA_G, gramPerSdm: GRAM_PER_SDM });
    }

    // --- Database makanan ---
    if (p === "/api/foods" && m === "GET") {
      const hasil = searchFoods(sp.get("q") ?? "", 8).map(({ food }) => bentukItem(food, 1));
      return json({ items: hasil });
    }
    let mt = p.match(/^\/api\/foods\/([a-z0-9-]+)$/);
    if (mt && m === "GET") {
      const food = getFood(mt[1]);
      if (!food) throw new HttpError(404, "Makanan tidak ditemukan.");
      return json({ item: bentukItem(food, ambilQty(sp.get("qty"))) });
    }

    // --- Pindai: label kemasan & foto ---
    if (p === "/api/label" && m === "POST") {
      const b = await bacaJson(req);
      const gulaSajian = Number(b.gulaPerSajian);
      if (!Number.isFinite(gulaSajian) || gulaSajian < 0 || gulaSajian > 500) throw new HttpError(400, "Gula per sajian harus antara 0 dan 500 gram.");
      const sajian = ambilQty(b.sajian);
      const nama = String(b.nama ?? "").trim().slice(0, 80) || "Produk kemasan";
      const gula = round1(gulaSajian * sajian);
      const { lampu, alasan } = lampuInfo({ gula, karbo: 0, gi: null, tambahan: true }, 1);
      return json({ item: { id: null, nama, porsi: `${sajian} sajian`, qty: 1, gula, karbo: 0, tambahan: true, sdm: round1(gula / GRAM_PER_SDM), lampu, alasan, kustom: true } });
    }
    if (p === "/api/scan/photo" && m === "POST") {
      if (!ai.enabled) {
        return json({ error: "Pengenalan foto butuh mode AI. Isi ANTHROPIC_API_KEY di file .env, lalu jalankan ulang. Sementara itu, gunakan pencarian nama makanan.", aiAktif: false }, 503);
      }
      batasAi();
      const b = await bacaJson(req);
      const mediaType = String(b.mediaType ?? "");
      const data = String(b.image ?? "").replace(/^data:[^,]+,/, "");
      if (!MEDIA_FOTO.includes(mediaType)) throw new HttpError(400, "Format foto harus JPEG, PNG, WebP, atau GIF.");
      if (!data || data.length > MAKS_FOTO_BASE64) throw new HttpError(400, "Foto kosong atau terlalu besar (maks. sekitar 5 MB).");
      try {
        const { items, tidakDikenal } = await ai.kenaliFoto(data, mediaType);
        return json({ items: items.map(({ food, qty }) => bentukItem(food, qty)), tidakDikenal });
      } catch (e) {
        console.error("[scan/photo]", e.message);
        throw new HttpError(502, "Layanan AI sedang bermasalah. Coba lagi atau cari makanan dengan mengetik namanya.");
      }
    }

    // --- Catatan makan ---
    if (p === "/api/log" && m === "GET") {
      return json({ items: db.daftarLog(ambilTanggal(sp.get("date"))) });
    }
    if (p === "/api/log" && m === "POST") {
      const b = await bacaJson(req);
      const tanggal = ambilTanggal(b.date);
      const qty = ambilQty(b.qty);
      let baris;
      if (b.foodId) {
        const food = getFood(String(b.foodId));
        if (!food) throw new HttpError(404, "Makanan tidak ditemukan.");
        const it = bentukItem(food, qty);
        baris = { nama: food.nama, porsi: food.porsi, qty, gula: it.gula, karbo: it.karbo, tambahan: food.tambahan, lampu: it.lampu };
      } else if (b.kustom && typeof b.kustom === "object") {
        const gula = Number(b.kustom.gula);
        const karbo = Number(b.kustom.karbo ?? 0);
        if (!Number.isFinite(gula) || gula < 0 || gula > 1000 || !Number.isFinite(karbo) || karbo < 0 || karbo > 2000) {
          throw new HttpError(400, "Nilai gula/karbohidrat tidak valid.");
        }
        const { lampu } = lampuInfo({ gula, karbo, gi: null, tambahan: true }, 1);
        baris = { nama: teks(b.kustom.nama, "Nama", 80), porsi: String(b.kustom.porsi ?? "").slice(0, 60) || null, qty: 1, gula: round1(gula), karbo: round1(karbo), tambahan: true, lampu };
      } else {
        throw new HttpError(400, "Kirim foodId atau data kustom.");
      }
      return json({ item: db.tambahLog({ tanggal, ...baris }) }, 201);
    }
    mt = p.match(/^\/api\/log\/(\d+)$/);
    if (mt && m === "DELETE") {
      if (!db.hapusLog(Number(mt[1]))) throw new HttpError(404, "Catatan tidak ditemukan.");
      return json({ ok: true });
    }
    if (p === "/api/summary" && m === "GET") {
      return json(db.ringkasan(ambilTanggal(sp.get("date"))));
    }

    // --- Risiko ---
    if (p === "/api/risk" && m === "POST") {
      const b = await bacaJson(req);
      const hasil = hitungRisiko(b);
      db.simpanRisiko(b, hasil);
      return json({ hasil });
    }
    if (p === "/api/risk/latest" && m === "GET") {
      return json({ terakhir: db.risikoTerakhir() });
    }

    // --- Gula darah ---
    if (p === "/api/glucose" && m === "GET") return json({ items: db.daftarGlukosa(30) });
    if (p === "/api/glucose" && m === "POST") {
      const b = await bacaJson(req);
      const nilai = Number(b.nilai);
      const hasil = klasifikasiGlukosa(nilai, b.konteks);
      const item = db.tambahGlukosa({ tanggal: ambilTanggal(b.date), nilai, konteks: b.konteks, level: hasil.level });
      return json({ item, hasil }, 201);
    }
    mt = p.match(/^\/api\/glucose\/(\d+)$/);
    if (mt && m === "DELETE") {
      if (!db.hapusGlukosa(Number(mt[1]))) throw new HttpError(404, "Catatan tidak ditemukan.");
      return json({ ok: true });
    }

    // --- Chatbot ---
    if (p === "/api/chat" && m === "POST") {
      const b = await bacaJson(req);
      const pesan = teks(b.message, "Pesan", 1000);
      const riwayat = (Array.isArray(b.history) ? b.history : [])
        .filter((x) => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string" && x.content.trim())
        .slice(-10)
        .map((x) => ({ role: x.role, content: x.content.slice(0, 1000) }));
      while (riwayat.length && riwayat[0].role !== "user") riwayat.shift(); // API AI mewajibkan diawali pesan pengguna

      const tertahan = saringPesan(pesan); // guardrail SELALU dijalankan lebih dulu
      if (tertahan) return json({ balasan: tertahan.balasan, mode: "aman", jenis: tertahan.jenis });

      const ringkasan = db.ringkasan(ambilTanggal(b.date));
      if (ai.enabled) {
        try {
          batasAi();
          const balasan = await ai.chat(riwayat, pesan, bangunKonteks(ringkasan, db.risikoTerakhir()));
          if (balasan) return json({ balasan, mode: "ai" });
        } catch (e) {
          if (e instanceof HttpError) throw e;
          console.error("[chat]", e.message); // jatuh ke mode dasar
        }
      }
      return json({ balasan: balasDasar(pesan, ringkasan), mode: "dasar" });
    }

    throw new HttpError(404, "Endpoint tidak ditemukan.");
  }

  async function statis(pathname) {
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return null; }
    if (rel === "/") rel = "/index.html";
    const penuh = normalize(join(PUBLIC_DIR, rel));
    if (!penuh.startsWith(PUBLIC_DIR + sep)) return null; // cegah path traversal
    const file = Bun.file(penuh);
    if (!(await file.exists())) return null;
    return new Response(file, { headers: HEADER_KEAMANAN });
  }

  return async function handler(req) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, url);
      if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Metode tidak diizinkan.");
      return (await statis(url.pathname)) ?? json({ error: "Halaman tidak ditemukan." }, 404);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error("[error]", e);
      return json({ error: "Terjadi kesalahan di server." }, 500);
    }
  };
}
