/**
 * Processamento único de imagens para perfil, carga e documentos.
 * Preferimos FileReader/data: em Safari/iPhone (o fluxo anterior dependia
 * exclusivamente de blob:, bloqueado pela Content Security Policy).
 * Sempre enviamos JPEG reduzido ao servidor.
 */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "image/heic", "image/heif", "image/avif",
]);
const ACCEPTED_EXTENSIONS = /\.(?:jpe?g|png|webp|heic|heif|avif)$/i;

export function validateSourcePhoto(file) {
  if (!file) throw new Error("Escolha uma foto.");
  const mime = String(file.type || "").toLowerCase().split(";")[0];
  const extensionOkay = ACCEPTED_EXTENSIONS.test(String(file.name || ""));
  if (!(ACCEPTED_TYPES.has(mime) ||
        ((!mime || mime === "application/octet-stream") && extensionOkay))) {
    throw new Error("Formato não aceito. Selecione uma foto JPG, PNG, WebP ou HEIC.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error("A foto original deve ter entre 1 byte e 25 MB.");
  }
}

export function photoCountAllowed(existingCount, incomingCount, maxCount = 3) {
  return Number.isInteger(existingCount) && Number.isInteger(incomingCount) &&
    incomingCount > 0 && existingCount >= 0 &&
    existingCount + incomingCount <= maxCount;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível abrir a foto escolhida."));
    image.src = src;
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:")) {
        reject(new Error("O celular não conseguiu ler a foto."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler a foto. Tente outra imagem."));
    reader.onabort = () => reject(new Error("Leitura da foto cancelada."));
    try { reader.readAsDataURL(file); }
    catch { reject(new Error("Acesso à foto não permitido pelo aparelho.")); }
  });
}

async function decodeImage(file) {
  // FileReader não depende de URL.createObjectURL nem da política CSP para blob:.
  let fromFileReader;
  try {
    fromFileReader = await readAsDataUrl(file);
    return await loadImage(fromFileReader);
  } catch (originalError) {
    // Formatos HEIC/HEIF podem ser suportados pelo decodificador de arquivos
    // do aparelho mesmo quando a variante data: não funciona.
    if (!URL.createObjectURL) throw originalError;
    let url;
    try {
      url = URL.createObjectURL(file);
      return await loadImage(url);
    } catch {
      throw new Error(
        "O aparelho não conseguiu abrir a imagem. Tente JPG ou tire outra foto pela câmera.",
      );
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }
}

export async function optimizePhoto(file, kind = "cargo") {
  validateSourcePhoto(file);
  const image = await decodeImage(file);
  const isProfile = kind === "profile";
  const isDocument = kind === "document";
  const maxDimension = isProfile ? 400 : isDocument ? 1800 : 1280;
  const maxLength = isProfile ? 220000 : isDocument ? 820000 : 410000;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight)
    throw new Error("Imagem vazia ou inválida. Escolha outra foto.");

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  for (const factor of [1, 0.83, 0.68, 0.52, 0.4]) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * factor));
    canvas.height = Math.max(1, Math.round(height * factor));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu celular não conseguiu processar a imagem.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try { ctx.drawImage(image, 0, 0, canvas.width, canvas.height); }
    catch { throw new Error("Falha ao converter a foto. Tire outra imagem."); }

    for (const quality of [0.82, 0.7, 0.56, 0.43, 0.32]) {
      let result;
      try { result = canvas.toDataURL("image/jpeg", quality); }
      catch { throw new Error("Não foi possível gerar o JPG. Tente outra foto."); }
      if (result.startsWith("data:image/jpeg;base64,") && result.length <= maxLength) {
        return result;
      }
    }
  }
  throw new Error("A foto ainda está muito grande. Escolha uma imagem menor.");
}
