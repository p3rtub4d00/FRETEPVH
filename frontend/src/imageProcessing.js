/**
 * Processa fotos locais antes de enviar ao FreteOn.
 * iPhone/Android podem fornecer imagens grandes (incluindo HEIC no Safari).
 * A saída é sempre JPEG com tamanho reduzido, evitando limite do servidor.
 */
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export function validateSourcePhoto(file) {
  if (!file) throw new Error("Escolha uma foto.");
  const type = String(file.type || "").toLowerCase();
  if (!(ALLOWED.has(type) || (!type && EXTENSIONS.test(file.name || ""))))
    throw new Error("Use uma foto JPG, PNG, WebP ou HEIC. Outros tipos não são aceitos.");
  if (!Number.isFinite(file.size) || file.size === 0 || file.size > MAX_SOURCE_BYTES)
    throw new Error("A foto original deve ter no máximo 16 MB.");
}

export function photoCountAllowed(existingCount, incomingCount, maxCount = 3) {
  return Number.isInteger(existingCount) && Number.isInteger(incomingCount) &&
    incomingCount > 0 && existingCount >= 0 &&
    existingCount + incomingCount <= maxCount;
}

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = URL.createObjectURL(file);
      const img = new Image();
      const finish = (error) => {
        if (url) URL.revokeObjectURL(url);
        if (error) reject(error);
        else resolve(img);
      };
      img.onload = () => finish(null);
      img.onerror = () => finish(new Error(
        "Este formato não abriu no celular. Nas configurações da câmera, selecione JPG ou escolha outra imagem."
      ));
      img.src = url;
    } catch {
      if (url) URL.revokeObjectURL(url);
      reject(new Error("O navegador não conseguiu abrir essa foto. Tente outra imagem."));
    }
  });
}

export async function optimizePhoto(file, kind = "cargo") {
  validateSourcePhoto(file);
  const image = await decodeImage(file);
  const profile = kind === "profile";
  // Documentos exigem resolução superior à foto de perfil, sem
  // ultrapassar os limites do upload autenticado.
  const document = kind === "document";
  const maxWidth = profile ? 400 : document ? 1800 : 1280;
  const maxLength = profile ? 220000 : document ? 820000 : 410000;
  const imgWidth = image.naturalWidth || image.width;
  const imgHeight = image.naturalHeight || image.height;
  if (!imgWidth || !imgHeight)
    throw new Error("Imagem inválida. Selecione outra foto.");

  const ratio = Math.min(1, maxWidth / Math.max(imgWidth, imgHeight));
  const initialWidth = Math.max(1, Math.round(imgWidth * ratio));
  const initialHeight = Math.max(1, Math.round(imgHeight * ratio));

  for (const factor of [1, 0.83, 0.68, 0.52]) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(initialWidth * factor));
    canvas.height = Math.max(1, Math.round(initialHeight * factor));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a foto neste aparelho.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.78, 0.65, 0.52, 0.38]) {
      let result;
      try {
        result = canvas.toDataURL("image/jpeg", quality);
      } catch {
        throw new Error("Não foi possível converter esta foto. Tente tirar outra com a câmera.");
      }
      if (result.startsWith("data:image/jpeg;base64,") &&
          result.length <= maxLength)
        return result;
    }
  }
  throw new Error("Não foi possível reduzir a foto. Escolha uma imagem mais simples.");
}
