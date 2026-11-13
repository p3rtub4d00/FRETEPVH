import test from "node:test";
import assert from "node:assert/strict";
import { validateFreightPhotos } from "../src/api.js";

function jpegImage(body = "AQIDBA==") {
  return "data:image/jpeg;base64," + body;
}

test("aceita imagens JPEG otimizadas para os três slots", () => {
  const photos = [jpegImage(), jpegImage(), jpegImage()];
  assert.deepEqual(validateFreightPhotos(photos), photos);
});

test("bloqueia anexos que não sejam raster JPEG, PNG, WebP", () => {
  assert.throws(() => validateFreightPhotos([
    "https://exemplo.com/foto.png",
  ]), /Envie até 3 fotos/);
  assert.throws(() => validateFreightPhotos([
    "data:image/svg+xml;base64,PHN2Zz4=",
  ]), /Envie até 3 fotos/);
});

test("não permite mais que três fotos nem base64 muito grande", () => {
  assert.throws(() => validateFreightPhotos(Array(4).fill(jpegImage())), /Envie até 3 fotos/);
  assert.throws(() => validateFreightPhotos([jpegImage("a".repeat(810000))]), /Reduza/);
});
