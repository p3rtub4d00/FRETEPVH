import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { PrivacyRequest } from "./models.js";
import { authenticate, authorize, fail, text } from "./auth.js";

export const privacyRouter = Router();

const publicLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Limite de solicitações atingido. Tente novamente mais tarde." },
});

const categories = ["acesso", "correcao", "eliminacao", "oposicao", "outros"];

privacyRouter.post("/privacy-requests", publicLimit, async (req, res) => {
  const contact = text(req.body.contact, 7, 160, "Contato para resposta");
  const category = req.body.category;
  if (!categories.includes(category))
    fail(400, "Escolha o tipo de solicitação de privacidade.");
  // Não exigir documentos sensíveis publicamente. A equipe confirma a
  // identidade do titular por canal adequado antes de divulgar dados.
  const record = await PrivacyRequest.create({
    name: text(req.body.name, 3, 100, "Nome"),
    contact,
    category,
    message: text(req.body.message, 10, 1500, "Solicitação"),
  });
  res.status(201).json({ ok: true, reference: String(record._id) });
});

privacyRouter.get(
  "/privacy-requests",
  authenticate,
  authorize("master"),
  async (req, res) => {
    const list = await PrivacyRequest.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      requests: list.map(({ _id, __v, ...item }) => ({
        ...item,
        id: String(_id),
      })),
    });
  },
);

privacyRouter.patch(
  "/privacy-requests/:id",
  authenticate,
  authorize("master"),
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id))
      fail(404, "Solicitação não encontrada.");
    if (!["pendente", "atendido"].includes(req.body.status))
      fail(400, "Situação inválida.");
    const updated = await PrivacyRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
        handledAt: req.body.status === "atendido" ? new Date() : null,
      },
      { new: true },
    );
    if (!updated) fail(404, "Solicitação não encontrada.");
    res.json({ ok: true });
  },
);
