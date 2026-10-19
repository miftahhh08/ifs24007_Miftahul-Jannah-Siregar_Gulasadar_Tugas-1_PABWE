import { describe, expect, test } from "bun:test";
import { searchFoods, findFoodInText, lampuInfo, bentukItem, getFood, FOODS } from "../src/foods.js";
import { hitungRisiko } from "../src/risk.js";
import { klasifikasiGlukosa } from "../src/glucose.js";
import { saringPesan } from "../src/safety.js";
import { balasDasar } from "../src/chat.js";
import { ekstrakJson } from "../src/ai.js";

describe("database makanan", () => {
  test("id unik dan semua nilai tidak negatif", () => {
    const ids = FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FOODS) { expect(f.gula).toBeGreaterThanOrEqual(0); expect(f.karbo).toBeGreaterThanOrEqual(0); }
  });
  test("gula tidak pernah melebihi karbohidrat (konsistensi gizi)", () => {
    for (const f of FOODS) expect(f.gula <= f.karbo + 0.001 || f.karbo === 0 && f.gula === 0).toBe(true);
  });
  test("pencarian: nama persis menang", () => {
    expect(searchFoods("es teh manis")[0].food.id).toBe("es-teh-manis");
    expect(searchFoods("teh tawar")[0].food.id).toBe("teh-tawar");
  });
  test("pencarian tidak peka huruf besar dan tanda baca", () => {
    expect(searchFoods("  KOPI, susu!! ")[0].food.id).toBe("kopi-susu-gula-aren");
  });
  test("pencarian kosong mengembalikan array kosong", () => {
    expect(searchFoods("   ")).toEqual([]);
  });
  test("mencari makanan di dalam kalimat", () => {
    expect(findFoodInText("tadi pagi aku minum es teh manis lagi").id).toBe("es-teh-manis");
    expect(findFoodInText("bagaimana cara mencegah diabetes")).toBeNull();
  });
});

describe("lampu lalu lintas", () => {
  test("merah untuk gula tambahan tinggi", () => expect(bentukItem(getFood("es-teh-manis")).lampu).toBe("merah"));
  test("kuning untuk nasi putih (IG tinggi, karbo banyak)", () => expect(bentukItem(getFood("nasi-putih")).lampu).toBe("kuning"));
  test("hijau untuk ikan bakar dan air putih", () => {
    expect(bentukItem(getFood("ikan-bakar")).lampu).toBe("hijau");
    expect(bentukItem(getFood("air-putih")).lampu).toBe("hijau");
  });
  test("menggandakan porsi menaikkan tingkat peringatan", () => {
    expect(lampuInfo(getFood("teh-manis-hangat"), 1).lampu).toBe("kuning");
    expect(lampuInfo(getFood("teh-manis-hangat"), 2).lampu).toBe("merah");
  });
  test("buah utuh dengan gula alami tidak merah", () => expect(bentukItem(getFood("apel")).lampu).not.toBe("merah"));
});

describe("skrining risiko", () => {
  const dasar = { umur: 25, jenisKelamin: "L", tinggiCm: 172, beratKg: 62, pinggangCm: 75, aktifFisik: true, sayurBuahHarian: true, riwayatKeluarga: "tidak" };
  test("profil sehat -> skor 0, risiko rendah", () => {
    const h = hitungRisiko(dasar);
    expect(h.skor).toBe(0);
    expect(h.level).toBe("rendah");
  });
  test("orang tua diabetes menambah 5 poin", () => {
    expect(hitungRisiko({ ...dasar, riwayatKeluarga: "keluarga_inti" }).skor).toBe(5);
  });
  test("skor maksimum 26", () => {
    const h = hitungRisiko({ umur: 70, jenisKelamin: "P", tinggiCm: 150, beratKg: 90, pinggangCm: 110, aktifFisik: false, sayurBuahHarian: false, obatHipertensi: true, gulaDarahTinggi: true, riwayatKeluarga: "keluarga_inti" });
    expect(h.skor).toBe(26);
    expect(h.level).toBe("tinggi");
  });
  test("ambang pinggang berbeda menurut jenis kelamin", () => {
    const l = hitungRisiko({ ...dasar, pinggangCm: 85 }).skor;
    const p = hitungRisiko({ ...dasar, jenisKelamin: "P", pinggangCm: 85 }).skor;
    expect(l).toBe(0); // 85 cm < 90 cm untuk laki-laki
    expect(p).toBe(3); // 85 cm: di rentang 80-88 untuk perempuan
  });
  test("input tidak valid ditolak dengan status 400", () => {
    expect(() => hitungRisiko({ ...dasar, umur: "abc" })).toThrow();
    expect(() => hitungRisiko({ ...dasar, beratKg: -5 })).toThrow();
    expect(() => hitungRisiko({ ...dasar, jenisKelamin: "X" })).toThrow();
    try { hitungRisiko({ ...dasar, umur: "" }); } catch (e) { expect(e.status).toBe(400); }
  });
});

describe("gula darah", () => {
  test("klasifikasi puasa", () => {
    expect(klasifikasiGlukosa(90, "puasa").level).toBe("normal");
    expect(klasifikasiGlukosa(110, "puasa").level).toBe("perhatian");
    expect(klasifikasiGlukosa(130, "puasa").level).toBe("tinggi");
  });
  test("klasifikasi setelah makan berbeda ambang", () => {
    expect(klasifikasiGlukosa(130, "sesudah_makan").level).toBe("normal");
    expect(klasifikasiGlukosa(210, "sesudah_makan").level).toBe("tinggi");
  });
  test("rendah dan sangat tinggi", () => {
    expect(klasifikasiGlukosa(55, "sewaktu").level).toBe("rendah");
    expect(klasifikasiGlukosa(350, "sewaktu").label).toBe("Sangat tinggi");
  });
  test("nilai di luar rentang ditolak", () => {
    expect(() => klasifikasiGlukosa(5, "puasa")).toThrow();
    expect(() => klasifikasiGlukosa(100, "malam")).toThrow();
  });
});

describe("guardrail chatbot", () => {
  test("kondisi darurat dialihkan ke 112", () => {
    const r = saringPesan("Ayah saya pingsan dan napas berbau buah");
    expect(r.jenis).toBe("darurat");
    expect(r.balasan).toContain("112");
  });
  test("pertanyaan dosis obat ditolak", () => {
    expect(saringPesan("berapa dosis metformin yang aman?").jenis).toBe("obat");
    expect(saringPesan("boleh stop obat diabetes?").jenis).toBe("obat");
  });
  test("pertanyaan biasa lolos", () => {
    expect(saringPesan("apa itu indeks glikemik?")).toBeNull();
  });
  test("kata 'dosis' di dalam kata lain tidak memicu salah tolak", () => {
    expect(saringPesan("kodosisme")).toBeNull();
  });
});

describe("chatbot mode dasar", () => {
  test("menjawab batas gula harian dengan angka Kemenkes", () => {
    expect(balasDasar("berapa batas gula harian?", null)).toContain("50");
  });
  test("menilai makanan dengan angka dari database", () => {
    const r = balasDasar("apakah es teh manis berbahaya?", null);
    expect(r).toContain("20 g");
    expect(r).toContain("tinggi gula");
  });
  test("pertanyaan di luar topik mendapat panduan", () => {
    expect(balasDasar("siapa presiden amerika", null)).toContain("Aku bisa membantu");
  });
});

describe("parser JSON dari AI", () => {
  test("membuang pagar markdown", () => {
    expect(ekstrakJson('```json\n{"items":[]}\n```')).toEqual({ items: [] });
  });
  test("teks tanpa JSON melempar error", () => {
    expect(() => ekstrakJson("maaf tidak bisa")).toThrow();
  });
});
