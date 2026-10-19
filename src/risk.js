// Skrining risiko diabetes tipe 2 - ADAPTASI dari kuesioner FINDRISC (skor maks. 26).
// Ini alat EDUKASI, bukan diagnosis. Ambang BMI & lingkar pinggang disesuaikan untuk populasi Asia.
import { HttpError } from "./errors.js";

const angka = (v, nama, min, max) => {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isFinite(n) || n < min || n > max) {
    throw new HttpError(400, `${nama} harus berupa angka antara ${min} dan ${max}.`);
  }
  return n;
};

export const SKOR_MAKS = 26;

export function hitungRisiko(input = {}) {
  const umur = angka(input.umur, "Umur", 18, 110);
  const tinggi = angka(input.tinggiCm, "Tinggi badan (cm)", 100, 230);
  const berat = angka(input.beratKg, "Berat badan (kg)", 25, 300);
  const pinggang = angka(input.pinggangCm, "Lingkar pinggang (cm)", 40, 200);
  const jk = input.jenisKelamin;
  if (jk !== "L" && jk !== "P") throw new HttpError(400, "Pilih jenis kelamin (L atau P).");
  const keluarga = input.riwayatKeluarga ?? "tidak";
  if (!["tidak", "kerabat", "keluarga_inti"].includes(keluarga)) {
    throw new HttpError(400, "Riwayat keluarga tidak dikenali.");
  }

  const bmi = berat / (tinggi / 100) ** 2;
  const rincian = [];
  const tambah = (faktor, poin, keterangan) => rincian.push({ faktor, poin, keterangan });

  // Umur
  if (umur >= 65) tambah("Umur", 4, "65 tahun ke atas");
  else if (umur >= 55) tambah("Umur", 3, "55-64 tahun");
  else if (umur >= 45) tambah("Umur", 2, "45-54 tahun");
  else tambah("Umur", 0, "di bawah 45 tahun");

  // BMI (batas Asia: >= 23 berat berlebih, >= 27 obesitas)
  if (bmi >= 27) tambah("Indeks massa tubuh", 3, `BMI ${bmi.toFixed(1)} (obesitas)`);
  else if (bmi >= 23) tambah("Indeks massa tubuh", 1, `BMI ${bmi.toFixed(1)} (berat badan berlebih)`);
  else tambah("Indeks massa tubuh", 0, `BMI ${bmi.toFixed(1)} (normal)`);

  // Lingkar pinggang (obesitas sentral Asia: L >= 90 cm, P >= 80 cm)
  const [batasSedang, batasTinggi] = jk === "L" ? [90, 102] : [80, 88];
  if (pinggang > batasTinggi) tambah("Lingkar pinggang", 4, `${pinggang} cm (tinggi)`);
  else if (pinggang >= batasSedang) tambah("Lingkar pinggang", 3, `${pinggang} cm (di atas batas sehat)`);
  else tambah("Lingkar pinggang", 0, `${pinggang} cm (dalam batas sehat)`);

  if (input.aktifFisik !== true) tambah("Aktivitas fisik", 2, "kurang dari 30 menit hampir setiap hari");
  else tambah("Aktivitas fisik", 0, "aktif hampir setiap hari");

  if (input.sayurBuahHarian !== true) tambah("Sayur dan buah", 1, "tidak dimakan setiap hari");
  else tambah("Sayur dan buah", 0, "dimakan setiap hari");

  if (input.obatHipertensi === true) tambah("Obat hipertensi", 2, "sedang atau pernah minum");
  else tambah("Obat hipertensi", 0, "tidak");

  if (input.gulaDarahTinggi === true) tambah("Gula darah tinggi sebelumnya", 5, "pernah ditemukan");
  else tambah("Gula darah tinggi sebelumnya", 0, "tidak pernah");

  if (keluarga === "keluarga_inti") tambah("Riwayat keluarga", 5, "orang tua, saudara kandung, atau anak");
  else if (keluarga === "kerabat") tambah("Riwayat keluarga", 3, "kakek/nenek, paman/bibi, atau sepupu");
  else tambah("Riwayat keluarga", 0, "tidak ada");

  const skor = rincian.reduce((a, r) => a + r.poin, 0);

  let level, label, ringkasan;
  if (skor >= 15) {
    level = "tinggi"; label = "Risiko tinggi";
    ringkasan = "Banyak faktor risiko terkumpul. Periksakan gula darah ke fasilitas kesehatan dalam waktu dekat.";
  } else if (skor >= 12) {
    level = "sedang"; label = "Risiko sedang";
    ringkasan = "Ada beberapa faktor risiko. Perbaikan gaya hidup sekarang sangat bermanfaat, dan cek gula darah sebaiknya dijadwalkan.";
  } else if (skor >= 7) {
    level = "agak_meningkat"; label = "Risiko agak meningkat";
    ringkasan = "Beberapa faktor risiko mulai muncul. Ini saat yang tepat untuk membangun kebiasaan sehat.";
  } else {
    level = "rendah"; label = "Risiko rendah";
    ringkasan = "Faktor risikomu saat ini sedikit. Pertahankan, dan tetap cek berkala.";
  }

  const saran = [];
  if (skor >= 12) saran.push("Periksa gula darah puasa atau HbA1c di puskesmas, klinik, atau laboratorium.");
  else saran.push("Cek gula darah secara berkala sesuai anjuran tenaga kesehatan.");
  if (keluarga !== "tidak") saran.push("Karena ada riwayat keluarga, tanyakan ke dokter kapan sebaiknya mulai skrining rutin.");
  if (bmi >= 23) saran.push("Turunkan berat badan bertahap. Penurunan 5-7% sudah membantu menurunkan risiko.");
  if (input.aktifFisik !== true) saran.push("Mulai dengan jalan kaki cepat 30 menit, 5 hari seminggu.");
  if (input.sayurBuahHarian !== true) saran.push("Tambahkan sayur dan buah utuh di setiap kali makan besar.");
  saran.push("Ganti minuman manis dengan air putih atau teh tawar. Ini perubahan paling berdampak.");

  return {
    skor, skorMaks: SKOR_MAKS, bmi: Math.round(bmi * 10) / 10,
    level, label, ringkasan, rincian, saran,
    catatan: "Hasil ini skrining edukatif, bukan diagnosis. Diagnosis diabetes hanya lewat pemeriksaan laboratorium oleh tenaga kesehatan.",
  };
}
