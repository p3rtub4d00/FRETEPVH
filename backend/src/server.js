import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth, bootstrapAdmin } from "./auth.js";
import { api } from "./api.js";
import { Account, Session, Freight } from "./models.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "upgrade-insecure-requests":
          process.env.NODE_ENV === "production" || process.env.RENDER
            ? []
            : null,
      },
    },
  }),
);
app.use(cookieParser());
app.get("/api/health", (req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
    app: "FreteOn",
    mode: "live",
  }),
);
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (req.get("X-FreteOn-Request") !== "1" ||
      !req.is("application/json") ||
      req.get("Sec-Fetch-Site") === "cross-site")
  )
    return res.status(403).json({ error: "Requisição não autorizada." });
  if (mongoose.connection.readyState !== 1)
    return res
      .status(503)
      .json({ error: "Banco indisponível. Tente novamente em instantes." });
  next();
});
app.use(express.json({ limit: "3mb" }));
app.use((req, res, next) => {
  req.body ||= {};
  next();
});
app.use("/api/auth", auth);
app.use("/api", api);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint não encontrado." }),
);
const publicDirectory = fileURLToPath(
  new URL("../../frontend/dist/", import.meta.url),
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
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000)
    return res
      .status(409)
      .json({ error: "Este telefone já está cadastrado. Entre na sua conta." });
  if (error.name === "VersionError")
    return res.status(409).json({
      error: "O frete foi atualizado. Recarregue os dados e tente novamente.",
    });
  if (error.type === "entity.too.large")
    return res
      .status(413)
      .json({ error: "As fotos ultrapassam o limite permitido." });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "Dados inválidos." });
  if (error.name === "ValidationError")
    return res.status(400).json({ error: "Confira os dados informados." });
  const status = error.status || 500;
  if (status >= 500) console.error("Falha interna na operação:", error.name);
  res.status(status).json({
    error:
      status < 500
        ? error.message
        : "Não foi possível concluir. Tente novamente.",
  });
});

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  process.env.MONGODB_URL;
if (!uri) {
  console.error("Configure MONGODB_URI no Render para iniciar o FreteOn.");
  process.exit(1);
}
let startupStage = "conexão MongoDB";
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  startupStage = "criação de índices";
  await Promise.all([Account.init(), Session.init(), Freight.init()]);
  startupStage = "criação do Master";
  await bootstrapAdmin();
  console.log("MongoDB conectado.");
 } catch (error) {
  const detail = String(error.message || "");
  const diagnostics = [
    ["querySrv", "Falha na consulta DNS SRV. Confira o endereço do cluster na MONGODB_URI."],
    ["queryTxt", "Falha na consulta DNS TXT do cluster MongoDB."],
    ["Authentication failed", "Autenticação MongoDB recusada. Confira usuário e senha do banco."],
    ["bad auth", "Autenticação MongoDB recusada. Confira usuário e senha do banco."],
    ["Invalid scheme", "MONGODB_URI deve começar com mongodb:// ou mongodb+srv://."],
    ["IP", "Conexão ao cluster recusada. Confira Network Access no MongoDB Atlas."],
    ["ADMIN_PHONE", "ADMIN_PHONE já está cadastrado em outro perfil."],
    ["senha", "Confira o tamanho de ADMIN_PASSWORD (8 a 128 caracteres)."],
    ["celular", "Confira ADMIN_PHONE (DDD e 11 dígitos)."]
  ];
  const diagnostic = diagnostics.find(([pattern]) => detail.includes(pattern))?.[1] || "Confira a conexão do cluster e as permissões do usuário do banco.";
  const errorCode = /^[A-Z0-9_]+$/.test(String(error.code)) ? error.code : "não informado";
  console.error(`Falha em ${startupStage}. Tipo: ${error.name}. Código: ${errorCode}. ${diagnostic}`);
  process.exit(1);
}
const server = app.listen(process.env.PORT || 3001, "0.0.0.0", () =>
  console.log("FreteOn iniciado."),
);
function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
