import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";

export function Avatar({ account, large = false }) {
  return (
    <span className={`avatar${large ? " large" : ""}`}>
      {account?.profilePhoto ? (
        <img
          src={account.profilePhoto}
          alt={`Foto de ${account.name || "perfil"}`}
          className="avatar-image"
          loading="lazy"
        />
      ) : (
        account?.initials || "?"
      )}
    </span>
  );
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível abrir essa imagem. Envie JPG, PNG ou WebP."));
    };
    img.src = objectUrl;
  });
}

async function compressPhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 6_000_000)
    throw new Error("Selecione JPG, PNG ou WebP com até 6 MB.");
  const image = await readImage(file);
  const maxEdge = 400;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.78, 0.66, 0.5]) {
    const photo = canvas.toDataURL("image/jpeg", quality);
    if (photo.length <= 300000) return photo;
  }
  throw new Error("A foto ainda é muito grande. Tente outra imagem.");
}

export default function ProfilePhotoEditor({ account, busy, onSave }) {
  const inputRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  async function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const photo = await compressPhoto(file);
      await onSave(photo);
    } catch (err) {
      setError(err.message || "Erro ao enviar a foto.");
    } finally {
      setProcessing(false);
    }
  }
  const disabled = busy || processing;
  return (
    <div className="profile-photo-editor">
      <Avatar account={account} large />
      <div className="profile-photo-actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={selectPhoto}
          className="profile-photo-input"
          aria-label="Escolher foto de perfil"
        />
        <button type="button" className="secondary" disabled={disabled}
          onClick={() => inputRef.current?.click()}>
          <Camera size={16} />
          {processing ? "Preparando foto..." : account.profilePhoto ? "Trocar foto" : "Adicionar minha foto"}
        </button>
        {account.profilePhoto && (
          <button type="button" className="text-button" disabled={disabled}
            onClick={() => onSave("")}>
            <Trash2 size={16} /> Remover foto
          </button>
        )}
        <small>Foto de perfil: JPG, PNG ou WebP. Reduzida automaticamente para carregar mais rápido.</small>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
