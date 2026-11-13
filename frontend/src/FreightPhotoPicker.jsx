import { useEffect, useState } from "react";
import { Camera, ImagePlus, ImageOff, Trash2 } from "lucide-react";
import { optimizePhoto, photoCountAllowed } from "./imageProcessing.js";

export function FreightPhotoImage({ src, alt, className = "", eager = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className={`media-photo-fallback ${className}`} role="img" aria-label={alt || "Foto indisponível"}>
        <ImageOff size={21} />
        <small>Foto indisponível</small>
      </span>
    );
  }
  return <img src={src} alt={alt} className={className}
    decoding="async" loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />;
}

/** Upload para pedidos novos e para completar fotos dos fretes em andamento. */
export default function FreightPhotoPicker({
  photos = [],
  onAdd,
  onRemove,
  busy = false,
  onBusyChange,
  maxPhotos = 3,
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const disabled = busy || processing || photos.length >= maxPhotos;

  async function receive(event) {
    const input = event.currentTarget;
    const selected = Array.from(input.files || []);
    if (!selected.length || busy || processing) {
      input.value = "";
      return;
    }
    if (!photoCountAllowed(photos.length, selected.length, maxPhotos)) {
      setError(`O limite é de ${maxPhotos} fotos. Remova uma imagem ou escolha menos arquivos.`);
      input.value = "";
      return;
    }
    setProcessing(true);
    onBusyChange?.(true);
    setError("");
    setNotice("");
    try {
      // Serial para evitar pico de memória em celulares modestos.
      const optimized = [];
      for (const file of selected) optimized.push(await optimizePhoto(file, "cargo"));
      const result = await onAdd(optimized);
      if (result === false) {
        setError("Não foi possível salvar as fotos. Verifique a mensagem de erro e tente novamente.");
      } else {
        setNotice(`${optimized.length} foto(s) preparada(s) e adicionada(s).`);
      }
    } catch (err) {
      setError(err.message || "Não foi possível abrir ou salvar as fotos.");
    } finally {
      input.value = "";
      setProcessing(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="freight-photo-picker">
      <div className="photo-picker-title">
        <strong>Fotos da carga</strong>
        <span>{photos.length}/{maxPhotos} fotos</span>
      </div>
      <p className="muted">Tire uma foto agora ou escolha imagens salvas no seu celular.
        Fotos grandes são reduzidas automaticamente para carregar com mais facilidade.</p>
      <div className="photo-source-actions">
        <label aria-disabled={disabled}
          className={`secondary media-source-button${disabled ? " disabled" : ""}`}>
          <input className="media-native-file-input" type="file"
            accept="image/*,.heic,.heif" capture="environment"
            disabled={disabled} onChange={receive}
            aria-label="Abrir câmera para fotografar a carga" />
          <Camera size={17} /> Tirar foto
        </label>
        <label aria-disabled={disabled}
          className={`secondary media-source-button${disabled ? " disabled" : ""}`}>
          <input className="media-native-file-input" type="file"
            accept="image/*,.heic,.heif" multiple
            disabled={disabled} onChange={receive}
            aria-label="Escolher fotos da galeria" />
          <ImagePlus size={17} /> Escolher do aparelho
        </label>
      </div>
      <div className="photos cargo-photo-previews">
        {photos.map((photo, index) => (
          <div key={index}>
            <FreightPhotoImage src={photo} alt={`Foto ${index + 1} da carga`} eager />
            {onRemove && (
              <button type="button" disabled={busy || processing}
                aria-label={`Remover foto ${index + 1}`}
                onClick={() => onRemove(index)}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {processing && <p className="muted" role="status">Preparando as fotos para envio...</p>}
      {notice && <p className="photo-success" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {photos.length >= maxPhotos && (
        <small className="muted">Limite de {maxPhotos} fotos atingido.</small>
      )}
    </div>
  );
}
