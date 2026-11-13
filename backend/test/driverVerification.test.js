import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { isVerifiedDriver, verificationStatus, publicUser } from "../src/models.js";
import { verifyDocumentPayload } from "../src/driverVerification.js";

const now = new Date("2026-11-13T12:00:00Z");
const future = new Date("2027-09-30T23:59:59Z");
const docs = ["cnh", "crlv", "selfie"].map((kind) => ({
  kind, fileId: "507f1f77bcf86cd799439011",
}));
const driver = {
  _id: "507f1f77bcf86cd799439011",
  role: "motorista",
  name: "Motorista de Teste",
  phone: "69999999999",
  status: "approved",
  verification: {
    status: "approved",
    plate: "ABC1D23",
    cnhExpiresAt: future,
    crlvYear: 2027,
    rntrcApplies: true,
    rntrc: "12345678",
    documents: docs,
  },
};

test("documentação completa e aprovação permitem novas propostas", () => {
  assert.equal(isVerifiedDriver(driver, now), true);
  assert.equal(verificationStatus(driver, now), "approved");
  assert.equal(publicUser(driver).verified, true);
});

test("ausência de anexos, reprovação e RNTRC declarado inválido bloqueiam", () => {
  assert.equal(isVerifiedDriver({
    ...driver, verification: { ...driver.verification, documents: docs.slice(0, 2) }
  }, now), false);
  assert.equal(isVerifiedDriver({ ...driver, status: "pending" }, now), false);
  assert.equal(isVerifiedDriver({
    ...driver, verification: { ...driver.verification, status: "rejected" },
  }, now), false);
  assert.equal(isVerifiedDriver({
    ...driver, verification: { ...driver.verification, rntrc: "1234" },
  }, now), false);
});

test("CNH e exercício do CRLV vencidos invalidam a aprovação", () => {
  assert.equal(isVerifiedDriver({
    ...driver, verification: { ...driver.verification, cnhExpiresAt: new Date("2026-01-01") },
  }, now), false);
  assert.equal(verificationStatus({
    ...driver, verification: { ...driver.verification, crlvYear: 2025 },
  }, now), "expired");
});

test("arquivos privados não aparecem no objeto público", () => {
  const data = publicUser(driver);
  assert.equal("verification" in data, false);
  assert.equal("documents" in data, false);
  assert.equal("plate" in data, false);
  assert.equal("rntrc" in data, false);
  assert.equal("cnhExpiresAt" in data, false);
  assert.equal(data.verified, true);
});

test("upload aceita JPEG reduzido mas rejeita URL, HTML ou PDF", () => {
  const jpeg = Buffer.alloc(350, 10);
  jpeg[0] = 0xff; jpeg[1] = 0xd8;
  jpeg[jpeg.length - 2] = 0xff; jpeg[jpeg.length - 1] = 0xd9;
  const valid = "data:image/jpeg;base64," + jpeg.toString("base64");
  assert.deepEqual(verifyDocumentPayload(valid), jpeg);
  assert.throws(() => verifyDocumentPayload("https://example.com/cnh.jpg"), /Envie uma foto/);
  assert.throws(() => verifyDocumentPayload("data:text/html;base64,PGh0bWw+"), /Envie uma foto/);
  assert.throws(() => verifyDocumentPayload("data:application/pdf;base64,JVBERi0="), /Envie uma foto/);
  assert.throws(() => verifyDocumentPayload("data:image/jpeg;base64,"+randomBytes(400).toString("base64")), /Arquivo de foto inválido/);
});
