import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlate, validPlate, validateDriverDetails, displayCnhDate, todayInPortoVelho,
} from "../../frontend/src/driverDocumentFields.js";

const now = new Date("2026-11-13T17:15:00Z");
const base = {
  plate: "ABC1D23",
  cnhExpiresAt: "2030-05-20",
  crlvYear: 2026,
  rntrcApplies: false,
  rntrc: "",
};

test("aceita placas Mercosul e antiga, com ou sem hífen/espaço e minúsculas", () => {
  for (const plate of ["ABC1D23", "abc1d23", "ABC-1234", "abc 1234", "ABC1234"]) {
    assert.equal(validPlate(plate), true);
    assert.equal(validateDriverDetails({ ...base, plate }, now).valid, true, plate);
  }
  assert.equal(normalizePlate("abc-1234"), "ABC1234");
  assert.equal(validPlate("AB12C34"), false);
});

test("permite salvar CNH que vence hoje em Porto Velho e amanhã", () => {
  assert.equal(todayInPortoVelho(now), "2026-11-13");
  assert.equal(validateDriverDetails({ ...base, cnhExpiresAt: "2026-11-13" }, now).valid, true);
  assert.equal(validateDriverDetails({ ...base, cnhExpiresAt: "13/11/2026" }, now).valid, true);
  assert.equal(validateDriverDetails({ ...base, cnhExpiresAt: "2026-11-14" }, now).valid, true);
  assert.match(validateDriverDetails({ ...base, cnhExpiresAt: "2026-11-12" }, now).errors.cnhExpiresAt, /vencida/);
});

test("valida calendário real em vez de alterar datas inválidas", () => {
  for (const date of ["2027-02-29", "2028-02-30", "2029-13-05", "2029-00-05", "abc"]) {
    assert.match(validateDriverDetails({ ...base, cnhExpiresAt: date }, now).errors.cnhExpiresAt, /data real/);
  }
  assert.equal(validateDriverDetails({ ...base, cnhExpiresAt: "2028-02-29" }, now).valid, true);
});

test("CNH salva no horário local não muda um dia ao reabrir", () => {
  const stored = new Date("2030-05-20T23:59:59-04:00").toISOString();
  assert.equal(stored.slice(0, 10), "2030-05-21");
  assert.equal(displayCnhDate(stored), "2030-05-20");
});

test("sinaliza separadamente placa, CNH, CRLV e RNTRC", () => {
  const invalid = validateDriverDetails({
    plate: "A1",
    cnhExpiresAt: "2020-01-01",
    crlvYear: 2024,
    rntrcApplies: true,
    rntrc: "x123",
  }, now);
  assert.equal(invalid.valid, false);
  assert.deepEqual(Object.keys(invalid.errors), ["plate", "cnhExpiresAt", "crlvYear", "rntrc"]);
  assert.equal(validateDriverDetails({ ...base, crlvYear: 2027 }, now).valid, true);
});
