import { beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { createDb } from "../src/db.js";
import { createAi } from "../src/ai.js";

const kirim = (app, method, path, body) =>
  app(new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }));

let app;
beforeEach(() => {
  app = createApp({ db: createDb(":memory:"), ai: createAi({ apiKey: "" }) });
});

describe("API makanan dan catatan", () => {
  test("GET /api/foods?q= mengembalikan lampu", async () => {
    const r = await kirim(app, "GET", "/api/foods?q=boba");
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d.items[0].id).toBe("boba-milk-tea");
    expect(d.items[0].lampu).toBe("merah");
  });
  test("mencatat makanan lalu ringkasan menghitung gula tambahan saja", async () => {
    await kirim(app, "POST", "/api/log", { foodId: "es-teh-manis", qty: 1, date: "2026-10-19" });
    await kirim(app, "POST", "/api/log", { foodId: "apel", qty: 1, date: "2026-10-19" }); // gula alami
    const s = await (await kirim(app, "GET", "/api/summary?date=2026-10-19")).json();
    expect(s.tambahan).toBe(20);
    expect(s.alami).toBe(15);
    expect(s.persen).toBe(40);
    expect(s.status).toBe("hijau");
    expect(s.sdm).toBe(1.6);
  });
  test("melebihi batas -> status merah", async () => {
    await kirim(app, "POST", "/api/log", { foodId: "boba-milk-tea", qty: 1, date: "2026-10-19" });
    await kirim(app, "POST", "/api/log", { foodId: "minuman-soda", qty: 1, date: "2026-10-19" });
    const s = await (await kirim(app, "GET", "/api/summary?date=2026-10-19")).json();
    expect(s.tambahan).toBe(75);
    expect(s.status).toBe("merah");
    expect(s.sisa).toBe(0);
  });
  test("hapus catatan", async () => {
    const c = await (await kirim(app, "POST", "/api/log", { foodId: "permen", date: "2026-10-19" })).json();
    expect((await kirim(app, "DELETE", `/api/log/${c.item.id}`)).status).toBe(200);
    expect((await kirim(app, "DELETE", `/api/log/${c.item.id}`)).status).toBe(404);
  });
  test("streak menghitung hari berurutan di bawah batas", async () => {
    for (const d of ["2026-10-17", "2026-10-18", "2026-10-19"]) await kirim(app, "POST", "/api/log", { foodId: "teh-tawar", date: d });
    const s = await (await kirim(app, "GET", "/api/summary?date=2026-10-19")).json();
    expect(s.streak).toBe(3);
  });
  test("label kemasan: gula per sajian x jumlah sajian", async () => {
    const d = await (await kirim(app, "POST", "/api/label", { nama: "Susu cokelat", gulaPerSajian: 12, sajian: 2 })).json();
    expect(d.item.gula).toBe(24);
    expect(d.item.lampu).toBe("merah");
  });
});

describe("validasi dan keamanan", () => {
  test("qty tidak valid ditolak 400", async () => {
    expect((await kirim(app, "POST", "/api/log", { foodId: "permen", qty: 999 })).status).toBe(400);
    expect((await kirim(app, "POST", "/api/log", { foodId: "permen", qty: "abc" })).status).toBe(400);
  });
  test("makanan tidak dikenal 404, body kosong 400", async () => {
    expect((await kirim(app, "POST", "/api/log", { foodId: "tidak-ada" })).status).toBe(404);
    expect((await kirim(app, "POST", "/api/log", {})).status).toBe(400);
  });
  test("tanggal salah format ditolak", async () => {
    expect((await kirim(app, "GET", "/api/summary?date=19-10-2026")).status).toBe(400);
  });
  test("JSON rusak -> 400, bukan 500", async () => {
    const r = await app(new Request("http://localhost/api/log", { method: "POST", body: "{bukan json" }));
    expect(r.status).toBe(400);
  });
  test("path traversal pada file statis ditolak", async () => {
    const r = await app(new Request("http://localhost/..%2f..%2fpackage.json"));
    expect(r.status).toBe(404);
  });
  test("header keamanan hadir", async () => {
    const r = await kirim(app, "GET", "/api/config");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
  test("input XSS disimpan sebagai teks biasa (escape dilakukan di klien)", async () => {
    const r = await kirim(app, "POST", "/api/log", { kustom: { nama: "<script>alert(1)</script>", gula: 5 }, date: "2026-10-19" });
    expect((await r.json()).item.nama).toBe("<script>alert(1)</script>");
  });
});

describe("risiko dan gula darah via API", () => {
  test("simpan dan ambil skrining terakhir", async () => {
    const jawab = { umur: 22, jenisKelamin: "L", tinggiCm: 170, beratKg: 80, pinggangCm: 92, aktifFisik: false, sayurBuahHarian: true, riwayatKeluarga: "keluarga_inti" };
    const r = await (await kirim(app, "POST", "/api/risk", jawab)).json();
    expect(r.hasil.skor).toBe(3 + 3 + 2 + 5); // BMI 27,7 -> 3; pinggang 92 cm (L) -> 3; tidak aktif -> 2; keluarga inti -> 5
    const t = await (await kirim(app, "GET", "/api/risk/latest")).json();
    expect(t.terakhir.hasil.skor).toBe(r.hasil.skor);
  });
  test("catat gula darah dan klasifikasinya", async () => {
    const r = await (await kirim(app, "POST", "/api/glucose", { nilai: 135, konteks: "puasa", date: "2026-10-19" })).json();
    expect(r.hasil.level).toBe("tinggi");
    expect((await (await kirim(app, "GET", "/api/glucose")).json()).items.length).toBe(1);
  });
});

describe("chat dan foto", () => {
  test("guardrail darurat berjalan walau tanpa AI", async () => {
    const d = await (await kirim(app, "POST", "/api/chat", { message: "ayah pingsan" })).json();
    expect(d.mode).toBe("aman");
    expect(d.balasan).toContain("112");
  });
  test("tanpa API key, chat memakai mode dasar", async () => {
    const d = await (await kirim(app, "POST", "/api/chat", { message: "apa saja gejala diabetes?" })).json();
    expect(d.mode).toBe("dasar");
  });
  test("foto tanpa API key -> 503 dengan pesan jelas", async () => {
    const r = await kirim(app, "POST", "/api/scan/photo", { image: "abc", mediaType: "image/jpeg" });
    expect(r.status).toBe(503);
    expect((await r.json()).aiAktif).toBe(false);
  });
  test("AI mengarang id makanan -> dibuang, angka tetap dari database", async () => {
    const fetchPalsu = async () => new Response(JSON.stringify({
      content: [{ type: "text", text: '```json\n{"items":[{"id":"es-teh-manis","porsi":1},{"id":"makanan-ngawur","porsi":2}],"tidak_dikenal":["piring"]}\n```' }],
    }), { status: 200 });
    const appAi = createApp({ db: createDb(":memory:"), ai: createAi({ apiKey: "kunci-uji", fetchImpl: fetchPalsu }) });
    const r = await kirim(appAi, "POST", "/api/scan/photo", { image: "AAAA", mediaType: "image/jpeg" });
    const d = await r.json();
    expect(d.items.length).toBe(1);
    expect(d.items[0].gula).toBe(20);
    expect(d.tidakDikenal).toContain("makanan-ngawur");
  });
  test("kegagalan API AI -> chat jatuh ke mode dasar, bukan error", async () => {
    const appAi = createApp({ db: createDb(":memory:"), ai: createAi({ apiKey: "kunci-uji", fetchImpl: async () => new Response("x", { status: 500 }) }) });
    const d = await (await kirim(appAi, "POST", "/api/chat", { message: "tips mencegah diabetes" })).json();
    expect(d.mode).toBe("dasar");
  });
  test("pesan dosis obat tidak pernah diteruskan ke AI", async () => {
    let dipanggil = false;
    const appAi = createApp({ db: createDb(":memory:"), ai: createAi({ apiKey: "kunci-uji", fetchImpl: async () => { dipanggil = true; return new Response("{}"); } }) });
    const d = await (await kirim(appAi, "POST", "/api/chat", { message: "berapa dosis insulin saya?" })).json();
    expect(dipanggil).toBe(false);
    expect(d.jenis).toBe("obat");
  });
});
