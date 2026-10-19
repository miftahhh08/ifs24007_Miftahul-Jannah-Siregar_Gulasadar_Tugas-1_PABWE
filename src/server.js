// Titik masuk: bun run src/server.js  ->  http://localhost:3000
import { createApp } from "./app.js";
import { createDb } from "./db.js";
import { createAi } from "./ai.js";

const port = Number(process.env.PORT) || 3000;
const db = createDb(process.env.GULASADAR_DB || "data/gulasadar.db");
const ai = createAi();
const handler = createApp({ db, ai });

const server = Bun.serve({
  port,
  hostname: "127.0.0.1", // hanya bisa diakses dari komputer sendiri (data kesehatan = privat)
  maxRequestBodySize: 8 * 1024 * 1024,
  fetch: handler,
});

console.log(`GulaSadar berjalan di http://localhost:${server.port}`);
console.log(ai.enabled ? `Mode AI aktif (model: ${ai.model})` : "Mode dasar (tanpa AI). Isi ANTHROPIC_API_KEY di .env untuk mengaktifkan chatbot AI dan foto.");
