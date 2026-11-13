import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pushLogoutFilter } from "../src/pushLogout.js";

const user = { _id: "507f1f77bcf86cd799439011", role: "motorista" };
const activeDevice = "https://fcm.googleapis.com/fcm/send/motorista-dispositivo-a";
const otherDevice = "https://fcm.googleapis.com/fcm/send/motorista-dispositivo-b";

test("logout revoga somente a inscrição do dispositivo usado", () => {
  const filter = pushLogoutFilter(user, "motorista", activeDevice);
  assert.deepEqual(filter, {
    userId: String(user._id),
    endpointHash: createHash("sha256").update(activeDevice).digest("hex"),
  });
  assert.notEqual(filter.endpointHash, createHash("sha256").update(otherDevice).digest("hex"));
  assert.equal(Object.keys(filter).length, 2);
});

test("logout não revoga outros perfis nem todos os aparelhos se endpoint ausente", () => {
  assert.equal(pushLogoutFilter(user, "cliente", activeDevice), null);
  assert.equal(pushLogoutFilter(user, "motorista", ""), null);
  assert.equal(pushLogoutFilter(user, "motorista", "http://localhost"), null);
  assert.equal(pushLogoutFilter(null, "motorista", activeDevice), null);
});
