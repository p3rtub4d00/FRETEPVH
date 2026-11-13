import { Router } from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import { Freight, FreightChat, FreightReport } from "./models.js";
import { authorize, fail } from "./auth.js";
import { canChat, safeChatMessage } from "./antiBypass.js";
import { notifyInBackground } from "./webPush.js";

export const freightCommunication = Router();
const own = (req) => String(req.user._id);
const requestId = (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail(404, "Frete não encontrado.");
  return req.params.id;
};
const getRequest = async (req) => {
  const request = await Freight.findById(requestId(req));
  if (!request) fail(404, "Frete não encontrado.");
  return request;
};
const limit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 35,
  standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Muitas mensagens em pouco tempo. Tente mais tarde." },
});

freightCommunication.get("/requests/:id/chat", authorize("cliente", "motorista"), async (req, res) => {
  const request = await getRequest(req);
  if (!canChat(request, own(req), req.user.role))
    fail(403, "O chat é exclusivo do cliente e motorista contratado, durante e após a execução.");
  const items = await FreightChat.find({ requestId: request._id })
    .sort({ createdAt: -1 }).limit(100).lean();
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ messages: items.reverse().map(item => ({
    id: String(item._id), authorRole: item.authorRole,
    authorId: item.authorId, content: item.content, createdAt: item.createdAt,
  })) });
});

freightCommunication.post("/requests/:id/chat", authorize("cliente", "motorista"), limit, async (req, res) => {
  const request = await getRequest(req);
  if (!canChat(request, own(req), req.user.role))
    fail(403, "O chat só é liberado entre o cliente e o motorista contratado.");
  const content = safeChatMessage(req.body?.content);
  const item = await FreightChat.create({
    requestId: request._id, authorId: own(req), authorRole: req.user.role, content,
  });
  const recipient = req.user.role === "cliente" ? request.driverId : request.clientId;
  notifyInBackground([recipient], {
    role: req.user.role === "cliente" ? "motorista" : "cliente",
    title: "Nova mensagem sobre o frete",
    body: "Confira a conversa no FreteOn.",
    id: String(request._id),
  });
  res.status(201).json({ message: {
    id: String(item._id), authorId: item.authorId, authorRole: item.authorRole,
    content: item.content, createdAt: item.createdAt,
  } });
});

freightCommunication.post("/requests/:id/report", authorize("cliente", "motorista"), limit, async (req, res) => {
  const request = await getRequest(req);
  const reporter = own(req);
  const isClient = req.user.role === "cliente" && request.clientId === reporter;
  const isDriver = req.user.role === "motorista" && (
    request.driverId === reporter || request.proposals.some(p => p.driverId === reporter));
  if (!isClient && !isDriver) fail(403, "Denúncia disponível somente para participantes deste pedido.");
  const category = req.body?.category;
  if (!["outside_deal", "inappropriate", "other"].includes(category))
    fail(400, "Selecione o tipo de denúncia.");
  const description = typeof req.body?.description === "string"
    ? req.body.description.trim() : "";
  if (description.length < 10 || description.length > 500)
    fail(400, "Descreva o ocorrido em 10 a 500 caracteres.");
  const reportedId = isClient ? String(req.body?.reportedId || request.driverId || "") : request.clientId;
  if (isClient && reportedId && !request.proposals.some(p => p.driverId === reportedId) &&
      request.driverId !== reportedId)
    fail(400, "O motorista denunciado não pertence às propostas deste frete.");
  await FreightReport.create({
    requestId: request._id, reporterId: reporter, reporterRole: req.user.role,
    reportedId, category, description,
  });
  res.status(201).json({ ok: true, message: "Denúncia registrada para análise do Master." });
});

// A administração consulta o histórico de mensagens SOMENTE para um frete
// com denúncia registrada, para avaliar a evidência da ocorrência.
freightCommunication.get("/master/reports/:reportId/chat", authorize("master"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.reportId)) fail(404, "Denúncia não encontrada.");
  const report = await FreightReport.findById(req.params.reportId);
  if (!report) fail(404, "Denúncia não encontrada.");
  const items = await FreightChat.find({ requestId: report.requestId })
    .sort({ createdAt: -1 }).limit(100).lean();
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ messages: items.reverse().map(item => ({
    id: String(item._id), authorRole: item.authorRole,
    content: item.content, createdAt: item.createdAt,
  })) });
});

freightCommunication.get("/master/reports", authorize("master"), async (req, res) => {
  const reports = await FreightReport.find().sort({ createdAt: -1 }).limit(200).lean();
  res.setHeader("Cache-Control", "no-store, private");
  res.json({ reports: reports.map(r => ({
    id: String(r._id), requestId: String(r.requestId), reporterId: r.reporterId,
    reporterRole: r.reporterRole, reportedId: r.reportedId,
    category: r.category, description: r.description,
    status: r.status, createdAt: r.createdAt,
  })) });
});

freightCommunication.patch("/master/reports/:reportId", authorize("master"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.reportId)) fail(404, "Denúncia não encontrada.");
  if (req.body?.status !== "reviewed") fail(400, "A ação permitida é marcar como analisada.");
  const result = await FreightReport.findByIdAndUpdate(req.params.reportId,
    { status: "reviewed", reviewedAt: new Date() }, { new: true });
  if (!result) fail(404, "Denúncia não encontrada.");
  res.json({ ok: true });
});
