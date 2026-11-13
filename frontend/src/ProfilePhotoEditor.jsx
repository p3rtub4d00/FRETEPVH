import { useEffect, useId, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { optimizePhoto } from "./imageProcessing.js";

export function Avatar({ account, large = false }) {
  const [brokenPhoto, setBrokenPhoto] = useState(false);
  const photo = account?.profilePhoto || "";
  useEffect(() => setBrokenPhoto(false), [photo]);
  return (
    <span className={`avatar${large ? " large" : ""}`}>
      {photo && !brokenPhoto ? (
        <img
          src={photo}
          alt={`Foto de ${account.name || "perfil"}`}
          className="avatar-image"
          decoding="async"
          onError={() => setBrokenPhoto(true)}
        />
      ) : (
        account?.initials || "?"
      )}
    </span>
  );
}

export default function ProfilePhotoEditor({ account, busy, onSave }) {
  const cameraId = useId();
  const galleryId = useId();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || processing || busy) return;
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const photo = await optimizePhoto(file, "profile");
      const result = await onSave(photo);
      if (!result) setError("Não foi possível salvar a foto. Verifique o aviso na tela e tente novamente.");
      else setMessage("Sua foto foi salva e aparecerá no perfil.");
    } catch (err) {
      setError(err.message || "Não foi possível enviar a foto.");
    } finally {
      setProcessing(false);
    }
  }

  async function removePhoto() {
    if (busy || processing) return;
    setError("");
    setMessage("");
    try {
      const saved = await onSave("");
      if (!saved) setError("Não foi possível remover a foto.");
      else setMessage("Foto removida com sucesso.");
    } catch (err) {
      setError(err.message || "Não foi possível remover a foto.");
    }
  }

  const disabled = busy || processing;
  return (
    <div className="profile-photo-editor">
      <Avatar account={account} large />
      <div className="profile-photo-actions">
        <div className="photo-source-actions">
          <input
            id={cameraId}
            className="visually-hidden-media-input"
            type="file"
            accept="image/*"
            capture="user"
            onChange={selectPhoto}
            disabled={disabled}
            aria-label="Tirar foto para o perfil"
          />
          <label className={`secondary media-source-button${disabled ? " disabled" : ""}`}
            htmlFor={cameraId} aria-disabled={disabled}>
            <Camera size={17} /> Tirar foto
          </label>

          <input
            id={galleryId}
            className="visually-hidden-media-input"
            type="file"
            accept="image/*"
            onChange={selectPhoto}
            disabled={disabled}
            aria-label="Escolher foto do aparelho"
          />
          <label className={`secondary media-source-button${disabled ? " disabled" : ""}`}
            htmlFor={galleryId} aria-disabled={disabled}>
            <ImagePlus size={17} /> Escolher da galeria
          </label>
        </div>
        {account.profilePhoto && (
          <button type="button" className="text-button" disabled={disabled}
            onClick={removePhoto}>
            <Trash2 size={16} /> Remover foto
          </button>
        )}
        <small>Foto de perfil: tire uma selfie ou escolha uma imagem do celular. O sistema reduz automaticamente antes de salvar.</small>
        {processing && <p className="muted" role="status">Preparando e enviando foto...</p>}
        {message && <p className="photo-success" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
