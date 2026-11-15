import test from "node:test";
import assert from "node:assert/strict";
import { calculateRoadRoute } from "../src/maps.js";

test("Routes API recebe origem/destino digitados e converte distância e tempo", async () => {
  const previousEnabled = process.env.PAID_MAPS_ENABLED;
  process.env.PAID_MAPS_ENABLED = "true";
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GOOGLE_MAPS_API_KEY;
  let payload;
  try {
    process.env.GOOGLE_MAPS_API_KEY = "chave-ficticia-para-teste";
    globalThis.fetch = async (url, options) => {
      assert.match(url, /routes.googleapis.com/);
      payload = JSON.parse(options.body);
      return { ok: true, json: async () => ({
        routes: [{ distanceMeters: 15250, duration: "1350s" }]
      }) };
    };
    const result = await calculateRoadRoute(
      "Rua Exemplo, 20, Porto Velho, Rondônia, Brasil",
      "Av. Exemplo, 450, Porto Velho, Rondônia, Brasil",
    );
    assert.deepEqual(payload.origin, {
      address: "Rua Exemplo, 20, Porto Velho, Rondônia, Brasil",
    });
    assert.equal(payload.travelMode, "DRIVE");
    assert.deepEqual(result, { distanceMeters: 15250, durationMinutes: 23 });
  } finally {
    if (previousEnabled === undefined) delete process.env.PAID_MAPS_ENABLED;
    else process.env.PAID_MAPS_ENABLED = previousEnabled;
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = previousKey;
  }
});

test("Coordenadas GPS continuam aceitas", async () => {
  const previousEnabled = process.env.PAID_MAPS_ENABLED;
  process.env.PAID_MAPS_ENABLED = "true";
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GOOGLE_MAPS_API_KEY;
  try {
    process.env.GOOGLE_MAPS_API_KEY = "chave-ficticia-para-teste";
    globalThis.fetch = async (url, options) => {
      const request = JSON.parse(options.body);
      assert.deepEqual(request.origin.location.latLng, {
        latitude: -8.76, longitude: -63.9
      });
      return { ok: true, json: async () => ({
        routes: [{ distanceMeters: 3000, duration: "600s" }]
      }) };
    };
    assert.deepEqual(
      await calculateRoadRoute(
        { latitude: -8.76, longitude: -63.9 },
        { latitude: -8.74, longitude: -63.88 },
      ),
      { distanceMeters: 3000, durationMinutes: 10 },
    );
  } finally {
    if (previousEnabled === undefined) delete process.env.PAID_MAPS_ENABLED;
    else process.env.PAID_MAPS_ENABLED = previousEnabled;
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = previousKey;
  }
});

test("Modo gratuito não faz chamadas pagas mesmo com chave cadastrada", async t => {
  const oldKey = process.env.GOOGLE_MAPS_API_KEY;
  const oldEnabled = process.env.PAID_MAPS_ENABLED;
  process.env.GOOGLE_MAPS_API_KEY = "fake";
  delete process.env.PAID_MAPS_ENABLED;
  t.mock.method(globalThis, "fetch", () => assert.fail("Não deve consultar API paga"));
  try { await assert.rejects(calculateRoadRoute("Rua Origem, 123", "Rua Destino, 456"), /não foi configurado/); }
  finally {
    if (oldKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = oldKey;
    if (oldEnabled === undefined) delete process.env.PAID_MAPS_ENABLED; else process.env.PAID_MAPS_ENABLED = oldEnabled;
  }
});
