import { applyRefund, refundBlocks } from "./refunds.js";
import { Router } from "express";
import mongoose from "mongoose";
import { Account, Freight } from "./models.js";
import { authorize, fail, text } from "./auth.js";
import { notifyInBackground } from "./webPush.js";

export const PAYMENT_METHODS = ["pix_freteon", "card_driver", "cash_driver"];
export const COMMISSION_PERCENT = 10;
const COMMISSION_WINDOW_MS = 72 * 60 * 60 * 1000;
export const finance = Router();

const own = (user) => String(user._id);
const cents = (value) => Math.round(value * 100);

export function bookFinancials(request, proposal) {
  if (!PAYMENT_METHODS.includes(request.paymentMethod)) return; // legado sem cobrança.
  const gross = cents(proposal.price);
  const commission = Math.round(gross * COMMISSION_PERCENT / 100);
  request.agreedPriceCents = gross;
  request.commissionCents = commission;
  request.driverNetCents = gross - commission;
  request.commissionRate = COMMISSION_PERCENT;
  request.paymentStatus = "awaiting";
  request.commissionStatus = "none";
  request.payoutStatus = "none";
}

export function confirmDelivery(request) {
  if (refundBlocks(request)) fail(409, "O reembolso bloqueia a confirmação e o repasse deste frete.");
  if (request.status !== "completed" || request.deliveryConfirmedAt)
    fail(409, "Esta entrega não pode ser confirmada novamente.");
  if (request.disputeStatus === "open" || request.disputeStatus === "resolved_cancelled")
    fail(409, "A entrega está em análise ou foi cancelada pela administração.");
  if (request.paymentMethod === "pix_freteon") {
    if (request.paymentStatus !== "simulated_paid")
      fail(409, "Simule o pagamento Pix antes de liberar o repasse.");
    request.payoutStatus = "available";
  } else if (["card_driver", "cash_driver"].includes(request.paymentMethod)) {
    request.paymentStatus = "received_driver";
    request.commissionStatus = "pending";
    request.commissionDueAt = new Date(Date.now() + COMMISSION_WINDOW_MS);
  } else {
    fail(409, "Este pedido antigo não tem modalidade financeira definida.");
  }
  request.deliveryConfirmedAt = new Date();
}

export async function overdueDriver(driverId) {
  return Boolean(
    await Freight.exists({
      driverId,
      commissionStatus: "pending",
      commissionDueAt: { $lte: new Date() },
      disputeStatus: { $ne: "open" },
    }),
  );
}

export function walletSummary(requests, user) {
  const selected = user.role === "motorista"
    ? requests.filter((request) => request.driverId === own(user))
    : requests;
  let pendingCents = 0;
  let overdueCents = 0;
  let availableCents = 0;
  let requestedCents = 0;
  let paidOutCents = 0;
  let commissionsPaidCents = 0;
  const now = Date.now();
  for (const request of selected) {
    if (request.commissionStatus === "pending") {
      pendingCents += request.commissionCents || 0;
      if (request.commissionDueAt && new Date(request.commissionDueAt).getTime() <= now &&
          request.disputeStatus !== "open")
        overdueCents += request.commissionCents || 0;
    }
    if (!refundBlocks(request) && request.disputeStatus !== "open" && request.payoutStatus === "available") availableCents += request.driverNetCents || 0;
    if (!refundBlocks(request) && request.disputeStatus !== "open" && request.payoutStatus === "requested") requestedCents += request.driverNetCents || 0;
    if (request.payoutStatus === "paid_simulated") paidOutCents += request.driverNetCents || 0;
    if (request.commissionStatus === "paid") commissionsPaidCents += request.commissionCents || 0;
  }
  return {
    simulated: true,
    pendingCents,
    overdueCents,
    availableCents,
    requestedCents,
    paidOutCents,
    commissionsPaidCents,
    blocked: user.role === "motorista" && overdueCents > 0,
    pixKey: user.role === "motorista" ? user.pixKey || "" : undefined,
  };
}

finance.patch("/payment-preferences", authorize("motorista"), async (req, res) => {
  if (typeof req.body.acceptsCard !== "boolean")
    fail(400, "Indique se você aceita cartão na sua maquininha.");
  const pixKey = req.body.pixKey === "" ? "" : text(req.body.pixKey, 6, 150, "Chave Pix");
  req.user.acceptsCard = req.body.acceptsCard;
  req.user.pixKey = pixKey;
  await req.user.save();
  res.json({ ok: true });
});

finance.post("/requests/:id/finance", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    fail(404, "Frete não encontrado.");
  const request = await Freight.findById(req.params.id);
  if (!request) fail(404, "Frete não encontrado.");
  if (!PAYMENT_METHODS.includes(request.paymentMethod))
    fail(409, "Este frete anterior não possui pagamento registrado.");
  const action = req.body.action;
  const isClient = req.user.role === "cliente" && request.clientId === own(req.user);
  const isDriver = req.user.role === "motorista" && request.driverId === own(req.user);
  const isMaster = req.user.role === "master";
  if (!isClient && !isDriver && !isMaster)
    fail(403, "Você não tem acesso a este frete.");

  const refundAction = ["request_refund", "approve_refund", "reject_refund", "simulate_refund"].includes(action);
  if (!refundAction && refundBlocks(request))
    fail(409, "Este frete está bloqueado por uma solicitação de reembolso.");
  if (refundAction) {
    applyRefund(request, req.user, action, req.body.reason);
  } else if (action === "simulate_pix_payment" && isClient) {
    if (request.paymentMethod !== "pix_freteon" ||
        request.status !== "booked" || request.paymentStatus !== "awaiting")
      fail(409, "O pagamento simulado só pode ser confirmado após contratar o motorista.");
    request.paymentStatus = "simulated_paid";
  } else if (action === "confirm_delivery" && isClient) {
    confirmDelivery(request);
  } else if (action === "report_issue" && isClient) {
    if (request.status !== "completed" ||
        request.payoutStatus === "paid_simulated" ||
        request.commissionStatus === "paid" ||
        request.disputeStatus !== "none")
      fail(409, "Esta entrega não permite nova contestação.");
    request.disputeReason = text(req.body.reason, 10, 500, "Descreva o problema");
    request.disputeStatus = "open";
    request.disputedAt = new Date();
  } else if (action === "request_payout" && isDriver) {
    if (request.status !== "completed" ||
        request.payoutStatus !== "available" ||
        request.disputeStatus === "open" ||
        request.paymentMethod !== "pix_freteon")
      fail(409, "Este repasse ainda não está disponível.");
    if (!req.user.pixKey || req.user.pixKey.trim().length < 6)
      fail(409, "Cadastre sua chave Pix na carteira antes de solicitar o repasse.");
    request.payoutStatus = "requested";
    request.payoutRequestedAt = new Date();
  } else if (action === "notify_commission" && isDriver) {
    if (request.commissionStatus !== "pending" || request.disputeStatus === "open" ||
        !["cash_driver", "card_driver"].includes(request.paymentMethod))
      fail(409, "Esta comissão não está pendente.");
    request.commissionPaymentRequestedAt = new Date();
  } else if (action === "confirm_delivery_master" && isMaster) {
    confirmDelivery(request);
  } else if (action === "confirm_commission_master" && isMaster) {
    if (request.commissionStatus !== "pending" || request.disputeStatus === "open")
      fail(409, "Não existe comissão pendente para confirmar.");
    request.commissionStatus = "paid";
    request.commissionPaidAt = new Date();
  } else if (action === "confirm_payout_master" && isMaster) {
    if (request.payoutStatus !== "requested" || request.disputeStatus === "open")
      fail(409, "Não existe repasse solicitado para confirmar.");
    const driver = await Account.findById(request.driverId);
    if (!driver?.pixKey) fail(409, "Motorista não cadastrou chave Pix.");
    request.payoutStatus = "paid_simulated";
    request.payoutPaidAt = new Date();
  } else if (action === "resolve_dispute_accept_master" && isMaster) {
    if (request.disputeStatus !== "open")
      fail(409, "Não existe contestação pendente.");
    request.disputeStatus = "resolved_approved";
    if (!request.deliveryConfirmedAt) {
      confirmDelivery(request);
    } else if (request.commissionStatus === "pending") {
      // A comissão contestada só volta a vencer 72h após a resolução.
      request.commissionDueAt = new Date(Date.now() + COMMISSION_WINDOW_MS);
    }
  } else if (action === "resolve_dispute_cancel_master" && isMaster) {
    if (request.disputeStatus !== "open" ||
        request.payoutStatus === "paid_simulated" ||
        request.commissionStatus === "paid")
      fail(409, "Esta contestação não pode ser cancelada.");
    request.disputeStatus = "resolved_cancelled";
    request.commissionStatus = "waived";
    request.commissionDueAt = null;
    request.payoutStatus = "none";
    request.paymentStatus = request.paymentMethod === "pix_freteon"
      ? "refunded_simulated"
      : "none";
  } else {
    fail(403, "Ação financeira não autorizada ou inválida.");
  }
  await request.save();
  if (refundAction) {
    const titles = {
      request_refund: "Cancelamento com reembolso em análise",
      approve_refund: "Reembolso aprovado · frete cancelado",
      reject_refund: "Solicitação de reembolso recusada",
      simulate_refund: "Reembolso concluído (simulação)",
    };
    for (const [id, role] of [[request.clientId, "cliente"], [request.driverId, "motorista"]]) {
      notifyInBackground([id], {
        role, title: titles[action], body: "Confira os detalhes e a decisão no FreteOn. Nenhum Pix real foi movimentado.",
        id: `refund-${action}-${request._id}`,
      });
    }
  }
  const event = {
    simulate_pix_payment: {
      to: [request.driverId], role: "motorista",
      title: "Pix de teste confirmado",
      body: "O cliente confirmou o pagamento simulado. Você já pode iniciar o frete.",
    },
    confirm_delivery: {
      to: [request.driverId], role: "motorista",
      title: "Entrega confirmada pelo cliente",
      body: "Consulte sua carteira para acompanhar comissão ou repasse simulado.",
    },
    confirm_delivery_master: {
      to: [request.driverId], role: "motorista",
      title: "Entrega confirmada",
      body: "O Master confirmou a entrega. Consulte a carteira.",
    },
    confirm_commission_master: {
      to: [request.driverId], role: "motorista",
      title: "Comissão quitada (simulação)",
      body: "O Master registrou o pagamento da comissão de teste.",
    },
    confirm_payout_master: {
      to: [request.driverId], role: "motorista",
      title: "Repasse registrado (simulação)",
      body: "O Master confirmou o repasse fictício. Nenhum Pix real foi enviado.",
    },
    report_issue: {
      to: [request.driverId], role: "motorista",
      title: "Frete em contestação",
      body: "O cliente informou um problema. A administração irá analisar.",
    },
  }[action];
  if (event) notifyInBackground(event.to, { ...event, id: String(request._id) });
  res.json({ ok: true });
});
