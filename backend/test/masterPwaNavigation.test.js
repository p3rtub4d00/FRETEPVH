import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("../../frontend/public/manifest.webmanifest",import.meta.url),"utf8"));
test("PWA instalado pode abrir o painel Master sob o mesmo escopo",()=>{
  const origin = "https://fretepvh.onrender.com";
  const scope = new URL(manifest.scope, origin);
  assert.equal(manifest.display,"standalone");
  assert.equal(new URL(manifest.start_url,origin).pathname,"/");
  const master = new URL("/master",origin);
  assert.equal(master.origin,scope.origin);
  assert.equal(master.pathname.startsWith(scope.pathname),true);
});
