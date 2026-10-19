// Pagar keamanan (guardrails) yang berjalan SEBELUM pesan sampai ke AI.
// Tujuan: kondisi darurat dan pertanyaan dosis obat tidak pernah dijawab oleh chatbot.
import { norm } from "./foods.js";

const DARURAT = [
  "pingsan", "tidak sadar", "tak sadar", "kejang", "sesak napas", "sesak nafas",
  "napas berbau", "nafas berbau", "nyeri dada", "muntah terus", "bunuh diri",
];
const OBAT = [
  "dosis", "insulin", "metformin", "glibenklamid", "glimepirid", "obat diabetes",
  "suntik", "berapa tablet", "stop obat", "berhenti minum obat", "hentikan obat", "ganti obat",
];

const cocok = (teks, daftar) => daftar.some((k) => ` ${teks} `.includes(` ${k} `));

export function saringPesan(pesan) {
  const t = norm(pesan);
  if (cocok(t, DARURAT)) {
    return {
      jenis: "darurat",
      balasan:
        "Yang kamu ceritakan bisa jadi kondisi darurat. Segera hubungi 112 atau pergi ke IGD/fasilitas kesehatan terdekat, dan minta orang di sekitarmu menemani. Aku tidak bisa menggantikan penanganan medis langsung.",
    };
  }
  if (cocok(t, OBAT)) {
    return {
      jenis: "obat",
      balasan:
        "Soal obat, dosis, atau insulin, aku tidak bisa memberi saran karena salah dosis bisa berbahaya. Tanyakan langsung ke dokter atau apoteker yang menangani kamu. Kalau mau, aku bisa bantu menyiapkan daftar pertanyaan untuk konsultasi.",
    };
  }
  return null;
}
