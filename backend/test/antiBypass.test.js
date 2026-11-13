import test from "node:test";
import assert from "node:assert/strict";
import {
  PROPOSAL_OPTIONS, validProposalOptions, proposalDescription,
  hasExternalContact, safeChatMessage, canChat,
} from "../src/antiBypass.js";

test("propostas só aceitam opções estruturadas", () => {
  assert.deepEqual(validProposalOptions(["helper", "blanket"]), ["helper", "blanket"]);
  assert.equal(proposalDescription(["helper"]), "Ajudante incluso");
  assert.equal(Object.keys(PROPOSAL_OPTIONS).length, 6);
  assert.throws(() => validProposalOptions(["Whatsapp: 69999999999"]), /lista/);
  assert.throws(() => validProposalOptions(["helper", "helper"]), /lista/);
  assert.throws(() => validProposalOptions("helper"), /lista/);
});

test("mensagens barram telefone, WhatsApp, contato, site e negociação por fora", () => {
  for (const value of [
    "Me chama no zap", "WhatsApp 69 99999-9999", "69999999999",
    "Entra em https://example.com", "www.example.com",
    "me chama no insta", "@motorista123", "cancela o chamado",
    "por fora faço mais barato", "sem comissão fazemos",
  ]) {
    assert.equal(hasExternalContact(value), true, value);
    assert.throws(() => safeChatMessage(value), /contatos/);
  }
  assert.equal(safeChatMessage("Chego às 14h, a entrada é pelo portão azul."), "Chego às 14h, a entrada é pelo portão azul.");
  assert.throws(() => safeChatMessage(" "), /500/);
  assert.throws(() => safeChatMessage("a".repeat(501)), /500/);
});

test("chat só pertence aos dois contratantes após a contratação", () => {
  const r = { status: "open", clientId: "c1", driverId: null };
  assert.equal(canChat(r, "c1", "cliente"), false);
  r.status = "booked";
  r.driverId = "d1";
  assert.equal(canChat(r, "c1", "cliente"), true);
  assert.equal(canChat(r, "d1", "motorista"), true);
  assert.equal(canChat(r, "d2", "motorista"), false);
  assert.equal(canChat(r, "c2", "cliente"), false);
  assert.equal(canChat(r, "d1", "master"), false);
  r.status = "transit";
  assert.equal(canChat(r, "d1", "motorista"), true);
  r.status = "completed";
  assert.equal(canChat(r, "c1", "cliente"), true);
  r.status = "cancelled";
  assert.equal(canChat(r, "c1", "cliente"), false);
});
