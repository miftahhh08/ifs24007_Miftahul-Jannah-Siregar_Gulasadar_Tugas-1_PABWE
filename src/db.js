// Penyimpanan SQLite memakai modul bawaan Bun (bun:sqlite) - tanpa dependensi tambahan.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BATAS_GULA_G, GRAM_PER_SDM, round1 } from "./foods.js";

export function geserTanggal(tanggal, hari) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

export function tanggalLokal(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function createDb(path = "data/gulasadar.db") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      nama TEXT NOT NULL,
      porsi TEXT,
      qty REAL NOT NULL,
      gula REAL NOT NULL,
      karbo REAL NOT NULL,
      tambahan INTEGER NOT NULL,
      lampu TEXT NOT NULL,
      dibuat TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_food_tanggal ON food_logs (tanggal);
    CREATE TABLE IF NOT EXISTS glucose_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      nilai REAL NOT NULL,
      konteks TEXT NOT NULL,
      level TEXT NOT NULL,
      dibuat TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jawaban TEXT NOT NULL,
      hasil TEXT NOT NULL,
      dibuat TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const q = (sql) => db.query(sql);
  const toLog = (r) => ({ ...r, tambahan: Boolean(r.tambahan) });

  return {
    raw: db,
    close: () => db.close(),

    tambahLog({ tanggal, nama, porsi, qty, gula, karbo, tambahan, lampu }) {
      const info = q(
        "INSERT INTO food_logs (tanggal, nama, porsi, qty, gula, karbo, tambahan, lampu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(tanggal, nama, porsi ?? null, qty, gula, karbo, tambahan ? 1 : 0, lampu);
      return toLog(q("SELECT * FROM food_logs WHERE id = ?").get(info.lastInsertRowid));
    },
    daftarLog: (tanggal) => q("SELECT * FROM food_logs WHERE tanggal = ? ORDER BY id").all(tanggal).map(toLog),
    hapusLog: (id) => q("DELETE FROM food_logs WHERE id = ?").run(id).changes > 0,

    /** Ringkasan satu hari + 7 hari terakhir + streak. */
    ringkasan(tanggal) {
      const harian = (t) =>
        q(
          `SELECT COALESCE(SUM(CASE WHEN tambahan = 1 THEN gula ELSE 0 END), 0) AS tambahan,
                  COALESCE(SUM(CASE WHEN tambahan = 0 THEN gula ELSE 0 END), 0) AS alami,
                  COALESCE(SUM(karbo), 0) AS karbo, COUNT(*) AS jumlah
           FROM food_logs WHERE tanggal = ?`,
        ).get(t);
      const hariIni = harian(tanggal);
      const persen = Math.round((hariIni.tambahan / BATAS_GULA_G) * 100);
      const status = persen > 100 ? "merah" : persen >= 70 ? "kuning" : "hijau";

      const minggu = [];
      for (let i = 6; i >= 0; i--) {
        const t = geserTanggal(tanggal, -i);
        minggu.push({ tanggal: t, tambahan: round1(harian(t).tambahan) });
      }

      // Streak: hari berurutan dengan catatan dan gula tambahan <= batas.
      const ada = new Map(
        q("SELECT tanggal, SUM(CASE WHEN tambahan = 1 THEN gula ELSE 0 END) AS g FROM food_logs WHERE tanggal <= ? GROUP BY tanggal")
          .all(tanggal)
          .map((r) => [r.tanggal, r.g]),
      );
      let streak = 0;
      let t = ada.has(tanggal) ? tanggal : geserTanggal(tanggal, -1);
      while (ada.has(t) && ada.get(t) <= BATAS_GULA_G) {
        streak++;
        t = geserTanggal(t, -1);
      }

      return {
        tanggal, batas: BATAS_GULA_G, gramPerSdm: GRAM_PER_SDM,
        tambahan: round1(hariIni.tambahan), alami: round1(hariIni.alami), karbo: round1(hariIni.karbo),
        jumlahCatatan: hariIni.jumlah, persen, status,
        sdm: round1(hariIni.tambahan / GRAM_PER_SDM),
        sisa: round1(Math.max(0, BATAS_GULA_G - hariIni.tambahan)),
        streak, minggu,
      };
    },

    tambahGlukosa({ tanggal, nilai, konteks, level }) {
      const info = q("INSERT INTO glucose_logs (tanggal, nilai, konteks, level) VALUES (?, ?, ?, ?)").run(tanggal, nilai, konteks, level);
      return q("SELECT * FROM glucose_logs WHERE id = ?").get(info.lastInsertRowid);
    },
    daftarGlukosa: (limit = 30) => q("SELECT * FROM glucose_logs ORDER BY tanggal DESC, id DESC LIMIT ?").all(limit),
    hapusGlukosa: (id) => q("DELETE FROM glucose_logs WHERE id = ?").run(id).changes > 0,

    simpanRisiko(jawaban, hasil) {
      q("INSERT INTO risk_assessments (jawaban, hasil) VALUES (?, ?)").run(JSON.stringify(jawaban), JSON.stringify(hasil));
    },
    risikoTerakhir() {
      const r = q("SELECT * FROM risk_assessments ORDER BY id DESC LIMIT 1").get();
      return r ? { jawaban: JSON.parse(r.jawaban), hasil: JSON.parse(r.hasil), dibuat: r.dibuat } : null;
    },
  };
}
