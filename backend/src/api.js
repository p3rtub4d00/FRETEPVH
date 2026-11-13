import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { Account, Freight, publicUser, isVerifiedDriver } from "./models.js";
import { authenticate, authorize, fail, text } from "./auth.js";
import { calculateRoadRoute } from "./maps.js";
import { LEGAL_VERSION } from "./legalVersion.js";
import { finance, PAYMENT_METHODS, bookFinancials, overdueDriver, walletSummary } from "./finance.js";
import { pushRouter } from "./pushRoutes.js";
import { driverVerification } from "./driverVerification.js";
import { notifyInBackground } from "./webPush.js";

export const api = Router();
api.use(authenticate);
api.use((req, res, next) => {
  // Operações que alteram dados exigem a versão atual dos Termos aceita
  // expressamente. Consultas permanecem acessíveis para histórico/segurança.
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.user.role !== "master" &&
    (req.user.termsVersion !== LEGAL_VERSION ||
      req.user.privacyNoticeVersion !== LEGAL_VERSION)
  ) fail(428, "Leia e aceite os Termos de Uso e a Política de Privacidade para continuar.");
  next();
});
api.use(finance);
api.use(pushRouter);
api.use(driverVerification);
const own = (user) => String(user._id);
function validId(id) {
  if (!mongoose.isValidObjectId(id)) fail(404, "Registro não encontrado.");
}
function driverApproved(user) {
  if (!isVerifiedDriver(user))
    fail(403, "Envie seus documentos em Meu perfil e aguarde a aprovação do Master para receber fretes.");
}
function time(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail(400, "Informe um horário válido.");
  return value;
}
/**
 * Fotos em formato JPEG/PNG/WebP, otimizadas no navegador. Mantemos suporte
 * às imagens válidas dos pedidos anteriores; nunca aceitamos URLs externas
 * nem conteúdo arbitrário em src de fotos.
 */
export function validateFreightPhotos(photos, max = 3) {
  if (
    !Array.isArray(photos) ||
    photos.length > max ||
    photos.some((photo) =>
      typeof photo !== "string" ||
      !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo) ||
      photo.length > 810000
    )
  ) fail(400, "Envie até 3 fotos JPG, PNG ou WebP. Reduza a imagem ou use a câmera do aplicativo.");
  return photos;
}
function canRead(request, user) {
  return (
    user.role === "master" ||
    request.clientId === own(user) ||
    (user.role === "motorista" &&
      ((user.status === "approved" && request.status === "open") ||
        request.driverId === own(user) ||
        request.proposals.some((proposal) => proposal.driverId === own(user))))
  );
}
function presentRequest(request, user) {
  const data = request.toObject();
  const result = { ...data, id: String(data._id) };
  delete result._id;
  delete result.__v;
  if (user.role === "motorista")
    result.proposals = data.proposals.filter(
      (proposal) => proposal.driverId === own(user),
    );
  if (user.role === "cliente") {
    // Cliente só visualiza o preço total contratado: não enviamos os dados
    // internos de comissão, líquido do motorista ou controle de repasses.
    result.canDispute =
      data.status === "completed" &&
      data.disputeStatus === "none" &&
      data.payoutStatus !== "paid_simulated" &&
      data.commissionStatus !== "paid";
    for (const field of [
      "commissionCents", "driverNetCents", "commissionRate",
      "commissionStatus", "commissionDueAt", "commissionPaymentRequestedAt",
      "commissionPaidAt", "payoutStatus", "payoutRequestedAt", "payoutPaidAt",
    ]) delete result[field];
  }
  return result;
}
api.get("/state", async (req, res) => {
  const userId = own(req.user);
  let query = {};
  if (req.user.role === "cliente") query = { clientId: userId };
  if (req.user.role === "motorista") {
    const conditions = [{ driverId: userId }, { "proposals.driverId": userId }];
    if (isVerifiedDriver(req.user)) conditions.push({ status: "open" });
    query = { $or: conditions };
  }
  const requests = await Freight.find(query).sort({ createdAt: -1 });
  const driverIds = [
    ...new Set(
      requests.flatMap((request) =>
        request.proposals.map((proposal) => proposal.driverId),
      ),
    ),
  ];
  if (req.user.role === "motorista") driverIds.push(userId);
  const drivers = await Account.find(
    req.user.role === "master"
      ? { role: "motorista" }
      : { role: "motorista", _id: { $in: driverIds } },
  );
  const ratings = await Freight.aggregate([
    {
      $match: {
        status: "completed",
        driverId: { $in: drivers.map((driver) => String(driver._id)) },
      },
    },
    {
      $group: {
        _id: "$driverId",
        trips: { $sum: 1 },
        rating: { $avg: "$rating" },
      },
    },
  ]);
  const people = drivers.map((driver) => {
    const result = publicUser(driver);
    const summary = ratings.find((rating) => rating._id === result.id);
    result.trips = summary?.trips || 0;
    result.rating = summary?.rating
      ? summary.rating.toFixed(1).replace(".", ",")
      : "Novo";
    if (req.user.role === "master") result.pixKey = driver.pixKey || "";
    if (req.user.role !== "master" && result.id !== userId) delete result.phone;
    return result;
  });
  const users =
    req.user.role === "master"
      ? (await Account.find().sort({ createdAt: -1 })).map(publicUser)
      : [];
  res.json({
    user: publicUser(req.user),
    available: req.user.role === "motorista" ? isVerifiedDriver(req.user) : Boolean(req.user.available),
    drivers: people,
    users,
    requests: requests.map((request) => presentRequest(request, req.user)),
    wallet: req.user.role === "cliente" ? null : walletSummary(requests, req.user),
  });
});
api.patch("/profile/photo", authorize("cliente", "motorista"), async (req, res) => {
  const photo = req.body?.photo;
  if (photo !== "" && (
    typeof photo !== "string" ||
    !/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/.test(photo) ||
    photo.length > 320000
  ))
    fail(400, "Envie uma foto JPG, PNG ou WebP com até 240 KB.");
  req.user.profilePhoto = photo;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
});
// Compatibilidade com versões antigas do PWA: a disponibilidade manual
// foi encerrada. O estado agora depende exclusivamente da elegibilidade.
api.patch("/availability", authorize("motorista"), (req, res) => {
  res.json({
    user: publicUser(req.user),
    message: "O FreteOn agora disponibiliza os fretes automaticamente a motoristas verificados.",
  });
});
api.post("/requests", authorize("cliente"), rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitos fretes criados em pouco tempo. Tente novamente mais tarde." },
}), async (req, res) => {
  const data = req.body;
  if (!PAYMENT_METHODS.includes(data.paymentMethod))
    fail(400, "Escolha Pix pelo FreteOn, cartão ou dinheiro antes de publicar.");
  const fields = {
    title: text(data.title, 3, 70, "Carga"),
    origin: text(data.origin, 5, 180, "Retirada"),
    destination: text(data.destination, 5, 180, "Entrega"),
    description: text(data.description, 1, 500, "Detalhes"),
    // O veículo é escolhido pelo motorista, não exigido do cliente.
    date: text(data.date, 10, 10, "Data"),
    time: time(data.time),
  };
  if (fields.origin === fields.destination)
    fail(400, "Retirada e entrega devem ser diferentes.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fields.date) ||
    !Number.isFinite(Date.parse(`${fields.date}T${fields.time}:00-04:00`)) ||
    new Date(`${fields.date}T${fields.time}:00-04:00`) <= new Date()
  )
    fail(400, "Escolha uma data e um horário futuros de Porto Velho.");
  const photos = validateFreightPhotos(data.photos || []);
  // Recalcular no servidor: a quilometragem informada pelo navegador não é confiável.
  let roadEstimate = {};
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      roadEstimate = await calculateRoadRoute(
        data.originPoint || fields.origin,
        data.destinationPoint || fields.destination,
      );
    } catch {
      // Um problema temporário no mapa não deve impedir a publicação do frete.
      console.warn("Não foi possível obter a estimativa de rota deste frete.");
    }
  }
  const request = await Freight.create({
    ...fields,
    photos,
    helper: data.helper === true,
    paymentMethod: data.paymentMethod,
    ...roadEstimate,
    clientId: own(req.user),
  });
  const visibleDrivers = await Account.find({
    role: "motorista", status: "approved",
  }).limit(300);
  const verifiedIds = visibleDrivers.filter(isVerifiedDriver).map((person) => String(person._id));
  notifyInBackground(verifiedIds, {
    role: "motorista",
    title: "Novo frete disponível!",
    body: "Um cliente publicou um pedido. Confira os detalhes e envie sua proposta.",
    id: String(request._id),
  });
  res.status(201).json({ request: presentRequest(request, req.user) });
});
// Anexar imagens a pedidos já publicados, sem recriar a contratação.
api.post("/requests/:id/photos", authorize("cliente"), async (req, res) => {
  validId(req.params.id);
  const request = await Freight.findById(req.params.id);
  if (!request || request.clientId !== own(req.user))
    fail(404, "Frete não encontrado.");
  if (!["open", "booked"].includes(request.status))
    fail(409, "Só é possível anexar fotos antes de iniciar o transporte.");
  const additional = validateFreightPhotos(req.body.photos);
  if (additional.length === 0)
    fail(400, "Escolha pelo menos uma foto.");
  request.photos = validateFreightPhotos([...request.photos, ...additional]);
  await request.save();
  res.json({ request: presentRequest(request, req.user) });
});

api.delete("/requests/:id/photos/:index", authorize("cliente"), async (req, res) => {
  validId(req.params.id);
  const request = await Freight.findById(req.params.id);
  if (!request || request.clientId !== own(req.user))
    fail(404, "Frete não encontrado.");
  if (!["open", "booked"].includes(request.status))
    fail(409, "Só é possível alterar fotos antes de iniciar o transporte.");
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= request.photos.length)
    fail(404, "Foto não encontrada.");
  request.photos.splice(index, 1);
  await request.save();
  res.json({ request: presentRequest(request, req.user) });
});

api.post("/requests/:id/calculate-route", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas consultas de rota. Tente novamente mais tarde." },
}), async (req, res) => {
  validId(req.params.id);
  const request = await Freight.findById(req.params.id);
  if (!request || !canRead(request, req.user))
    fail(404, "Frete não encontrado.");
  if (request.distanceMeters != null && request.durationMinutes != null)
    return res.json({ distanceMeters: request.distanceMeters, durationMinutes: request.durationMinutes });
  if (!process.env.GOOGLE_MAPS_API_KEY)
    fail(503, "O cálculo de quilômetros exige configurar GOOGLE_MAPS_API_KEY no Render. Enquanto isso, consulte a rota pelo Google Maps.");
  const route = await calculateRoadRoute(request.origin, request.destination);
  request.distanceMeters = route.distanceMeters;
  request.durationMinutes = route.durationMinutes;
  await request.save();
  res.json(route);
});
api.post(
  "/requests/:id/proposals",
  authorize("motorista"),
  async (req, res) => {
    driverApproved(req.user);
    if (await overdueDriver(own(req.user)))
      fail(403, "Novas propostas suspensas: quite as comissões vencidas na carteira.");
    validId(req.params.id);
    if (
      typeof req.body.price !== "number" ||
      !Number.isFinite(req.body.price) ||
      req.body.price < 1 ||
      req.body.price > 100000
    )
      fail(400, "Informe um preço entre R$ 1 e R$ 100.000.");
    const request = await Freight.findById(req.params.id);
    if (!request) fail(404, "Frete não encontrado.");
    if (request.status !== "open")
      fail(409, "Este frete não aceita mais propostas.");
    if (request.paymentMethod === "card_driver" && !req.user.acceptsCard)
      fail(403, "Ative a opção de cartão em Minha carteira antes de propor este frete.");
    const previous = request.proposals.find(
      (proposal) => proposal.driverId === own(req.user),
    );
    const proposal = {
      id: previous?.id || randomUUID(),
      driverId: own(req.user),
      price: Math.round(req.body.price * 100) / 100,
      time: time(req.body.time),
      note: text(req.body.note, 1, 400, "Detalhes da proposta"),
    };
    request.proposals = [
      ...request.proposals.filter((item) => item.driverId !== own(req.user)),
      proposal,
    ];
    await request.save();
    if (!previous)
      notifyInBackground([request.clientId], {
        role: "cliente",
        title: "Você recebeu uma proposta!",
        body: "Um motorista enviou um preço para seu frete. Compare e escolha.",
        id: String(request._id),
      });
    res.json({ ok: true });
  },
);
api.patch("/requests/:id", async (req, res) => {
  validId(req.params.id);
  const request = await Freight.findById(req.params.id);
  if (!request || !canRead(request, req.user))
    fail(404, "Frete não encontrado.");
  const previousStatus = request.status;
  if (req.user.role === "cliente" && request.clientId === own(req.user)) {
    if (req.body.status === "booked" && request.status === "open") {
      const proposal = request.proposals.find(
        (item) => item.id === req.body.selectedId,
      );
      if (!proposal) fail(400, "Proposta não encontrada.");
      const selectedDriver = await Account.findOne({
        _id: proposal.driverId,
        role: "motorista",
        status: "approved",
      });
      if (!selectedDriver || !isVerifiedDriver(selectedDriver))
        fail(409, "Este motorista precisa concluir a verificação documental. Escolha outro motorista.");
      if (request.paymentMethod === "card_driver" && !selectedDriver.acceptsCard)
        fail(409, "Este motorista não aceita cartão na maquininha.");
      if (await overdueDriver(String(selectedDriver._id)))
        fail(409, "Este motorista está temporariamente impedido de aceitar novos fretes.");
      bookFinancials(request, proposal);
      request.status = "booked";
      request.selectedId = proposal.id;
      request.driverId = proposal.driverId;
    } else if (
      req.body.status === "cancelled" &&
      ["open", "booked"].includes(request.status)
    ) {
      request.status = "cancelled";
      // Reverte o Pix fictício na simulação, sem qualquer transferência real.
      if (request.paymentMethod === "pix_freteon" &&
          request.paymentStatus === "simulated_paid")
        request.paymentStatus = "refunded_simulated";
      request.payoutStatus = "none";
      request.commissionStatus = "none";
    }
    else if (
      request.status === "completed" &&
      (!request.paymentMethod || Boolean(request.deliveryConfirmedAt)) &&
      request.disputeStatus !== "open" &&
      request.rating === null &&
      Number.isInteger(req.body.rating) &&
      req.body.rating >= 1 &&
      req.body.rating <= 5
    )
      request.rating = req.body.rating;
    else fail(409, "Essa alteração não está disponível para este frete.");
  } else if (
    req.user.role === "motorista" &&
    request.driverId === own(req.user)
  ) {
    if (request.status === "booked" && req.body.status === "transit") {
      if (request.paymentMethod === "pix_freteon" &&
          request.paymentStatus !== "simulated_paid")
        fail(409, "Aguarde o cliente simular o Pix antes de iniciar o transporte.");
      request.status = "transit";
    } else if (request.status === "transit" && req.body.status === "completed") {
      request.status = "completed";
      request.completedAt = new Date();
    } else fail(409, "Essa alteração não está disponível para este frete.");
  } else fail(403, "Você não pode alterar este frete.");
  await request.save();
  if (previousStatus !== request.status) {
    if (request.status === "booked" && request.driverId) {
      notifyInBackground([request.driverId], {
        role: "motorista",
        title: "Sua proposta foi aceita!",
        body: "Você foi escolhido para realizar um frete. Abra seu painel para iniciar.",
        id: String(request._id),
      });
    } else if (request.status === "cancelled" && request.driverId) {
      notifyInBackground([request.driverId], {
        role: "motorista",
        title: "Frete cancelado",
        body: "O cliente cancelou um frete contratado. Confira seu painel.",
        id: String(request._id),
      });
    } else if (request.status === "completed") {
      notifyInBackground([request.clientId], {
        role: "cliente",
        title: "Motorista concluiu o frete",
        body: "Confira a entrega e confirme o recebimento pelo FreteOn.",
        id: String(request._id),
      });
    }
  }
  res.json({ request: presentRequest(request, req.user) });
});
api.patch("/drivers/:id", authorize("master"), async (req, res) => {
  // Não permitir a antiga aprovação apenas por nome e telefone.
  fail(410, "A aprovação de motoristas agora exige análise documental na aba Motoristas.");
});

