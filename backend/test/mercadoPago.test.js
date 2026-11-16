import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyMercadoPagoSignature, canCreateMercadoPagoPix } from "../src/mercadoPago.js";

test("webhook Mercado Pago valida assinatura HMAC e rejeita adulteração", () => {
  const id = "123456789";
  const requestId = "notification-abc";
  const secret = "segredo-exclusivo-para-teste";
  const ts = String(Date.now());
  const digest = createHmac("sha256", secret)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  const args = { signature: `ts=${ts},v1=${digest}`, requestId, paymentId: id, secret };
  assert.equal(verifyMercadoPagoSignature(args), true);
  assert.equal(verifyMercadoPagoSignature({ ...args, paymentId: "999999999" }), false);
  assert.equal(verifyMercadoPagoSignature({ ...args, requestId: "outro-id" }), false);
  assert.equal(verifyMercadoPagoSignature({ ...args, secret: "outro-segredo" }), false);
  assert.equal(verifyMercadoPagoSignature({ ...args, now: Date.now() + 20 * 60000 }), false);
  assert.equal(verifyMercadoPagoSignature({ ...args, signature: "" }), false);
});

test("Pix do frete usa valor contratado e apenas cliente dono", () => {
  const freight = { clientId: "cliente-teste", status: "booked",
    paymentMethod: "pix_freteon", paymentStatus: "awaiting", agreedPriceCents: 78900 };
  assert.equal(canCreateMercadoPagoPix(freight, "freight",
    { _id: "cliente-teste", role: "cliente" }), 78900);
  assert.throws(() => canCreateMercadoPagoPix(freight, "freight",
    { _id: "outro", role: "cliente" }), /não permite/);
  assert.throws(() => canCreateMercadoPagoPix({ ...freight, status: "cancelled" }, "freight",
    { _id: "cliente-teste", role: "cliente" }), /não permite/);
});

test("Pix de comissão usa porcentagem previamente salva e apenas motorista do frete", () => {
  const freight = { driverId: "motorista-teste", status: "completed",
    paymentMethod: "cash_driver", commissionStatus: "pending", commissionCents: 1200,
    disputeStatus: "none", refundStatus: "none" };
  assert.equal(canCreateMercadoPagoPix(freight, "commission",
    { _id: "motorista-teste", role: "motorista" }), 1200);
  assert.throws(() => canCreateMercadoPagoPix({ ...freight, commissionStatus: "paid" }, "commission",
    { _id: "motorista-teste", role: "motorista" }), /não permite/);
  assert.throws(() => canCreateMercadoPagoPix({ ...freight, disputeStatus: "open" }, "commission",
    { _id: "motorista-teste", role: "motorista" }), /não permite/);
  assert.throws(() => canCreateMercadoPagoPix(freight, "commission",
    { _id: "outro", role: "motorista" }), /não permite/);
});
