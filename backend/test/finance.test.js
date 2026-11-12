import test from "node:test";
import assert from "node:assert/strict";
import { bookFinancials, confirmDelivery, walletSummary } from "../src/finance.js";

function request(method, price) {
  const freight = {
    paymentMethod: method,
    status: "open",
    driverId: "motorista-teste",
    commissionStatus: "none",
    disputeStatus: "none",
  };
  bookFinancials(freight, { price });
  return freight;
}

test("Comissão de 10% é arredondada em centavos", () => {
  const freight = request("cash_driver", 299.90);
  assert.equal(freight.agreedPriceCents, 29990);
  assert.equal(freight.commissionCents, 2999);
  assert.equal(freight.driverNetCents, 26991);
});

test("Dinheiro/cartão: comissão só vence após entrega confirmada, em 72 horas", () => {
  const freight = request("card_driver", 150);
  assert.equal(freight.commissionStatus, "none");
  freight.status = "completed";
  const before = Date.now();
  confirmDelivery(freight);
  assert.equal(freight.commissionStatus, "pending");
  assert.equal(freight.paymentStatus, "received_driver");
  const dueIn = freight.commissionDueAt.getTime() - before;
  assert.ok(dueIn >= 72 * 3600000 && dueIn <= 72 * 3600000 + 2000);
});

test("Pix simulado: repasse fica disponível após a entrega confirmada", () => {
  const freight = request("pix_freteon", 200);
  freight.status = "completed";
  assert.throws(() => confirmDelivery(freight), /Simule o pagamento Pix/);
  freight.paymentStatus = "simulated_paid";
  confirmDelivery(freight);
  assert.equal(freight.payoutStatus, "available");
  assert.equal(freight.driverNetCents, 18000);
});

test("Comissão vencida bloqueia novas propostas e contestação suspende o bloqueio", () => {
  const freight = request("cash_driver", 180);
  freight.status = "completed";
  confirmDelivery(freight);
  freight.commissionDueAt = new Date(Date.now() - 1000);
  const user = { role: "motorista", _id: "motorista-teste", pixKey: "" };
  assert.equal(walletSummary([freight], user).blocked, true);
  assert.equal(walletSummary([freight], user).overdueCents, 1800);
  freight.disputeStatus = "open";
  assert.equal(walletSummary([freight], user).blocked, false);
  freight.disputeStatus = "resolved_approved";
  freight.commissionStatus = "paid";
  assert.equal(walletSummary([freight], user).pendingCents, 0);
});
