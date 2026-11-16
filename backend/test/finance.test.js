import test from "node:test";
import assert from "node:assert/strict";
import { bookFinancials, confirmDelivery, walletSummary, canStartTransport, isRealBankPayment, isApprovedPagBankTest } from "../src/finance.js";

async function request(method, price, rate = 10) {
  const freight = {
    paymentMethod: method,
    status: "open",
    driverId: "motorista-teste",
    commissionStatus: "none",
    disputeStatus: "none",
  };
  await bookFinancials(freight, { price }, { createdAt: new Date("2020-01-01") }, { standardRate: rate, introductoryRate: 5, introductoryDays: 30 });
  return freight;
}

test("Comissão de 10% é arredondada em centavos", async () => {
  const freight = await request("cash_driver", 299.90);
  assert.equal(freight.agreedPriceCents, 29990);
  assert.equal(freight.commissionCents, 2999);
  assert.equal(freight.driverNetCents, 26991);
});

test("Dinheiro/cartão: comissão só vence após entrega confirmada, em 72 horas", async () => {
  const freight = await request("card_driver", 150);
  assert.equal(freight.commissionStatus, "none");
  freight.status = "completed";
  const before = Date.now();
  confirmDelivery(freight);
  assert.equal(freight.commissionStatus, "pending");
  assert.equal(freight.paymentStatus, "received_driver");
  const dueIn = freight.commissionDueAt.getTime() - before;
  assert.ok(dueIn >= 72 * 3600000 && dueIn <= 72 * 3600000 + 2000);
});

test("Pagamento legado sem conciliação bancária não libera repasse", async () => {
  const freight = await request("pix_freteon", 200);
  freight.status = "completed";
  assert.throws(() => confirmDelivery(freight), /Aguarde a confirmação do Pix/);
  freight.paymentStatus = "simulated_paid";
  assert.throws(() => confirmDelivery(freight), /Aguarde a confirmação do Pix/);
  assert.equal(freight.payoutStatus, "none");
});

test("Pix real: confirmação do Mercado Pago libera repasse apenas após entrega", async () => {
  const freight = await request("pix_freteon", 200);
  freight.status = "completed";
  freight.paymentStatus = "paid_mp";
  confirmDelivery(freight);
  assert.equal(freight.payoutStatus, "available");
  assert.ok(freight.deliveryConfirmedAt instanceof Date);
});

test("Comissão vencida bloqueia novas propostas e contestação suspende o bloqueio", async () => {
  const freight = await request("cash_driver", 180);
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

test("Motorista recém-cadastrado recebe taxa promocional de 5%", async () => {
  const freight = { paymentMethod: "cash_driver" };
  await bookFinancials(freight, { price: 200 }, { createdAt: new Date() }, { standardRate: 10, introductoryRate: 5, introductoryDays: 30 });
  assert.equal(freight.commissionRate, 5);
  assert.equal(freight.commissionCents, 1000);
  assert.equal(freight.driverNetCents, 19000);
});

test("PagBank sandbox aprovado libera ciclo de teste sem saldo real", async () => {
  const vars = ["PAGBANK_ENABLED", "PAGBANK_ENV", "PAGBANK_TEST_FLOW_ENABLED"];
  const previous = vars.map(name => process.env[name]);
  process.env.PAGBANK_ENABLED = "true";
  process.env.PAGBANK_ENV = "sandbox";
  process.env.PAGBANK_TEST_FLOW_ENABLED = "true";
  try {
    const freight = await request("pix_freteon", 50);
    freight.status = "booked";
    freight.paymentProvider = "pagbank";
    freight.paymentProviderEnvironment = "sandbox";
    freight.pagbankTestApprovedAt = new Date();
    assert.equal(isRealBankPayment(freight), false);
    assert.equal(isApprovedPagBankTest(freight), true);
    assert.equal(canStartTransport(freight), true);
    freight.status = "completed";
    confirmDelivery(freight);
    assert.ok(freight.deliveryConfirmedAt instanceof Date);
    assert.equal(freight.payoutStatus, "none");
    assert.equal(walletSummary([freight], { role: "motorista", _id: "motorista-teste" }).availableCents, 0);
  } finally {
    vars.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test("Modo produção e sandbox desativado não liberam frete de teste", async () => {
  const vars = ["PAGBANK_ENABLED", "PAGBANK_ENV", "PAGBANK_TEST_FLOW_ENABLED"];
  const previous = vars.map(name => process.env[name]);
  try {
    const freight = await request("pix_freteon", 50);
    freight.status = "booked";
    freight.paymentProvider = "pagbank";
    freight.paymentProviderEnvironment = "sandbox";
    freight.pagbankTestApprovedAt = new Date();
    process.env.PAGBANK_ENABLED = "true";
    process.env.PAGBANK_ENV = "sandbox";
    process.env.PAGBANK_TEST_FLOW_ENABLED = "false";
    assert.equal(canStartTransport(freight), false);
    process.env.PAGBANK_TEST_FLOW_ENABLED = "true";
    process.env.PAGBANK_ENV = "production";
    assert.equal(canStartTransport(freight), false);
    freight.status = "completed";
    assert.throws(() => confirmDelivery(freight), /Aguarde a confirmação/);
  } finally {
    vars.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
