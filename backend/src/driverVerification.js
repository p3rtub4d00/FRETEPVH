import { notifyInBackground } from "./webPush.js";
import { Router } from "express";
import mongoose from "mongoose";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Account, isVerifiedDriver, verificationStatus } from "./models.js";
import { authorize, fail, text } from "./auth.js";
import { validateDriverDetails, validPlate, todayInPortoVelho } from "../../frontend/src/driverDocumentFields.js";

export const driverVerification = Router();
const types = ["cnh", "crlv", "selfie"];
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
  bucketName: "private_driver_documents",
  chunkSizeBytes: 100 * 1024,
});
const userId = (user) => String(user._id);
const requireId = (id) => {
  if (!mongoose.isValidObjectId(id)) fail(404, "Motorista não encontrado.");
};
const currentYear = () => Number(todayInPortoVelho().slice(0, 4));

export function verifyDocumentPayload(image) {
  if (typeof image !== "string" || image.length < 50 || image.length > 900000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))
    fail(400, "Envie uma foto JPG legível com no máximo 650 KB após a redução.");
  const data = Buffer.from(image.slice("data:image/jpeg;base64,".length), "base64");
  if (data.length < 128 || data.length > 675000 ||
      data[0] !== 0xff || data[1] !== 0xd8 ||
      data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9)
    fail(400, "Arquivo de foto inválido. Fotografe novamente em boa iluminação.");
  return data;
}

function summary(account) {
  const v = account.verification;
  return {
    id: userId(account),
    status: verificationStatus(account),
    approved: isVerifiedDriver(account),
    accountStatus: account.status,
    plate: v?.plate || "",
    cnhExpiresAt: v?.cnhExpiresAt || null,
    crlvYear: v?.crlvYear || null,
    rntrc: v?.rntrc || "",
    rntrcApplies: Boolean(v?.rntrcApplies),
    rejectionReason: v?.rejectionReason || "",
    reviewedAt: v?.reviewedAt || null,
    documents: types.map((kind) => ({
      kind, exists: Boolean(v?.documents?.some((item) => item.kind === kind)),
      uploadedAt: v?.documents?.find((item) => item.kind === kind)?.uploadedAt || null,
    })),
  };
}

async function permitted(req, driverId) {
  requireId(driverId);
  if (req.user.role !== "master" && userId(req.user) !== driverId)
    fail(403, "Acesso restrito ao titular ou administrador.");
  const account = await Account.findOne({ _id: driverId, role: "motorista" });
  if (!account) fail(404, "Motorista não encontrado.");
  return account;
}

// No response of /state or /users contains these private file bytes or IDs.
driverVerification.get("/driver-verification/:id", async (req, res) => {
  const account = await permitted(req, req.params.id);
  res.json({ verification: summary(account) });
});

driverVerification.get("/driver-verification/:id/documents/:kind", async (req, res) => {
  const account = await permitted(req, req.params.id);
  if (!types.includes(req.params.kind)) fail(404, "Documento não encontrado.");
  const doc = account.verification?.documents?.find((item) => item.kind === req.params.kind);
  if (!doc) fail(404, "Documento ainda não enviado.");
  const bucketInstance = bucket();
  const cursor = bucketInstance.find({ _id: doc.fileId });
  const [file] = await cursor.toArray();
  if (!file || file.length > 675000) fail(404, "Arquivo indisponível.");
  const chunks = [];
  for await (const chunk of bucketInstance.openDownloadStream(doc.fileId))
    chunks.push(chunk);
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ image: "data:image/jpeg;base64," + Buffer.concat(chunks).toString("base64") });
});

driverVerification.post(
  "/driver-verification/documents/:kind",
  authorize("motorista"),
  async (req, res) => {
    if (!types.includes(req.params.kind)) fail(400, "Escolha CNH, CRLV ou selfie.");
    const data = verifyDocumentPayload(req.body?.image);
    // GridFS stores private binary content, never served by express.static.
    const storage = bucket();
    const upload = storage.openUploadStream("driver-" + req.params.kind + ".jpg", {
      contentType: "image/jpeg",
      metadata: { role: "motorista", ownerId: userId(req.user), kind: req.params.kind },
    });
    await pipeline(Readable.from([data]), upload);
    if (!req.user.verification) req.user.verification = {};
    const v = req.user.verification;
    const old = v.documents.find((item) => item.kind === req.params.kind);
    v.documents = [
      ...v.documents.filter((item) => item.kind !== req.params.kind),
      { kind: req.params.kind, fileId: upload.id, uploadedAt: new Date() },
    ];
    v.status = "unsubmitted";
    v.reviewedAt = null;
    v.reviewedBy = "";
    v.rejectionReason = "";
    req.user.status = "pending";
    req.user.available = false;
    try {
      await req.user.save();
    } catch (err) {
      await storage.delete(upload.id).catch(() => {});
      throw err;
    }
    if (old) await storage.delete(old.fileId).catch(() => {});
    res.json({ verification: summary(req.user) });
  },
);

driverVerification.patch("/driver-verification/details", authorize("motorista"), async (req, res) => {
  if (!req.user.verification) req.user.verification = {};
  const v = req.user.verification;
  const checked = validateDriverDetails(req.body);
  if (!checked.valid) {
    const first = Object.values(checked.errors)[0];
    fail(400, first);
  }
  const { plate, cnhExpiresAt, crlvYear, rntrcApplies, rntrc } = checked.data;
  // Registrar o último dia de validade às 23:59:59 no horário de Rondônia.
  const expiration = new Date(cnhExpiresAt + "T23:59:59-04:00");
  v.plate = plate;
  v.cnhExpiresAt = expiration;
  v.crlvYear = crlvYear;
  v.rntrcApplies = rntrcApplies;
  v.rntrc = rntrc;
  v.status = "unsubmitted";
  v.rejectionReason = "";
  v.reviewedAt = null;
  v.reviewedBy = "";
  req.user.available = false;
  req.user.status = "pending";
  await req.user.save();
  res.json({ verification: summary(req.user) });
});

driverVerification.post("/driver-verification/submit", authorize("motorista"), async (req, res) => {
  if (!req.user.verification) req.user.verification = {};
  const v = req.user.verification;
  if (!types.every((kind) => v.documents.some((item) => item.kind === kind)))
    fail(409, "Envie CNH, CRLV e selfie antes de solicitar análise.");
  if (!validPlate(v.plate) || !v.cnhExpiresAt ||
      new Date(v.cnhExpiresAt) <= new Date() || v.crlvYear < currentYear())
    fail(409, "Informe placa, validade da CNH e exercício atual do CRLV.");
  if (v.rntrcApplies && !/^\d{8,12}$/.test(v.rntrc))
    fail(409, "Informe o RNTRC para conferência.");
  v.status = "pending";
  v.rejectionReason = "";
  v.reviewedAt = null;
  v.reviewedBy = "";
  req.user.status = "pending";
  req.user.available = false;
  await req.user.save();
  res.json({ verification: summary(req.user) });
});

driverVerification.patch("/driver-verification/:id/review", authorize("master"), async (req, res) => {
  const account = await permitted(req, req.params.id);
  const v = account.verification;
  if (!["approved", "rejected"].includes(req.body?.status))
    fail(400, "Escolha aprovar ou reprovar.");
  if (req.body.status === "approved") {
    if (v.status !== "pending" ||
        !types.every((kind) => v.documents.some((item) => item.kind === kind)) ||
        !validPlate(v.plate) ||
        !v.cnhExpiresAt || new Date(v.cnhExpiresAt) <= new Date() ||
        !v.crlvYear || v.crlvYear < currentYear() ||
        (v.rntrcApplies && !/^\d{8,12}$/.test(v.rntrc)))
      fail(409, "Documentos incompletos ou vencidos. Não é possível aprovar.");
    v.rejectionReason = "";
  } else {
    v.rejectionReason = text(req.body?.reason, 10, 500, "Motivo da reprovação");
  }
  v.status = req.body.status;
  v.reviewedAt = new Date();
  v.reviewedBy = userId(req.user);
  account.status = req.body.status;
  account.available = false;
  await account.save();
  notifyInBackground([String(account._id)], {
    role: "motorista", title: v.status === "approved" ? "Cadastro aprovado!" : "Documentação precisa de ajustes",
    body: "Confira o resultado da análise no seu perfil FreteOn.",
    id: `verification-${account._id}-${Date.now()}`,
  });
  res.json({ verification: summary(account) });
});
