import { useEffect, useState } from "react";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";
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

/**
 * Foto grande e centralizada. Um toque na própria foto revela as opções
 * de câmera, galeria e remoção, sem botões permanentes poluindo o perfil.
 * O input nativo permanece sobre cada opção para funcionar no PWA mobile.
 */
export default function ProfilePhotoEditor({ account, busy, onSave }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMenuOpen(false);
    setError("");
    setMessage("");
  }, [account?.id]);

  async function selectPhoto(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || processing || busy) {
      input.value = "";
      return;
    }
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const photo = await optimizePhoto(file, "profile");
      const saved = await onSave(photo);
      if (!saved) {
        setError("Não foi possível salvar a foto. Tente novamente.");
      } else {
        setMenuOpen(false);
        setMessage("Foto de perfil atualizada.");
      }
    } catch (err) {
      setError(err.message || "Não foi possível enviar a foto.");
    } finally {
      input.value = "";
      setProcessing(false);
    }
  }

  async function removePhoto() {
    if (busy || processing) return;
    setError("");
    setMessage("");
    try {
      const saved = await onSave("");
      if (!saved) {
        setError("Não foi possível remover a foto.");
      } else {
        setMenuOpen(false);
        setMessage("Foto de perfil removida.");
      }
    } catch (err) {
      setError(err.message || "Não foi possível remover a foto.");
    }
  }

  const disabled = busy || processing;
  function toggle() {
    if (disabled) return;
    setMenuOpen((open) => !open);
    setError("");
    setMessage("");
  }

  return (
    <div className="profile-photo-editor">
      <div className="profile-photo-portrait">
        <button
          type="button"
          className="profile-photo-trigger"
          aria-label={menuOpen ? "Fechar opções da foto de perfil" : "Toque para alterar sua foto de perfil"}
          aria-expanded={menuOpen}
          aria-controls="freteon-profile-photo-options"
          onClick={toggle}
          disabled={disabled}
          title="Toque para alterar a foto"
        >
          <Avatar account={account} large />
          {!menuOpen && (
            <span className="profile-photo-edit-badge" aria-hidden="true">
              <Camera size={18} />
            </span>
          )}
        </button>

        {menuOpen && (
          <div className="profile-photo-overlay" id="freteon-profile-photo-options" role="group" aria-label="Editar foto de perfil">
            <button type="button" className="profile-photo-overlay-close" aria-label="Fechar opções da foto"
              disabled={disabled} onClick={() => setMenuOpen(false)}>
              <X size={17}/>
            </button>
            <label className={`profile-photo-option${disabled ? " disabled" : ""}`}>
              <input className="media-native-file-input" type="file"
                accept="image/*,.heic,.heif" capture="user"
                onChange={selectPhoto} disabled={disabled}
                aria-label="Tirar nova foto de perfil" />
              <Camera size={16}/> Tirar foto
            </label>
            <label className={`profile-photo-option${disabled ? " disabled" : ""}`}>
              <input className="media-native-file-input" type="file"
                accept="image/*,.heic,.heif" onChange={selectPhoto}
                disabled={disabled} aria-label="Escolher foto da galeria" />
              <ImagePlus size={16}/> Galeria
            </label>
            {account?.profilePhoto && (
              <button type="button" className="profile-photo-option profile-photo-remove"
                disabled={disabled} onClick={removePhoto}>
                <Trash2 size={14}/> Remover foto
              </button>
            )}
          </div>
        )}
      </div>
      <p className="profile-photo-hint">
        {processing ? "Salvando sua foto..." : menuOpen ? "Escolha como alterar sua foto" : "Toque na foto para alterar"}
      </p>
      {message && <p className="photo-success" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
