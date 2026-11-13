import test from "node:test";
import assert from "node:assert/strict";
import { Freight } from "../src/models.js";

test("frete novo não exige escolha de veículo pelo cliente", () => {
  const request = new Freight({
    clientId: "507f1f77bcf86cd799439011",
    title: "Sofá",
    origin: "Av. Principal, 123",
    destination: "Rua dos Ipês, 456",
    description: "Sofá grande, dois andares",
    date: "2026-12-02", time: "14:00",
  });
  assert.equal(request.vehicle, "");
  const missingVehicle = request.validateSync();
  assert.equal(Boolean(missingVehicle?.errors?.vehicle), false);
});

test("fretes antigos que possuem veículo conservam o dado", () => {
  const request = new Freight({
    clientId: "507f1f77bcf86cd799439011",
    title: "Mudança",
    origin: "Rua 1, 123",
    destination: "Rua 2, 456",
    description: "Caixas",
    vehicle: "Picape",
    date: "2026-12-02", time: "14:00",
  });
  assert.equal(request.vehicle, "Picape");
  assert.equal(Boolean(request.validateSync()?.errors?.vehicle), false);
});
