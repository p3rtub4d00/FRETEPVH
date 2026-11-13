import test from "node:test";
import assert from "node:assert/strict";
import { phoneNumber, text } from "../src/auth.js";

test("aceita celular brasileiro com DDD e espaços ou código do país", () => {
  assert.equal(phoneNumber("(69) 99990-8336"), "69999908336"); 
});

test("normaliza formato internacional e rejeita telefone fixo ou sem DDD", () => {
  assert.equal(phoneNumber("+55 (69) 99990-8336"), "69999908336");
  assert.throws(() => phoneNumber("6999908336"), /celular com DDD/);
  assert.throws(() => phoneNumber("123"), /celular com DDD/);
});

test("nome cadastral precisa ter tamanho mínimo e máximo", () => {
  assert.equal(text("  Nome de Teste  ", 3, 100, "Nome"), "Nome de Teste");
  assert.throws(() => text("AB", 3, 100, "Nome"), /3 e 100/);
  assert.throws(() => text("A".repeat(101), 3, 100, "Nome"), /3 e 100/);
});
