import { applyRefund, refundBlocks } from "./refunds.js";
import { Router } from "express";
import mongoose from "mongoose";
import { Account, Freight } from "./models.js";
import { authorize, fail, text } from "./auth.js";
import { notifyInBackground, notifyMasters } from "./webPush.js";
import { mercadoPagoEnabled, refundMercadoPagoPayment, MercadoPagoOrder } from "./mercadoPago.js";
import { refundPagBankPayment, PagBankOrder } from "./pagBank.js";
import { getPaymentProvider } from "./paymentProviderSettings.js";

export const PAYMENT_METHODS = ["pix_freteon", "card_driver", "cash_driver"];
import { commissionConfig, commissionForDriver } from "./commissionSettings.js";
const COMMISSION_WINDOW_MS = 72 * 60 * 60 * 1000;
export const finance = Router();

const own = (user) => String(user._id);
const cents = (value) => Math.round(value * 100);

export async function bookFinancials(request, proposal, driver, suppliedConfig = null) {
  if (!PAYMENT_METHODS.includes(request.paymentMethod)) return; // legado sem cobrança.
  const gross = cents(proposal.price);
  const config = suppliedConfig ?? await commissionConfig();
  const { rate } = commissionForDriver(driver, config);
  const commission = Math.round(gross * rate / 100);
  request.agreedPriceCents = gross;
  request.commissionCents = commission;
  request.driverNetCents = gross - commission;
  request.commissionRate = rate;
  request.paymentStatus = "awaiting";
  request.commissionStatus = "none";
  request.payoutStatus = "none";
}

// Um retorno aprovado no sandbox não comprova o recebimento de dinheiro.
export function isRealBankPayment(request) {
  return request?.paymentStatus === "paid_mp" ||
    (request?.paymentStatus === "paid_pagbank" &&
      request?.paymentProviderEnvironment === "production");
}

// Exclusivo para percorrer o fluxo no PagBank Sandbox.
// Não corresponde a dinheiro real, não libera saques nem vira saldo de motorista.
export function isApprovedPagBankTest(request) {
  return process.env.PAGBANK_TEST_FLOW_ENABLED === "true" &&
    process.env.PAGBANK_ENABLED === "true" &&
    process.env.PAGBANK_ENV === "sandbox" &&
    request?.paymentMethod === "pix_freteon" &&
    request?.paymentStatus === "awaiting" &&
    request?.paymentProvider === "pagbank" &&
    request?.paymentProviderEnvironment === "sandbox" &&
    Boolean(request?.pagbankTestApprovedAt);
}
export function canStartTransport(request) {
  return isRealBankPayment(request) || isApprovedPagBankTest(request);
}

export function confirmDelivery(request) {
  if (refundBlocks(request)) fail(409, "O reembolso bloqueia a confirmação e o repasse deste frete.");
  if (request.status !== "completed" || request.deliveryConfirmedAt)
    fail(409, "Esta entrega não pode ser confirmada novamente.");
  if (request.disputeStatus === "open" || request.disputeStatus === "resolved_cancelled")
    fail(409, "A entrega está em análise ou foi cancelada pela administração.");
  if (request.paymentMethod === "pix_freteon") {
    if (!canStartTransport(request))
      fail(409, "Aguarde a confirmação do Pix pelo banco antes de confirmar a entrega.");
    // Tanto a confirmação real quanto a homologação liberam a etapa de
    // solicitação na carteira; o resumo mantém os saldos em categorias distintas.
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

export function walletSummary(requests, user, realEnabled = false) {
  const selected = user.role === "motorista"
    ? requests.filter((request) => request.driverId === own(user))
    : requests;
  let pendingCents = 0;
  let overdueCents = 0;
  let availableCents = 0;
  let requestedCents = 0;
  let paidOutCents = 0;
  let commissionsPaidCents = 0;
  let testAvailableCents = 0;
  let testRequestedCents = 0;
  let testPaidOutCents = 0;
  let testCommissionsPaidCents = 0;
  let commissionRevenueCents = 0;
  let testCommissionRevenueCents = 0;
  const now = Date.now();
  for (const request of selected) {
    const sandbox = request.paymentProviderEnvironment === "sandbox" &&
      Boolean(request.pagbankTestApprovedAt) && request.paymentProvider === "pagbank";
    if (request.commissionStatus === "pending") {
      pendingCents += request.commissionCents || 0;
      if (request.commissionDueAt && new Date(request.commissionDueAt).getTime() <= now &&
          request.disputeStatus !== "open")
        overdueCents += request.commissionCents || 0;
    }
    if (!refundBlocks(request) && request.disputeStatus !== "open") {
      if (request.payoutStatus === "available") {
        if (sandbox) testAvailableCents += request.driverNetCents || 0;
        else availableCents += request.driverNetCents || 0;
      }
      if (request.payoutStatus === "requested") {
        if (sandbox) testRequestedCents += request.driverNetCents || 0;
        else requestedCents += request.driverNetCents || 0;
      }
    }
    if (request.payoutStatus === "paid_sandbox") testPaidOutCents += request.driverNetCents || 0;
    if (["paid_simulated", "paid_manual"].includes(request.payoutStatus)) paidOutCents += request.driverNetCents || 0;
    if (request.commissionStatus === "paid") {
      if (request.commissionProviderEnvironment === "sandbox") testCommissionsPaidCents += request.commissionCents || 0;
      else commissionsPaidCents += request.commissionCents || 0;
    }

    // Receita efetivamente confirmada: comissão paga pelo motorista
    // ou comissão retida em Pix real após a entrega. Não incluir
    // reembolsos, disputas abertas, registros legados sem provedor
    // nem pagamentos do PagBank Sandbox.
    const eligible = Number.isSafeInteger(request.commissionCents) &&
      request.commissionCents > 0 &&
      !refundBlocks(request) &&
      !["open", "resolved_cancelled"].includes(request.disputeStatus);
    if (!eligible) continue;

    if (["cash_driver", "card_driver"].includes(request.paymentMethod) &&
        request.commissionStatus === "paid") {
      if (request.commissionProviderEnvironment === "sandbox") {
        testCommissionRevenueCents += request.commissionCents;
      } else if (["mercadopago", "pagbank"].includes(request.commissionProvider) &&
        request.commissionProviderEnvironment !== "sandbox") {
        commissionRevenueCents += request.commissionCents;
      }
    }
    if (request.paymentMethod === "pix_freteon" &&
        request.status === "completed" && request.deliveryConfirmedAt) {
      if (sandbox && request.paymentStatus === "awaiting") {
        testCommissionRevenueCents += request.commissionCents;
      } else if (isRealBankPayment(request)) {
        commissionRevenueCents += request.commissionCents;
      }
    }
  }
  return {
    simulated: !realEnabled,
    pendingCents,
    overdueCents,
    availableCents,
    requestedCents,
    paidOutCents,
    commissionsPaidCents,
    testAvailableCents,
    testRequestedCents,
    testPaidOutCents,
    testCommissionsPaidCents,
    commissionRevenueCents,
    testCommissionRevenueCents,
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
  if (action === "request_payout" && req.user.role === "motorista" &&
      (!req.user.phoneVerifiedAt || req.user.phoneVerifiedNumber !== req.user.phone))
    fail(403, "Verifique seu celular em Meu perfil antes de solicitar repasse.");
  const gateway = await getPaymentProvider();
  // Não voltar ao modo de teste se alguma conta real estiver configurada.
  const realEnabled = gateway.enabled || gateway.anyReady;
  const isClient = req.user.role === "cliente" && request.clientId === own(req.user);
  const isDriver = req.user.role === "motorista" && request.driverId === own(req.user);
  const isMaster = req.user.role === "master";
  if (!isClient && !isDriver && !isMaster)
    fail(403, "Você não tem acesso a este frete.");
  // Nunca registrar cobrança, devolução ou quitação sem retorno do provedor.
  // Comandos antigos de teste não podem modificar registros na versão operacional.
  if (["simulate_pix_payment", "simulate_refund", "notify_commission", "confirm_commission_master"].includes(action))
    fail(409, "Este procedimento foi descontinuado. Utilize o pagamento Pix confirmado pelo banco.");

  const refundAction = ["request_refund", "approve_refund", "reject_refund", "simulate_refund"].includes(action);
  if (!refundAction && refundBlocks(request))
    fail(409, "Este frete está bloqueado por uma solicitação de reembolso.");
  if (refundAction) {
    if (action === "simulate_refund")
      fail(409, "Devoluções exigem confirmação do provedor de pagamento.");
    const realRefund = action === "approve_refund" &&
      ["paid_mp", "paid_pagbank"].includes(request.paymentStatus);
    const provider = request.paymentStatus;
    applyRefund(request, req.user, action, req.body.reason);
    if (realRefund) {
      if (provider === "paid_pagbank") await refundPagBankPayment(request);
      else await refundMercadoPagoPayment(request);
      request.refundStatus = provider === "paid_pagbank" ? "refunded_pagbank" : "refunded_mp";
      request.paymentStatus = request.refundStatus;
      request.refundedAt = new Date();
      request.refundedBy = own(req.user);
    }
  } else if (action === "simulate_pix_payment" && isClient) {
    if (realEnabled ||
        await MercadoPagoOrder.exists({ freightId: request._id, kind: "freight" }) ||
        await PagBankOrder.exists({ freightId: request._id, kind: "freight" }))
      fail(409, "Este Pix deve ser confirmado pelo provedor de pagamento, não por simulação.");
    if (request.paymentMethod !== "pix_freteon" ||
        request.status !== "booked" || request.paymentStatus !== "awaiting")
      fail(409, "O pagamento simulado só pode ser confirmado após contratar o motorista.");
    request.paymentStatus = "simulated_paid";
  } else if (action === "confirm_delivery" && isClient) {
    confirmDelivery(request);
  } else if (action === "report_issue" && isClient) {
    if (request.status !== "completed" ||
        ["paid_simulated", "paid_manual"].includes(request.payoutStatus) ||
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
    if (!isApprovedPagBankTest(request) &&
        (!req.user.pixKey || req.user.pixKey.trim().length < 6))
      fail(409, "Cadastre sua chave Pix na carteira antes de solicitar o repasse.");
    request.payoutStatus = "requested";
    request.payoutRequestedAt = new Date();
  } else if (action === "notify_commission" && isDriver) {
    if (realEnabled || await MercadoPagoOrder.exists({ freightId: request._id, kind: "commission" }) ||
        await PagBankOrder.exists({ freightId: request._id, kind: "commission" }))
      fail(409, "Gere o Pix da comissão pelo provedor de pagamento.");
    if (request.commissionStatus !== "pending" || request.disputeStatus === "open" ||
        !["cash_driver", "card_driver"].includes(request.paymentMethod))
      fail(409, "Esta comissão não está pendente.");
    request.commissionPaymentRequestedAt = new Date();
  } else if (action === "confirm_delivery_master" && isMaster) {
    confirmDelivery(request);
  } else if (action === "confirm_commission_master" && isMaster) {
    if (realEnabled || await MercadoPagoOrder.exists({ freightId: request._id, kind: "commission" }) ||
        await PagBankOrder.exists({ freightId: request._id, kind: "commission" }))
      fail(409, "A quitação deve ser confirmada pelo provedor de pagamento.");
    if (request.commissionStatus !== "pending" || request.disputeStatus === "open" ||
        !request.commissionPaymentRequestedAt)
      fail(409, "Aguarde o motorista informar o pagamento da comissão.");
    request.commissionStatus = "paid";
    request.commissionPaidAt = new Date();
  } else if (action === "confirm_test_payout_master" && isMaster) {
    if (!isApprovedPagBankTest(request) || !request.deliveryConfirmedAt ||
        request.status !== "completed" || request.payoutStatus !== "requested" ||
        request.disputeStatus === "open" || refundBlocks(request))
      fail(409, "Somente repasses de homologação PagBank solicitados podem ser concluídos como teste.");
    // Registro manual de teste: NUNCA marcar como transferência bancária real.
    request.payoutStatus = "paid_sandbox";
    request.payoutPaidAt = new Date();
  } else if (action === "confirm_payout_master" && isMaster) {
    if (request.payoutStatus !== "requested" || request.disputeStatus === "open")
      fail(409, "Não existe repasse solicitado para confirmar.");
    const driver = await Account.findById(request.driverId);
    if (!driver?.pixKey) fail(409, "Motorista não cadastrou chave Pix.");
    const realTransfer = request.paymentStatus === "paid_mp" ||
      (request.paymentStatus === "paid_pagbank" &&
        request.paymentProviderEnvironment === "production");
    if (!realTransfer)
      fail(409, "Repasse bancário só pode ser registrado após recebimento Pix real e conferido.");
    const ref = String(req.body.reference || "").trim();
    if (ref.length < 6 || ref.length > 100)
      fail(400, "Informe o identificador do comprovante do repasse real.");
    request.payoutStatus = "paid_manual";
    request.payoutReference = ref;
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
    // Resolver uma contestação não devolve dinheiro automaticamente.
    // A situação de recebimento existente fica registrada até conciliação ou estorno real.
    if (request.paymentMethod !== "pix_freteon")
      request.paymentStatus = "none";
  } else {
    fail(403, "Ação financeira não autorizada ou inválida.");
  }
  await request.save();
  if (["request_payout", "notify_commission", "report_issue", "request_refund"].includes(action)) {
    void notifyMasters({ title: action === "request_payout" ? "Repasse solicitado" : action === "notify_commission" ? "Comissão informada" : action === "report_issue" ? "Contestação recebida" : "Reembolso solicitado", body: "Há uma nova solicitação financeira para análise no painel Master.", category: "financeiro", id: String(request._id) });
  }
  if (refundAction) {
    const titles = {
      request_refund: "Cancelamento com reembolso em análise",
      approve_refund: "Reembolso aprovado · frete cancelado",
      reject_refund: "Solicitação de reembolso recusada",
      simulate_refund: "Reembolso concluído (simulação)",
    };
    for (const [id, role] of [[request.clientId, "cliente"], [request.driverId, "motorista"]]) {
      notifyInBackground([id], {
        role, title: titles[action], body: "Confira os detalhes e a decisão do pagamento no FreteOn.",
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
      body: "Consulte sua carteira para acompanhar comissão ou repasse.",
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
      title: "Repasse registrado",
      body: "O Master registrou o repasse. Confira a situação na carteira.",
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
