import test from "node:test";
import assert from "node:assert/strict";
import { calculateRoadRoute } from "../src/maps.js";

test("Routes API recebe origem/destino digitados e converte distância e tempo", async () => {
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
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = previousKey;
  }
});

test("Coordenadas GPS continuam aceitas", async () => {
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
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = previousKey;
  }
});
