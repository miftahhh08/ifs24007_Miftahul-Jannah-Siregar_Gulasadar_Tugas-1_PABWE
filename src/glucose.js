// Klasifikasi kasar kadar gula darah (mg/dL) untuk edukasi - BUKAN diagnosis.
// Acuan umum: gula darah puasa <100 normal, 100-125 perlu perhatian, >=126 tinggi;
// 2 jam setelah makan / sewaktu <140 normal, 140-199 perlu perhatian, >=200 tinggi.
import { HttpError } from "./errors.js";

export const KONTEKS = ["puasa", "sesudah_makan", "sewaktu"];

export function klasifikasiGlukosa(nilai, konteks) {
  if (!KONTEKS.includes(konteks)) throw new HttpError(400, "Waktu pengukuran tidak dikenali.");
  if (!Number.isFinite(nilai) || nilai < 20 || nilai > 600) {
    throw new HttpError(400, "Nilai gula darah harus antara 20 dan 600 mg/dL.");
  }
  const NOTE = " Ini bukan diagnosis; konfirmasi lewat pemeriksaan laboratorium.";
  if (nilai < 70) {
    return { level: "rendah", label: "Terlalu rendah", pesan: "Di bawah 70 mg/dL. Segera konsumsi sumber gula cepat (misalnya teh manis atau permen), ukur ulang, dan cari bantuan medis bila gejala menetap." };
  }
  const [atasNormal, atasPerhatian] = konteks === "puasa" ? [100, 126] : [140, 200];
  if (nilai >= 300) {
    return { level: "tinggi", label: "Sangat tinggi", pesan: "Nilai sangat tinggi. Segera ke fasilitas kesehatan, terutama jika disertai lemas, mual, atau sangat haus." + NOTE };
  }
  if (nilai >= atasPerhatian) {
    return { level: "tinggi", label: "Tinggi", pesan: "Di atas rentang normal. Jadwalkan pemeriksaan ke tenaga kesehatan." + NOTE };
  }
  if (nilai >= atasNormal) {
    return { level: "perhatian", label: "Perlu perhatian", pesan: "Di atas normal tetapi belum setinggi ambang tinggi. Perbaiki pola makan dan ulangi pengukuran." + NOTE };
  }
  return { level: "normal", label: "Normal", pesan: "Dalam rentang normal. Pertahankan gaya hidup sehat." };
}
