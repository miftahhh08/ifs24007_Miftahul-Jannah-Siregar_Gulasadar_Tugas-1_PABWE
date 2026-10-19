// Chatbot "Sobat Gula": mode dasar (berbasis aturan, offline) dan prompt untuk mode AI.
import { findFoodInText, bentukItem, norm, BATAS_GULA_G } from "./foods.js";

export const SYSTEM_PROMPT = `Kamu adalah "Sobat Gula", pendamping edukasi pencegahan diabetes untuk pengguna di Indonesia.
Aturan wajib:
1. Jawab dalam bahasa Indonesia yang hangat, singkat (maksimal 150 kata), dan mudah dipahami.
2. Kamu BUKAN dokter. Jangan mendiagnosis, jangan menyarankan atau mengubah dosis obat/insulin, dan jangan meminta pengguna menghentikan obat.
3. Jika pengguna menyebut gejala darurat (pingsan, kejang, sesak napas, napas berbau buah, nyeri dada), minta segera ke IGD atau hubungi 112.
4. Untuk gejala seperti sering haus, sering buang air kecil, luka lama sembuh, berat badan turun tanpa sebab, anjurkan periksa ke fasilitas kesehatan.
5. Batas gula tambahan yang dianjurkan Kemenkes: ${BATAS_GULA_G} gram (4 sendok makan) per hari.
6. Jangan mengarang angka gizi. Jika diberi data makanan dari database, pakai angka itu; jika tidak ada, katakan angkanya perkiraan dan sarankan membaca label kemasan.
7. Tolak dengan sopan topik di luar kesehatan dan gaya hidup sehat.
8. Pengguna mungkin pernah kehilangan keluarga karena diabetes; tanggapi dengan empati, tanpa menakut-nakuti.`;

/** Konteks ringkas yang ditempelkan ke prompt AI agar jawaban personal. */
export function bangunKonteks(ringkasan, risiko) {
  const baris = [];
  if (ringkasan) baris.push(`Gula tambahan hari ini: ${ringkasan.tambahan} g dari batas ${ringkasan.batas} g.`);
  if (risiko?.hasil) baris.push(`Hasil skrining risiko terakhir: ${risiko.hasil.label} (skor ${risiko.hasil.skor}/${risiko.hasil.skorMaks}).`);
  return baris.join("\n");
}

const has = (t, ...kata) => kata.some((k) => t.includes(k));

export function balasDasar(pesan, ringkasan) {
  const t = norm(pesan);

  const makanan = findFoodInText(pesan);
  if (makanan) {
    const it = bentukItem(makanan);
    const status = { hijau: "aman dikonsumsi", kuning: "perlu hati-hati", merah: "tinggi gula" }[it.lampu];
    return `${it.nama} (${it.porsi}) kira-kira mengandung ${it.gula} g gula, setara ${it.sdm} sendok makan. Penilaianku: ${status}. ${it.alasan}\n\nAngka ini perkiraan. Untuk produk kemasan, cek label gizi.`;
  }
  if (has(t, "halo", "hai ", "selamat pagi", "selamat siang", "selamat malam") || t === "hai") {
    return "Halo! Aku Sobat Gula. Aku bisa bantu menjelaskan batas gula harian, gejala awal diabetes, cara mencegahnya, dan menilai makanan yang kamu makan. Mau mulai dari mana?";
  }
  if (has(t, "batas", "maksimal", "berapa banyak gula", "berapa gula")) {
    const sisa = ringkasan ? ` Hari ini kamu sudah memakai ${ringkasan.tambahan} g.` : "";
    return `Kemenkes menganjurkan gula tambahan maksimal ${BATAS_GULA_G} gram per hari, setara 4 sendok makan.${sisa} Satu gelas es teh manis saja sudah sekitar 20 g.`;
  }
  if (has(t, "gejala", "tanda", "ciri")) {
    return "Gejala awal diabetes yang perlu diwaspadai:\n- sering haus dan sering buang air kecil, terutama malam hari\n- cepat lapar dan lemas\n- berat badan turun tanpa sebab\n- luka lama sembuh, penglihatan kabur, kesemutan\n\nKadang diabetes tidak bergejala, jadi cek gula darah berkala itu penting. Kalau kamu mengalami tanda di atas, periksa ke puskesmas atau dokter.";
  }
  if (has(t, "ayah", "ibu", "orang tua", "keturunan", "riwayat", "genetik", "keluarga")) {
    return "Riwayat keluarga memang menaikkan risiko, tetapi bukan takdir. Gaya hidup sangat berpengaruh: jaga berat badan, kurangi minuman manis, aktif bergerak, dan cek gula darah berkala. Coba juga menu Cek Risiko untuk melihat posisimu, lalu tanyakan ke dokter kapan sebaiknya mulai skrining rutin.";
  }
  if (has(t, "cegah", "pencegahan", "hindari", "terhindar", "tips")) {
    return "Langkah pencegahan yang paling berdampak:\n- ganti minuman manis dengan air putih atau teh tawar\n- batasi gula tambahan di bawah 50 g per hari\n- jalan cepat minimal 150 menit per minggu\n- perbanyak sayur, buah utuh, dan serat; kurangi nasi porsi besar\n- jaga berat badan dan lingkar pinggang\n- cek gula darah berkala";
  }
  if (has(t, "menu", "sarapan", "makan siang", "makan malam", "rekomendasi")) {
    return "Contoh menu seimbang: nasi merah atau nasi setengah porsi, lauk tempe atau ikan bakar, sayur bening atau capcay, buah utuh sebagai penutup, dan teh tawar atau air putih. Hindari menambah gula di minuman.";
  }
  if (has(t, "mitos", "benarkah", "manis")) {
    return "Diabetes tidak hanya disebabkan makanan manis. Penyebabnya kombinasi genetik, berat badan berlebih, dan gaya hidup. Tapi gula berlebih ikut berperan karena menambah kalori dan berat badan, jadi tetap perlu dibatasi.";
  }
  return "Aku bisa membantu soal batas gula harian, gejala awal diabetes, pencegahan, dan menilai makanan. Coba tanya misalnya: \"Apakah es teh manis berbahaya?\" atau \"Bagaimana mencegah diabetes?\"";
}
