# GulaSadar

> Kenali gula di piringmu. Aplikasi web pencegahan diabetes yang membantu orang menjaga **jatah gula harian**, mengenali makanan bergula, mengecek risiko, dan bertanya pada **Sobat Gula** (chatbot).

Proyek Tugas I mata kuliah **11S3133 Pengembangan Aplikasi Berbasis Web**: membangun program sederhana dengan **Generative AI sebagai asisten pemrograman**, lengkap dengan evaluasi kritis terhadap kode yang dihasilkan. Dokumen proposal dan catatan proses ada di folder [`docs/`](docs/).

Aplikasi ini terinspirasi dari pengalaman keluarga dengan diabetes. Tujuannya sederhana: membuat pencegahan terasa konkret, misalnya "jatahmu 4 sendok makan gula per hari" dan bukan sekadar angka gram.

## Fitur

| Fitur | Keterangan |
|---|---|
| **Jatah gula harian** | Visual 4 sendok makan (batas 50 g/hari, anjuran Kemenkes), catatan makan, grafik 7 hari, dan rangkaian hari sehat (streak). |
| **Pindai makanan** | Tiga cara: ketik nama (60+ makanan Indonesia), foto makanan (AI), atau hitung dari label kemasan. Hasil berupa lampu lalu lintas hijau/kuning/merah. |
| **Cek risiko** | Skrining 10 pertanyaan, diadaptasi dari FINDRISC (skor 0-26) dengan ambang Asia. Termasuk riwayat keluarga. |
| **Sobat Gula** | Chatbot edukasi. Mode dasar (offline, berbasis aturan) atau mode AI. Dilindungi pagar keamanan. |
| **Gula darah** | Catatan dan grafik gula darah dengan klasifikasi edukatif. |

### Prinsip desain yang penting
1. **AI mengenali, database yang menghitung.** Saat AI melihat foto, ia hanya memilih `id` makanan dari daftar kita. Angka gula selalu diambil dari tabel (`src/foods.js`), jadi tidak ada angka karangan. `id` yang tidak ada di tabel dibuang.
2. **Berjalan tanpa API key.** Tanpa AI pun aplikasi penuh bisa dipakai (pencarian database + chatbot berbasis aturan). Dosen dan asisten bisa menjalankannya tanpa konfigurasi.
3. **Pagar keamanan sebelum AI.** Pesan darurat (pingsan, napas berbau buah, dll.) dialihkan ke 112, dan pertanyaan dosis/obat/insulin ditolak. Keduanya **tidak pernah diteruskan ke AI**.
4. **Privasi.** Server hanya mendengarkan `127.0.0.1`, data disimpan lokal di SQLite, dan tidak ada akun maupun pelacak.

## Menjalankan di localhost

Prasyarat: [Bun](https://bun.sh) 1.1 atau lebih baru.

```bash
# 1. Pasang Bun (jika belum)
curl -fsSL https://bun.sh/install | bash          # macOS/Linux
powershell -c "irm bun.sh/install.ps1 | iex"      # Windows

# 2. Ambil kode
git clone <URL-REPOSITORI-KAMU>.git
cd gulasadar

# 3. Jalankan (tanpa dependensi untuk di-install)
bun start
```

Buka **http://localhost:3000**. Mode pengembangan dengan auto-reload: `bun run dev`.

### (Opsional) Mengaktifkan mode AI
```bash
cp .env.example .env
# isi ANTHROPIC_API_KEY=... lalu jalankan ulang
```
Dengan API key aktif, chatbot dijawab AI dan fitur **Foto makanan** menyala. Jika layanan AI gagal, chatbot otomatis kembali ke mode dasar.

## Pengujian

```bash
bun test
```
50 tes otomatis mencakup database makanan, lampu lalu lintas, skrining risiko, klasifikasi gula darah, guardrail chatbot, validasi input API, path traversal, header keamanan, dan skenario AI palsu (mock): AI mengarang id makanan, AI gagal, dan pesan dosis obat yang tidak boleh sampai ke AI.

## Struktur proyek

```
gulasadar/
├── src/
│   ├── server.js     # titik masuk Bun.serve (127.0.0.1:3000)
│   ├── app.js        # router API + file statis + header keamanan
│   ├── db.js         # SQLite (bun:sqlite): catatan makan, gula darah, risiko
│   ├── foods.js      # database makanan, pencarian, lampu lalu lintas
│   ├── risk.js       # skrining risiko (adaptasi FINDRISC)
│   ├── glucose.js    # klasifikasi gula darah
│   ├── safety.js     # guardrail: darurat & dosis obat
│   ├── chat.js       # system prompt + chatbot mode dasar
│   ├── ai.js         # klien AI opsional (chat + pengenal foto)
│   └── errors.js
├── public/           # front-end vanilla JS (tanpa build), font lokal
├── tests/            # bun test
├── docs/screenshots/ # tangkapan layar aplikasi
└── data/             # database SQLite (dibuat otomatis, tidak di-commit)
```

## API ringkas

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/foods?q=` | cari makanan |
| POST | `/api/label` | hitung gula dari label kemasan |
| POST | `/api/scan/photo` | kenali makanan dari foto (butuh AI) |
| GET/POST/DELETE | `/api/log` | catatan makan |
| GET | `/api/summary?date=` | ringkasan harian, 7 hari, streak |
| POST | `/api/risk`, GET `/api/risk/latest` | skrining risiko |
| GET/POST/DELETE | `/api/glucose` | catatan gula darah |
| POST | `/api/chat` | Sobat Gula |

## Keterbatasan (jujur)
- Angka gizi di `src/foods.js` adalah **estimasi** per porsi umum. Untuk kebutuhan serius, verifikasi dengan Tabel Komposisi Pangan Indonesia (TKPI) dan label kemasan.
- Skrining risiko adalah **adaptasi** FINDRISC dengan ambang Asia yang perlu divalidasi tenaga kesehatan sebelum dipakai luas.
- Aplikasi ini **alat edukasi**, bukan alat diagnosis dan bukan pengganti dokter.
- Satu pengguna per instalasi (tanpa akun), karena dirancang untuk dipakai lokal.

## Lisensi
MIT. Font Bricolage Grotesque dan Public Sans berlisensi SIL OFL (lihat `public/fonts/`).
