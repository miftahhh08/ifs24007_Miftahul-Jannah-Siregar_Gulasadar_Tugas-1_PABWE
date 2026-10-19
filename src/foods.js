// Basis data makanan & minuman Indonesia.
// PENTING: angka adalah ESTIMASI per porsi umum untuk edukasi (bukan data laboratorium).
// Rujukan verifikasi: Tabel Komposisi Pangan Indonesia (TKPI, Kemenkes) dan label kemasan.
// Prinsip desain: AI hanya MENGENALI makanan; ANGKA gizi selalu diambil dari tabel ini.

export const BATAS_GULA_G = 50; // anjuran Kemenkes: maks. 50 g (4 sdm) gula per hari
export const GRAM_PER_SDM = 12.5; // 1 sendok makan ~ 12,5 g (50 g / 4 sdm)

// gi = indeks glikemik kasar; tambahan = gula tambahan (true) atau gula alami/bawaan (false)
const F = (id, nama, porsi, gula, karbo, gi, tambahan, kategori, alias = []) => ({
  id, nama, porsi, gula, karbo, gi, tambahan, kategori, alias,
});

export const FOODS = [
  // Minuman
  F("es-teh-manis", "Es teh manis", "1 gelas (250 ml)", 20, 21, "tinggi", true, "minuman", ["teh manis dingin", "es teh"]),
  F("teh-manis-hangat", "Teh manis hangat", "1 gelas (250 ml)", 18, 19, "tinggi", true, "minuman", ["teh manis"]),
  F("teh-tawar", "Teh tawar", "1 gelas (250 ml)", 0, 0, null, false, "minuman", ["es teh tawar", "teh pahit"]),
  F("kopi-hitam", "Kopi hitam tanpa gula", "1 cangkir (150 ml)", 0, 0, null, false, "minuman", ["kopi pahit", "kopi tanpa gula"]),
  F("kopi-susu-gula-aren", "Kopi susu gula aren", "1 cup (350 ml)", 30, 34, "tinggi", true, "minuman", ["kopi susu kekinian", "kopi susu"]),
  F("kopi-sachet", "Kopi instan 3 in 1", "1 sachet", 13, 17, "tinggi", true, "minuman", ["kopi sachet", "kopi instan"]),
  F("susu-kental-manis", "Susu kental manis", "1 sendok makan (20 g)", 10, 11, "tinggi", true, "minuman", ["skm"]),
  F("boba-milk-tea", "Boba milk tea", "1 cup (500 ml)", 40, 55, "tinggi", true, "minuman", ["boba", "bubble tea"]),
  F("minuman-soda", "Minuman bersoda", "1 kaleng (330 ml)", 35, 35, "tinggi", true, "minuman", ["soda", "cola", "minuman bersoda"]),
  F("es-sirup", "Es sirup", "1 gelas (250 ml)", 25, 25, "tinggi", true, "minuman", ["sirup"]),
  F("jus-jeruk-murni", "Jus jeruk tanpa gula tambahan", "1 gelas (250 ml)", 20, 22, "sedang", false, "minuman", ["jus jeruk", "air jeruk"]),
  F("jus-alpukat-cokelat", "Jus alpukat susu cokelat", "1 gelas (300 ml)", 28, 35, "sedang", true, "minuman", ["jus alpukat"]),
  F("susu-sapi", "Susu sapi tawar", "1 gelas (200 ml)", 9, 10, "rendah", false, "minuman", ["susu segar", "susu"]),
  F("air-putih", "Air putih", "1 gelas (250 ml)", 0, 0, null, false, "minuman", ["air mineral", "air"]),
  F("es-campur", "Es campur / es teler", "1 mangkuk", 32, 45, "tinggi", true, "minuman", ["es teler", "es buah"]),
  F("es-cendol", "Es cendol / dawet", "1 mangkuk", 30, 45, "tinggi", true, "minuman", ["cendol", "dawet"]),
  // Makanan pokok
  F("nasi-putih", "Nasi putih", "1 piring (150 g)", 0, 42, "tinggi", false, "makanan", []),
  F("nasi-merah", "Nasi merah", "1 piring (150 g)", 0, 38, "sedang", false, "makanan", []),
  F("nasi-goreng", "Nasi goreng", "1 piring", 4, 52, "tinggi", true, "makanan", []),
  F("mie-instan-goreng", "Mie instan goreng", "1 bungkus", 4, 54, "tinggi", true, "makanan", ["indomie", "mie goreng", "mi instan"]),
  F("bubur-ayam", "Bubur ayam", "1 mangkuk", 2, 40, "tinggi", false, "makanan", ["bubur"]),
  F("lontong", "Lontong / ketupat", "2 potong", 0, 36, "tinggi", false, "makanan", ["ketupat"]),
  F("singkong-rebus", "Singkong rebus", "1 potong (100 g)", 1, 38, "sedang", false, "makanan", ["singkong"]),
  F("ubi-rebus", "Ubi rebus", "1 buah sedang", 6, 27, "sedang", false, "makanan", ["ubi jalar", "ubi"]),
  F("jagung-rebus", "Jagung rebus", "1 tongkol", 5, 25, "sedang", false, "makanan", ["jagung"]),
  F("oatmeal", "Oatmeal tanpa gula", "1 mangkuk", 1, 27, "rendah", false, "makanan", ["oat"]),
  F("roti-tawar", "Roti tawar putih", "2 lembar", 3, 25, "tinggi", true, "makanan", ["roti"]),
  F("roti-cokelat", "Roti isi cokelat / selai", "1 buah", 15, 40, "tinggi", true, "makanan", ["roti cokelat", "roti selai"]),
  // Lauk & sayur
  F("ayam-goreng", "Ayam goreng", "1 potong", 0, 5, "rendah", false, "lauk", []),
  F("tempe-goreng", "Tempe goreng", "2 potong", 0, 6, "rendah", false, "lauk", ["tempe"]),
  F("tahu-goreng", "Tahu goreng", "2 potong", 0, 4, "rendah", false, "lauk", ["tahu"]),
  F("telur-rebus", "Telur rebus", "1 butir", 0, 1, "rendah", false, "lauk", ["telur"]),
  F("ikan-bakar", "Ikan bakar", "1 potong", 0, 0, "rendah", false, "lauk", ["ikan"]),
  F("sate-ayam", "Sate ayam bumbu kacang", "10 tusuk", 8, 20, "sedang", true, "lauk", ["sate"]),
  F("bakso", "Bakso", "1 mangkuk", 3, 38, "sedang", false, "lauk", []),
  F("soto-ayam", "Soto ayam tanpa nasi", "1 mangkuk", 2, 12, "rendah", false, "lauk", ["soto"]),
  F("gado-gado", "Gado-gado", "1 piring", 6, 30, "sedang", true, "lauk", ["pecel"]),
  F("capcay", "Capcay sayur", "1 piring", 3, 12, "rendah", false, "lauk", ["cap cay", "tumis sayur"]),
  F("sayur-bening", "Sayur bening", "1 mangkuk", 1, 8, "rendah", false, "lauk", ["sayur"]),
  // Jajanan
  F("gorengan", "Gorengan (bakwan / tahu isi)", "1 buah", 1, 12, "sedang", false, "jajanan", ["bakwan"]),
  F("pisang-goreng", "Pisang goreng", "1 buah", 8, 30, "tinggi", true, "jajanan", []),
  F("martabak-manis", "Martabak manis", "1 potong", 22, 40, "tinggi", true, "jajanan", ["terang bulan"]),
  F("martabak-telur", "Martabak telur", "1 potong", 2, 25, "sedang", false, "jajanan", []),
  F("donat-gula", "Donat bertabur gula", "1 buah", 14, 30, "tinggi", true, "jajanan", ["donat"]),
  F("klepon", "Klepon", "3 buah", 14, 35, "tinggi", true, "jajanan", []),
  F("kolak-pisang", "Kolak pisang", "1 mangkuk", 30, 55, "tinggi", true, "jajanan", ["kolak"]),
  F("biskuit-manis", "Biskuit manis", "4 keping", 8, 20, "tinggi", true, "jajanan", ["biskuit"]),
  F("cokelat-batang", "Cokelat batang", "40 g", 20, 24, "sedang", true, "jajanan", ["coklat"]),
  F("permen", "Permen", "3 butir", 10, 12, "tinggi", true, "jajanan", []),
  F("es-krim", "Es krim", "1 cup kecil", 15, 20, "sedang", true, "jajanan", []),
  F("keripik-kentang", "Keripik kentang", "1 bungkus kecil", 1, 15, "tinggi", false, "jajanan", ["keripik"]),
  F("yogurt-buah", "Yogurt rasa buah", "1 cup (150 g)", 15, 20, "sedang", true, "jajanan", ["yoghurt buah"]),
  F("yogurt-plain", "Yogurt plain", "1 cup (150 g)", 5, 7, "rendah", false, "jajanan", ["yoghurt plain", "yogurt tawar"]),
  // Buah utuh
  F("pisang", "Pisang", "1 buah sedang", 14, 27, "sedang", false, "buah", []),
  F("apel", "Apel", "1 buah sedang", 15, 22, "rendah", false, "buah", []),
  F("jeruk", "Jeruk", "1 buah", 9, 15, "rendah", false, "buah", []),
  F("pepaya", "Pepaya", "1 potong (150 g)", 8, 15, "sedang", false, "buah", []),
  F("semangka", "Semangka", "1 potong (200 g)", 9, 12, "tinggi", false, "buah", []),
  F("mangga", "Mangga", "1 buah", 20, 28, "sedang", false, "buah", []),
  F("alpukat", "Alpukat", "1/2 buah", 1, 9, "rendah", false, "buah", []),
  // Pemanis
  F("gula-pasir-sdt", "Gula pasir 1 sendok teh", "1 sendok teh", 4, 4, "tinggi", true, "pemanis", ["gula sendok teh"]),
  F("gula-pasir-sdm", "Gula pasir 1 sendok makan", "1 sendok makan", 12, 12, "tinggi", true, "pemanis", ["gula sendok makan"]),
  F("madu", "Madu", "1 sendok makan", 17, 17, "tinggi", true, "pemanis", []),
];

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));
export const getFood = (id) => BY_ID.get(id) ?? null;

export const round1 = (n) => Math.round(n * 10) / 10;

export function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pencarian untuk kolom ketik: skor 100 = persis, 70 = mengandung, 50 = semua kata cocok. */
export function searchFoods(query, limit = 8) {
  const nq = norm(query);
  if (!nq) return [];
  const tokens = nq.split(" ");
  return FOODS.map((food) => {
    const names = [food.nama, ...food.alias].map(norm);
    let score = 0;
    if (names.includes(nq)) score = 100;
    else if (names.some((n) => n.includes(nq))) score = 70;
    else {
      const words = names.join(" ").split(" ");
      const hit = tokens.filter((t) => words.some((w) => w.startsWith(t))).length;
      score = hit === tokens.length ? 50 : Math.round((hit / tokens.length) * 30);
    }
    return { food, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.food.nama.localeCompare(b.food.nama, "id"))
    .slice(0, limit);
}

/** Mencari makanan yang disebut di dalam kalimat bebas (untuk chatbot). Nama terpanjang menang. */
export function findFoodInText(text) {
  const padded = ` ${norm(text)} `;
  let best = null;
  for (const food of FOODS) {
    for (const name of [food.nama, ...food.alias].map(norm)) {
      if (name.length >= 3 && padded.includes(` ${name} `) && (!best || name.length > best.len)) {
        best = { food, len: name.length };
      }
    }
  }
  return best?.food ?? null;
}

/**
 * Sistem lampu lalu lintas. Mengembalikan { lampu, alasan }.
 * item: { gula, karbo, gi, tambahan } untuk SATU satuan; qty = jumlah porsi.
 */
export function lampuInfo(item, qty = 1) {
  const gula = item.gula * qty;
  const karbo = item.karbo * qty;
  const persen = Math.round((gula / BATAS_GULA_G) * 100);
  if (item.tambahan && gula >= 20) {
    return { lampu: "merah", alasan: `Mengandung sekitar ${round1(gula)} g gula, kira-kira ${persen}% dari batas harian.` };
  }
  if (item.tambahan && gula >= 8) {
    return { lampu: "kuning", alasan: `Mengandung sekitar ${round1(gula)} g gula (${persen}% dari batas harian). Boleh, tapi hitung jatahmu.` };
  }
  if (item.gi === "tinggi" && karbo >= 35) {
    return { lampu: "kuning", alasan: "Karbohidrat banyak dengan indeks glikemik tinggi. Imbangi dengan sayur dan lauk berprotein." };
  }
  if (!item.tambahan && gula >= 20) {
    return { lampu: "kuning", alasan: `Gula alami cukup banyak (${round1(gula)} g). Lebih baik dari gula tambahan, tapi perhatikan porsinya.` };
  }
  return { lampu: "hijau", alasan: gula === 0 ? "Tidak mengandung gula." : "Kandungan gula rendah." };
}

/** Bentuk respons API untuk satu makanan dengan jumlah porsi tertentu. */
export function bentukItem(food, qty = 1) {
  const { lampu, alasan } = lampuInfo(food, qty);
  return {
    id: food.id, nama: food.nama, porsi: food.porsi, kategori: food.kategori,
    gi: food.gi, tambahan: food.tambahan, qty,
    gula: round1(food.gula * qty), karbo: round1(food.karbo * qty),
    sdm: round1((food.gula * qty) / GRAM_PER_SDM),
    lampu, alasan,
  };
}
