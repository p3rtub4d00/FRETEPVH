import { Router, json } from "express";
import { rateLimit } from "express-rate-limit";

export const maps = Router();
const mapsKey = () => (process.env.GOOGLE_MAPS_API_KEY || "").trim();
const center = { latitude: -8.7619, longitude: -63.9039 };

maps.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Muitas consultas ao mapa. Tente novamente mais tarde." },
  }),
);
maps.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.get("Sec-Fetch-Site") === "cross-site") {
    return res.status(403).json({ error: "Requisição não autorizada." });
  }
  if (req.method === "POST" && req.get("X-FreteOn-Request") !== "1") {
    return res.status(403).json({ error: "Requisição não autorizada." });
  }
  next();
});
maps.use(json({ limit: "4kb" }));

const failure = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export function validCoordinates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("Selecione um endereço válido no mapa.");
  }
  const { latitude, longitude } = value;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw failure("Coordenadas inválidas.");
  }
  return { latitude, longitude };
}

async function google(url, options = {}) {
  const key = mapsKey();
  if (!key) throw failure("O serviço de mapas ainda não foi configurado.", 503);
  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000),
      headers: {
        "X-Goog-Api-Key": key,
        ...(options.headers || {}),
      },
    });
  } catch {
    throw failure("Não foi possível consultar o mapa agora.", 502);
  }
  if (!response.ok) {
    throw failure("O serviço de mapas não respondeu corretamente.", 502);
  }
  try {
    return await response.json();
  } catch {
    throw failure("Resposta inválida do serviço de mapas.", 502);
  }
}

export async function calculateRoadRoute(origin, destination) {
  const from = validCoordinates(origin);
  const to = validCoordinates(destination);
  const result = await google("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: { location: { latLng: from } },
      destination: { location: { latLng: to } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      languageCode: "pt-BR",
      units: "METRIC",
    }),
  });
  const route = result.routes?.[0];
  const durationSeconds = Number(String(route?.duration || "").replace(/s$/, ""));
  if (
    !Number.isFinite(route?.distanceMeters) ||
    route.distanceMeters < 0 ||
    !Number.isFinite(durationSeconds)
  ) {
    throw failure("Não encontramos uma rota de carro entre esses endereços.", 422);
  }
  return {
    distanceMeters: Math.round(route.distanceMeters),
    durationMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
  };
}

maps.get("/config", (req, res) => {
  res.json({ enabled: Boolean(mapsKey()) });
});

maps.get("/suggest", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 3) return res.json({ suggestions: [] });
    if (q.length > 150) throw failure("Endereço muito longo.");
    const result = await google("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: q,
        languageCode: "pt-BR",
        regionCode: "br",
        includedRegionCodes: ["br"],
        locationBias: { circle: { center, radius: 40000 } },
      }),
    });
    res.json({
      suggestions: (result.suggestions || [])
        .map((entry) => ({
          placeId: entry.placePrediction?.placeId,
          label: entry.placePrediction?.text?.text,
        }))
        .filter((entry) => entry.placeId && entry.label)
        .slice(0, 6),
    });
  } catch (error) {
    next(error);
  }
});

maps.get("/place", async (req, res, next) => {
  try {
    const placeId = typeof req.query.id === "string" ? req.query.id : "";
    if (!/^[A-Za-z0-9_-]{5,256}$/.test(placeId)) {
      throw failure("Selecione um endereço válido.");
    }
    const result = await google(
      "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId),
      { headers: { "X-Goog-FieldMask": "formattedAddress,location" } },
    );
    res.json({
      address: result.formattedAddress,
      point: validCoordinates(result.location),
    });
  } catch (error) {
    next(error);
  }
});

maps.get("/reverse", async (req, res, next) => {
  try {
    const point = validCoordinates({
      latitude: Number(req.query.lat),
      longitude: Number(req.query.lng),
    });
    const params = new URLSearchParams({
      latlng: String(point.latitude) + "," + String(point.longitude),
      language: "pt-BR",
      region: "br",
      key: mapsKey(),
    });
    const result = await google(
      "https://maps.googleapis.com/maps/api/geocode/json?" + params,
    );
    const address = result.results?.[0]?.formatted_address;
    if (!address) {
      throw failure("Não foi possível encontrar o endereço do seu GPS.", 422);
    }
    res.json({ address, point });
  } catch (error) {
    next(error);
  }
});

maps.post("/route", async (req, res, next) => {
  try {
    res.json(
      await calculateRoadRoute(req.body?.origin, req.body?.destination),
    );
  } catch (error) {
    next(error);
  }
});
