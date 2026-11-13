import test from "node:test";
import assert from "node:assert/strict";
import { validateSourcePhoto, photoCountAllowed } from "../../frontend/src/imageProcessing.js";

test("aceita originais de câmera grandes e formatos fotográficos", () => {
  assert.doesNotThrow(() => validateSourcePhoto({
    type: "image/jpeg", name: "camera.jpg", size: 7_000_000,
  }));
  assert.doesNotThrow(() => validateSourcePhoto({
    type: "image/heic", name: "IMG_0001.HEIC", size: 9_000_000,
  }));
  assert.doesNotThrow(() => validateSourcePhoto({
    type: "image/jpeg", name: "foto_17mb.jpg", size: 17_000_000,
  }));
  assert.doesNotThrow(() => validateSourcePhoto({
    type: "", name: "IMG_0001.heic", size: 6_000_000,
  }));
});

test("rejeita arquivos perigosos e imagens acima de 25MB", () => {
  assert.throws(() => validateSourcePhoto({
    type: "image/svg+xml", name: "vetor.svg", size: 400,
  }), /Formato não aceito/);
  assert.throws(() => validateSourcePhoto({
    type: "image/jpeg", name: "foto.jpg", size: 27_000_000,
  }), /25 MB/);
});

test("controla no máximo três fotos no pedido", () => {
  assert.equal(photoCountAllowed(0, 1), true);
  assert.equal(photoCountAllowed(1, 2), true);
  assert.equal(photoCountAllowed(2, 2), false);
  assert.equal(photoCountAllowed(3, 1), false);
});
