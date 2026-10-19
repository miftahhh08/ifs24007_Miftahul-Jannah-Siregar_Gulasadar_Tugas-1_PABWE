// Klien AI opsional (Anthropic Messages API). Aktif hanya bila ANTHROPIC_API_KEY terisi.
// Prinsip: AI MENGENALI makanan (memilih id dari daftar kita) - angka gizi tetap dari database.
import { FOODS, getFood } from "./foods.js";
import { SYSTEM_PROMPT } from "./chat.js";

const API_URL = "https://api.anthropic.com/v1/messages";

/** Mengambil objek JSON pertama dari teks (AI kadang membungkus dengan ```json). */
export function ekstrakJson(teks) {
  const a = teks.indexOf("{");
  const b = teks.lastIndexOf("}");
  if (a === -1 || b <= a) throw new Error("Respons AI bukan JSON.");
  return JSON.parse(teks.slice(a, b + 1));
}

export function createAi({
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  fetchImpl = fetch,
} = {}) {
  const enabled = Boolean(apiKey && apiKey.trim());

  async function panggil(body) {
    const res = await fetchImpl(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, ...body }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`API AI membalas status ${res.status}`);
    const data = await res.json();
    return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }

  return {
    enabled,
    model,

    async chat(riwayat, pesan, konteks) {
      const system = konteks ? `${SYSTEM_PROMPT}\n\nKonteks pengguna:\n${konteks}` : SYSTEM_PROMPT;
      const messages = [...riwayat, { role: "user", content: pesan }];
      return panggil({ max_tokens: 500, system, messages });
    },

    /** Mengembalikan { items: [{ food, qty }], tidakDikenal: [string] } - id yang tidak ada di database dibuang. */
    async kenaliFoto(base64, mediaType) {
      const daftar = FOODS.map((f) => `${f.id}: ${f.nama}`).join("\n");
      const teks = await panggil({
        max_tokens: 400,
        system: "Kamu pengenal makanan Indonesia. Balas HANYA JSON valid tanpa teks lain.",
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: `Identifikasi makanan/minuman pada foto. Pilih HANYA dari daftar id berikut:\n${daftar}\n\nFormat: {"items":[{"id":"<id dari daftar>","porsi":<angka 0.5-3>}],"tidak_dikenal":["<nama bebas>"]}\nJika tidak ada yang cocok, kosongkan items dan isi tidak_dikenal.` },
          ],
        }],
      });
      const hasil = ekstrakJson(teks);
      const items = [];
      const tidakDikenal = Array.isArray(hasil.tidak_dikenal) ? hasil.tidak_dikenal.slice(0, 5).map(String) : [];
      for (const it of Array.isArray(hasil.items) ? hasil.items.slice(0, 6) : []) {
        const food = getFood(String(it?.id));
        if (!food) { tidakDikenal.push(String(it?.id ?? "?")); continue; } // anti-halusinasi
        const qty = Math.min(3, Math.max(0.5, Number(it.porsi) || 1));
        items.push({ food, qty });
      }
      return { items, tidakDikenal };
    },
  };
}
