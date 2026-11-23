import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { auth, authenticate, hashPassword } from "../src/auth.js";
import { Account, Session } from "../src/models.js";
import {
  ADMIN_SESSION_MS, USER_SESSION_MS, sessionPolicy,
  validAdminSession, allowsApiMutation, adminPageProtection,
} from "../src/securityGuards.js";

async function start(t, app) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => server.close());
  return "http://127.0.0.1:" + server.address().port;
}
function appWithJson() {
  const app = express();
  app.use(cookieParser(), express.json());
  app.use((error, _req, res, _next) =>
    res.status(error.status || 500).json({ error: error.message }));
  return app;
}
async function post(base, path, payload, headers = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-FreteOn-Request": "1", ...headers },
    body: JSON.stringify(payload),
  });
}

test("Master e colaboradores têm sessão curta e sessão antiga não é aceita", () => {
  assert.equal(sessionPolicy("master").maxAge, ADMIN_SESSION_MS);
  assert.equal(sessionPolicy("staff").maxAge, ADMIN_SESSION_MS);
  assert.equal(sessionPolicy("cliente").maxAge, USER_SESSION_MS);
  assert.equal(sessionPolicy("motorista").maxAge, USER_SESSION_MS);
  assert.equal(sessionPolicy("master").adminSession, true);
  assert.equal(sessionPolicy("cliente").adminSession, false);
  assert.equal(validAdminSession({ adminSession: false }, "master"), false);
  assert.equal(validAdminSession({ }, "staff"), false);
  assert.equal(validAdminSession({ adminSession: true }, "master"), true);
  assert.equal(validAdminSession({ adminSession: false }, "cliente"), true);
});

test("ataque por cabeçalho de papel não eleva sessão cliente a Master", async t => {
  let storedUserRole = "cliente";
  let isNewAdminSession = true;
  t.mock.method(Session, "findOne", async () => ({
    userId: "507f1f77bcf86cd799439011",
    adminSession: isNewAdminSession,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  t.mock.method(Account, "findById", async () => ({
    _id: "507f1f77bcf86cd799439011", role: storedUserRole,
    name: "Teste de autorização",
  }));
  const app = appWithJson();
  app.get("/api/state", authenticate, (req, res) => res.json({ role: req.user.role }));
  const base = await start(t, app);
  const headers = {
    "X-FreteOn-Role": "master",
    Cookie: "freteon_session_master=" + "a".repeat(64),
  };
  assert.equal((await fetch(base + "/api/state", { headers })).status, 401);
  storedUserRole = "master";
  isNewAdminSession = false;
  assert.equal((await fetch(base + "/api/state", { headers })).status, 401);
  isNewAdminSession = true;
  const valid = await fetch(base + "/api/state", { headers });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).role, "master");
  assert.equal((await fetch(base + "/api/state", {
    headers: { "X-FreteOn-Role": "master" },
  })).status, 401);
});

test("tentativas contra conta Master são limitadas mesmo com perfil cliente falsificado", async t => {
  const hash = await hashPassword("senha-correta-testes");
  const owner = { _id:"507f1f77bcf86cd799439011", role:"master",
    phone:"69999999999", passwordHash: hash };
  const client = { _id:"507f1f77bcf86cd799439012", role:"cliente",
    phone:"69988888888", passwordHash: hash };
  t.mock.method(Account, "findOne", ({ phone }) => ({
    select: async () => phone === owner.phone ? owner : phone === client.phone ? client : null,
  }));
  const app = appWithJson();
  app.use("/auth", auth);
  const base = await start(t, app);
  for (let i = 0; i < 5; i++) {
    const response = await post(base, "/auth/login", {
      role: "cliente", phone: owner.phone, password: "senha-errada",
    });
    assert.equal(response.status, 401, "falha " + (i + 1));
  }
  const blocked = await post(base, "/auth/login", {
    role: "master", phone: owner.phone, password: "senha-errada",
  });
  assert.equal(blocked.status, 429, "perfil falsificado não evita o limite");
  const unrelated = await post(base, "/auth/login", {
    role: "cliente", phone: client.phone, password: "senha-errada",
  });
  assert.equal(unrelated.status, 401, "login de clientes mantém seu fluxo normal");
});

test("cadastro e entrada recusam papéis administrativos fabricados e operadores MongoDB", async t => {
  const app = appWithJson();
  app.use("/auth", auth);
  const base = await start(t, app);
  const createMaster = await post(base, "/auth/register", {
    role:"master", termsAccepted:true, privacyAcknowledged:true,
    name:"Fraude", phone:"69999999999", password:"Senha123456",
  });
  assert.equal(createMaster.status, 400);
  const inject = await post(base, "/auth/login", {
    role:"master", phone:{ "$ne": null }, password:"Senha123456",
  });
  assert.equal(inject.status, 400);
});

test("requisições CSRF/cross-site e formulários externos não alteram API", async t => {
  const app = express();
  app.use(express.json());
  app.use("/api", (req, res, next) => {
    if (!allowsApiMutation(req.method,
      req.get("X-FreteOn-Request"), Boolean(req.is("application/json")),
      req.get("Sec-Fetch-Site"))) return res.status(403).end();
    next();
  });
  app.post("/api/requests", (_req, res) => res.json({ changed:true }));
  const base = await start(t, app);
  assert.equal((await post(base,"/api/requests",{},{"X-FreteOn-Request":"0"})).status,403);
  assert.equal((await post(base,"/api/requests",{},{"Sec-Fetch-Site":"cross-site"})).status,403);
  assert.equal((await fetch(base+"/api/requests", {
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",
      "X-FreteOn-Request":"1"},body:"status=approved",
  })).status,403);
  assert.equal((await post(base,"/api/requests",{},{"Sec-Fetch-Site":"same-origin"})).status,200);
});

test("entrada Master impede indexação, cache e iframe de terceiros", async t => {
  const app = express();
  app.use(helmet({ frameguard:{ action:"deny" },
    contentSecurityPolicy:{ directives:{ "frame-ancestors":["'none'"] } } }));
  app.use("/master", adminPageProtection);
  app.get("/master", (_req,res)=>res.send("Entrada protegida por login"));
  const base = await start(t, app);
  const response = await fetch(base + "/master");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-robots-tag"),/noindex/);
  assert.match(response.headers.get("cache-control"),/no-store/);
  assert.equal(response.headers.get("x-frame-options"),"DENY");
  assert.match(response.headers.get("content-security-policy"),/frame-ancestors 'none'/);
});
