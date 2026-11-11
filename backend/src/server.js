import express from "express";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const publicDirectory = fileURLToPath(
  new URL("../../frontend/dist/", import.meta.url),
);
app.disable("x-powered-by");
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "FreteOn",
    mode: "demo",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "not-connected",
  });
});
app.use("/api", (req, res) =>
  res
    .status(404)
    .json({ error: "Endpoint indisponível nesta versão de demonstração." }),
);
app.use(
  express.static(publicDirectory, {
    setHeaders(res, file) {
      if (file.endsWith("sw.js") || file.endsWith("index.html"))
        res.setHeader("Cache-Control", "no-cache");
    },
  }),
);
app.get("/{*path}", (req, res) =>
  res.sendFile(path.join(publicDirectory, "index.html")),
);

if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("MongoDB conectado.");
  } catch {
    console.error(
      "Falha na conexão MongoDB. Verifique MONGODB_URI e as permissões de rede.",
    );
    process.exit(1);
  }
}
const server = app.listen(process.env.PORT || 3001, "0.0.0.0", () =>
  console.log("FreteOn iniciado em modo demonstração."),
);
async function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
