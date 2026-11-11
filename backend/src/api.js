import { Router } from "express";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { Account, Freight, publicUser } from "./models.js";
import { authenticate, authorize, fail, text } from "./auth.js";

export const api = Router();
api.use(authenticate);
const own = (user) => String(user._id);
function validId(id) {
  if (!mongoose.isValidObjectId(id)) fail(404, "Registro não encontrado.");
}
function driverApproved(user) {
  if (user.status !== "approved")
    fail(403, "Seu cadastro precisa ser aprovado pelo administrador.");
}
function time(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail(400, "Informe um horário válido.");
  return value;
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
  return result;
}
api.get("/state", async (req, res) => {
  const userId = own(req.user);
  let query = {};
  if (req.user.role === "cliente") query = { clientId: userId };
  if (req.user.role === "motorista") {
    const conditions = [{ driverId: userId }, { "proposals.driverId": userId }];
    if (req.user.status === "approved") conditions.push({ status: "open" });
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
    if (req.user.role !== "master" && result.id !== userId) delete result.phone;
    return result;
  });
  const users =
    req.user.role === "master"
      ? (await Account.find().sort({ createdAt: -1 })).map(publicUser)
      : [];
  res.json({
    user: publicUser(req.user),
    available: req.user.available,
    drivers: people,
    users,
    requests: requests.map((request) => presentRequest(request, req.user)),
  });
});
api.patch("/availability", authorize("motorista"), async (req, res) => {
  driverApproved(req.user);
  if (typeof req.body.available !== "boolean")
    fail(400, "Disponibilidade inválida.");
  req.user.available = req.body.available;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
});
api.post("/requests", authorize("cliente"), async (req, res) => {
  const data = req.body;
  const fields = {
    title: text(data.title, 3, 70, "Carga"),
    origin: text(data.origin, 5, 180, "Retirada"),
    destination: text(data.destination, 5, 180, "Entrega"),
    description: text(data.description, 1, 500, "Detalhes"),
    vehicle: text(data.vehicle, 3, 40, "Veículo"),
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
  const photos = data.photos || [];
  if (
    !Array.isArray(photos) ||
    photos.length > 3 ||
    photos.some(
      (photo) =>
        typeof photo !== "string" ||
        !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo) ||
        photo.length > 810000,
    )
  )
    fail(400, "Envie até 3 fotos JPG, PNG ou WebP de até 600 KB cada.");
  const request = await Freight.create({
    ...fields,
    photos,
    helper: data.helper === true,
    clientId: own(req.user),
  });
  res.status(201).json({ request: presentRequest(request, req.user) });
});
api.post(
  "/requests/:id/proposals",
  authorize("motorista"),
  async (req, res) => {
    driverApproved(req.user);
    if (!req.user.available)
      fail(403, "Ative sua disponibilidade para enviar propostas.");
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
    res.json({ ok: true });
  },
);
api.patch("/requests/:id", async (req, res) => {
  validId(req.params.id);
  const request = await Freight.findById(req.params.id);
  if (!request || !canRead(request, req.user))
    fail(404, "Frete não encontrado.");
  if (req.user.role === "cliente" && request.clientId === own(req.user)) {
    if (req.body.status === "booked" && request.status === "open") {
      const proposal = request.proposals.find(
        (item) => item.id === req.body.selectedId,
      );
      if (!proposal) fail(400, "Proposta não encontrada.");
      if (
        !(await Account.exists({
          _id: proposal.driverId,
          role: "motorista",
          status: "approved",
        }))
      )
        fail(409, "Este motorista não está aprovado. Escolha outra proposta.");
      request.status = "booked";
      request.selectedId = proposal.id;
      request.driverId = proposal.driverId;
    } else if (
      req.body.status === "cancelled" &&
      ["open", "booked"].includes(request.status)
    )
      request.status = "cancelled";
    else if (
      request.status === "completed" &&
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
    if (
      (request.status === "booked" && req.body.status === "transit") ||
      (request.status === "transit" && req.body.status === "completed")
    )
      request.status = req.body.status;
    else fail(409, "Essa alteração não está disponível para este frete.");
  } else fail(403, "Você não pode alterar este frete.");
  await request.save();
  res.json({ request: presentRequest(request, req.user) });
});
api.patch("/drivers/:id", authorize("master"), async (req, res) => {
  validId(req.params.id);
  if (!["approved", "rejected"].includes(req.body.status))
    fail(400, "Situação inválida.");
  const driver = await Account.findOneAndUpdate(
    { _id: req.params.id, role: "motorista" },
    { $set: { status: req.body.status, available: false } },
    { new: true },
  );
  if (!driver) fail(404, "Motorista não encontrado.");
  res.json({ user: publicUser(driver) });
});
