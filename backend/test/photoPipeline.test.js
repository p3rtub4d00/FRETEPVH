import test from "node:test";
import assert from "node:assert/strict";
import { optimizePhoto } from "../../frontend/src/imageProcessing.js";
import { validateFreightPhotos } from "../src/api.js";
import { verifyDocumentPayload } from "../src/driverVerification.js";

test("foto de câmera processa por FileReader sem depender de blob/CSP, nos três contextos", async () => {
  const previous = {
    FileReader: globalThis.FileReader,
    Image: globalThis.Image,
    document: globalThis.document,
  };
  const validJpeg = Buffer.alloc(350, 0x20);
  validJpeg[0] = 0xff;
  validJpeg[1] = 0xd8;
  validJpeg[validJpeg.length - 2] = 0xff;
  validJpeg[validJpeg.length - 1] = 0xd9;
  const output = "data:image/jpeg;base64," + validJpeg.toString("base64");
  class SimulatedFileReader {
    readAsDataURL() {
      this.result = "data:image/jpeg;base64," + Buffer.from("test image").toString("base64");
      queueMicrotask(() => this.onload());
    }
  }
  class SimulatedImage {
    set src(value) {
      assert.ok(value.startsWith("data:"), "não deve precisar de blob: para carregar foto");
      this.naturalWidth = 1600;
      this.naturalHeight = 900;
      queueMicrotask(() => this.onload());
    }
  }
  globalThis.FileReader = SimulatedFileReader;
  globalThis.Image = SimulatedImage;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return {
        getContext() {
          return { fillRect() {}, drawImage() {}, set fillStyle(value) {} };
        },
        toDataURL(type) {
          assert.equal(type, "image/jpeg");
          return output;
        },
      };
    },
  };
  try {
    const file = { type: "image/jpeg", name: "camera.jpg", size: 8_000_000 };
    for (const kind of ["profile", "cargo", "document"]) {
      const result = await optimizePhoto(file, kind);
      assert.equal(result, output);
      if (kind === "cargo") {
        assert.equal(validateFreightPhotos([result])[0], output);
      }
      if (kind === "document") {
        assert.deepEqual(verifyDocumentPayload(result), validJpeg);
      }
      if (kind === "profile") {
        assert.ok(result.length < 320000);
      }
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
