import test from "node:test";
import assert from "node:assert/strict";
import { isAcceptedDriverBooking, pendingDriverBookings } from "../../frontend/src/driverBooking.js";

const request = {
  id: "frete-1",
  status: "booked",
  driverId: "motorista-1",
  selectedId: "proposta-1",
  proposals: [
    { id: "proposta-1", driverId: "motorista-1", price: 500 },
    { id: "proposta-2", driverId: "motorista-2", price: 520 },
  ],
};

test("somente a proposta realmente escolhida dispara o alerta", () => {
  assert.equal(isAcceptedDriverBooking(request, "motorista-1"), true);
  assert.equal(isAcceptedDriverBooking(request, "motorista-2"), false);
});

test("não reabre quando já iniciou, concluiu ou cancelou", () => {
  for (const status of ["transit", "completed", "cancelled", "open"]) {
    assert.equal(isAcceptedDriverBooking({ ...request, status }, "motorista-1"), false);
  }
});

test("descarta ofertas de terceiros, mesmo quando há propostas do motorista", () => {
  assert.equal(isAcceptedDriverBooking({
    ...request, selectedId: "proposta-2",
    driverId: "motorista-2",
  }, "motorista-1"), false);
  assert.deepEqual(pendingDriverBookings([request], "motorista-1"), [request]);
  assert.deepEqual(pendingDriverBookings([request], "motorista-2"), []);
});
