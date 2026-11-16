import test from "node:test";
import assert from "node:assert/strict";
import { resetPreflightAllowed } from "../src/maintenanceReset.js";

function report() {
  return {
    counts: {
      masters: 1, mercadoPagoOrders: 0, pagBankOrdersProduction: 0,
      fretesAtivosForaHomologacao: 0,
      fretesFinanceirosRequeremPreservacao: 9
    },
    paymentEnvironment: {
      mpEnabled: false, pagBankEnvironment: "sandbox",
      pagBankProductionAllowed: false
    }
  };
}
test("Só permite reset com Master preservado e sem gateway de produção", () => {
  assert.equal(resetPreflightAllowed(report()), true);
  const cases = [
    p => { p.counts.masters = 0; },
    p => { p.counts.masters = 2; },
    p => { p.counts.mercadoPagoOrders = 1; },
    p => { p.counts.pagBankOrdersProduction = 1; },
    p => { p.counts.fretesAtivosForaHomologacao = 1; },
    p => { p.paymentEnvironment.mpEnabled = true; },
    p => { p.paymentEnvironment.pagBankEnvironment = "production"; },
    p => { p.paymentEnvironment.pagBankProductionAllowed = true; }
  ];
  for (const modify of cases) {
    const copy = report();
    modify(copy);
    assert.equal(resetPreflightAllowed(copy), false);
  }
});
