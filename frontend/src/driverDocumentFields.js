/** Validações de formulário de motorista compartilhadas entre navegador e API. */
export const normalizePlate = (value) =>
  String(value ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const validPlate = (value) =>
  /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizePlate(value));

export function todayInPortoVelho(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Porto_Velho",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function normalizeCnhDate(value) {
  const raw = String(value ?? "").trim();
  // Navegadores enviam yyyy-mm-dd; aceita também dd/mm/yyyy de clientes antigos.
  const pt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (pt) return `${pt[3]}-${pt[2]}-${pt[1]}`;
  return raw;
}

export function validateDriverDetails(input, now = new Date()) {
  const errors = {};
  const plate = normalizePlate(input?.plate);
  if (!validPlate(plate)) {
    errors.plate = "Informe sete caracteres: ABC1234 (antiga) ou ABC1D23 (Mercosul).";
  }

  const cnhExpiresAt = normalizeCnhDate(input?.cnhExpiresAt);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cnhExpiresAt);
  const dateIsReal = Boolean(match && (() => {
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  })());
  if (!dateIsReal) {
    errors.cnhExpiresAt = "Informe a validade da CNH com uma data real (dia, mês e ano).";
  } else if (cnhExpiresAt < todayInPortoVelho(now)) {
    errors.cnhExpiresAt = "A CNH está vencida. Informe a data de validade que consta no documento.";
  } else if (Number(match[1]) > Number(todayInPortoVelho(now).slice(0, 4)) + 25) {
    errors.cnhExpiresAt = "Confira o ano de validade da CNH: a data informada está muito distante.";
  }

  const yearNow = Number(todayInPortoVelho(now).slice(0, 4));
  const rawYear = String(input?.crlvYear ?? "").trim();
  const crlvYear = /^\d{4}$/.test(rawYear) ? Number(rawYear) : NaN;
  if (!Number.isInteger(crlvYear) || crlvYear < yearNow || crlvYear > yearNow + 1) {
    errors.crlvYear = `Informe o exercício ${yearNow} do CRLV (ou ${yearNow + 1}, se já emitido).`;
  }

  const rntrcApplies = input?.rntrcApplies;
  if (typeof rntrcApplies !== "boolean") {
    errors.rntrcApplies = "Informe se a atividade de transporte exige RNTRC.";
  }
  const rntrc = String(input?.rntrc ?? "").replace(/\D/g, "");
  if (rntrcApplies === true && !/^\d{8,12}$/.test(rntrc)) {
    errors.rntrc = "Informe um número RNTRC com 8 a 12 dígitos para conferência manual.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      plate,
      cnhExpiresAt,
      crlvYear,
      rntrcApplies,
      rntrc: rntrcApplies ? rntrc : "",
    },
  };
}
