import { useEffect, useState } from "react";
import { api } from "./api.js";
import { optimizePhoto } from "./imageProcessing.js";
import { normalizePlate, validateDriverDetails, displayCnhDate } from "./driverDocumentFields.js";
import { Camera, ImagePlus, ShieldCheck, Lock, FileCheck2, Clock3, XCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";

const labels = {
  cnh: "CNH — habilitação",
  crlv: "CRLV — documento do veículo",
  selfie: "Selfie — rosto do motorista",
};
const statuses = {
  unsubmitted: "Documentação incompleta",
  pending: "Aguardando análise do Master",
  approved: "Documentação aprovada",
  rejected: "Correção solicitada",
  expired: "Documento vencido ou desatualizado",
};
const prettyDate = (date) => date ? new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Porto_Velho" }) : "—";

function DocUpload({ kind, exists, disabled, onUpload }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function upload(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || disabled || loading) {
      input.value = "";
      return;
    }
    setLoading(true);
    setError("");
    try {
      const image = await optimizePhoto(file, "document");
      const result = await onUpload(kind, image);
      if (!result) setError("Não foi possível salvar a imagem. Tente novamente.");
    } catch (err) {
      setError(err.message || "Imagem não enviada. Tente outra foto.");
    } finally {
      input.value = "";
      setLoading(false);
    }
  }
  return (
    <div className="verification-doc-row">
      <div className="verification-doc-info">
        <FileCheck2 size={21} />
        <div>
          <strong>{labels[kind]}</strong>
          <span>{exists ? "Foto enviada — pode substituir" : "Ainda não enviada"}</span>
        </div>
      </div>
      <div className="photo-source-actions">
        <label className={"secondary media-source-button" + (disabled || loading ? " disabled" : "")}>
          <input type="file" className="media-native-file-input"
            accept="image/*,.heic,.heif"
            capture={kind === "selfie" ? "user" : "environment"}
            onChange={upload} disabled={disabled || loading}
            aria-label={`Fotografar ${labels[kind]}`}/>
          <Camera size={16} /> Tirar foto
        </label>
        <label className={"secondary media-source-button" + (disabled || loading ? " disabled" : "")}>
          <input type="file" className="media-native-file-input"
            accept="image/*,.heic,.heif"
            onChange={upload} disabled={disabled || loading}
            aria-label={`Escolher ${labels[kind]} do aparelho`}/>
          <ImagePlus size={16} /> Escolher arquivo
        </label>
      </div>
      {loading && <p role="status" className="muted">Preparando imagem e enviando em segurança...</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function DocumentPreview({ driverId, kind }) {
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setImage(""); setError(""); }, [driverId, kind]);
  async function toggle() {
    if (image) { setImage(""); return; }
    setBusy(true);
    setError("");
    try {
      const result = await api(`/driver-verification/${driverId}/documents/${kind}`);
      setImage(result.image || "");
    } catch (err) {
      setError(err.message || "Não foi possível abrir a foto.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="verification-preview">
      <button type="button" className="secondary" disabled={busy} onClick={toggle}>
        {image ? <EyeOff size={16}/> : <Eye size={16}/>}
        {busy ? "Abrindo..." : image ? "Ocultar imagem" : "Visualizar documento"}
      </button>
      {image && <img src={image} alt={labels[kind]} className="verification-document-image"/>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export default function DriverVerificationPanel({ driverId, role, onChange }) {
  const isMaster = role === "master";
  const [info, setInfo] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showDocs, setShowDocs] = useState({});

  async function refresh() {
    const res = await api("/driver-verification/" + driverId);
    setInfo(res.verification);
    setData({
      plate: res.verification.plate || "",
      cnhExpiresAt: displayCnhDate(res.verification.cnhExpiresAt),
      crlvYear: String(res.verification.crlvYear || new Date().getFullYear()),
      rntrcApplies: Boolean(res.verification.rntrcApplies),
      rntrc: res.verification.rntrc || "",
    });
  }
  useEffect(() => {
    let alive = true;
    api("/driver-verification/" + driverId).then((res) => {
      if (!alive) return;
      const value = res.verification;
      setInfo(value);
      setData({
        plate: value.plate || "",
        cnhExpiresAt: displayCnhDate(value.cnhExpiresAt),
        crlvYear: String(value.crlvYear || new Date().getFullYear()),
        rntrcApplies: Boolean(value.rntrcApplies),
        rntrc: value.rntrc || "",
      });
    }).catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [driverId]);

  async function action(path, method, payload, success) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, { method, body: payload });
      await refresh();
      await onChange?.();
      setMessage(success);
      return true;
    } catch (err) {
      setError(err.message || "Não foi possível salvar. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveVehicleDetails() {
    const checked = validateDriverDetails(data);
    if (!checked.valid) {
      setFieldErrors(checked.errors);
      setError(Object.values(checked.errors)[0]);
      setMessage("");
      return false;
    }
    setFieldErrors({});
    return action("/driver-verification/details", "PATCH", checked.data,
      "Placa, validade da CNH e informações do CRLV salvas.");
  }

  function updateField(name, value) {
    setData((previous) => ({ ...previous, [name]: value }));
    setFieldErrors((previous) => ({ ...previous, [name]: "" }));
    setError("");
  }

  const documentList = info?.documents || [];
  const complete = ["cnh", "crlv", "selfie"].every((kind) =>
    documentList.find((item) => item.kind === kind)?.exists);
  const expired = info?.status === "expired";
  const canSubmit = complete && data?.plate && data.cnhExpiresAt &&
    data.crlvYear && info.status !== "pending" && info.status !== "approved";
  return (
    <section className="driver-verification-panel">
      <div className="verification-head">
        <div className="verification-icon"><ShieldCheck size={25}/></div>
        <div>
          <h3>Verificação documental</h3>
          <p>Conferência manual de habilitação, veículo e identidade.</p>
        </div>
      </div>
      {!info && !error && <p className="muted" role="status">Carregando situação documental...</p>}
      {info && (
        <>
          <div className={"verification-status verification-" + info.status}>
            <strong>{statuses[info.status] || "Documentação em análise"}</strong>
            {info.approved ? <span>Selo verificado ativo</span> :
              <span>Novas propostas indisponíveis até aprovação válida. Fretes contratados continuam acessíveis.</span>}
          </div>
          {info.rejectionReason && <p className="verification-rejection"><AlertTriangle size={18}/> Motivo do Master: {info.rejectionReason}</p>}
          {expired && <p className="verification-rejection"><Clock3 size={18}/> Atualize os documentos vencidos e solicite nova análise.</p>}
          {isMaster ? (
            <div className="verification-master-details">
              <p><strong>Placa:</strong> {info.plate || "Não informada"}</p>
              <p><strong>CNH válida até:</strong> {prettyDate(info.cnhExpiresAt)}</p>
              <p><strong>CRLV (exercício):</strong> {info.crlvYear || "Não informado"}</p>
              <p><strong>RNTRC:</strong> {info.rntrcApplies ? (info.rntrc || "Não informado") : "Motorista declarou não ser aplicável — verificar enquadramento"}</p>
              <div className="verification-document-list">
                {documentList.map((doc) => (
                  <div className="verification-document-item" key={doc.kind}>
                    <strong>{labels[doc.kind]}</strong>
                    <span>{doc.exists ? "Enviado" : "Pendente"}</span>
                    {doc.exists && <DocumentPreview driverId={driverId} kind={doc.kind}/>}
                  </div>
                ))}
              </div>
              <p className="verification-legal-warning"><Lock size={16}/>
                Confira a correspondência entre rosto, CNH, CRLV, placa e, quando aplicável, RNTRC e requisitos legais de seguro. Os documentos não são publicados aos clientes.
              </p>
              {info.status === "pending" && (
                <div className="verification-review-actions">
                  <textarea rows={3} value={reason} maxLength={500}
                    placeholder="Motivo da reprovação (obrigatório ao reprovar)"
                    onChange={e => setReason(e.target.value)} />
                  <button type="button" className="secondary" disabled={busy || reason.trim().length < 10}
                    onClick={() => action(`/driver-verification/${driverId}/review`, "PATCH",
                      { status: "rejected", reason: reason.trim() }, "Reprovação registrada.")}>
                    <XCircle size={17}/> Solicitar correção
                  </button>
                  <button type="button" className="primary" disabled={busy || !complete}
                    onClick={() => action(`/driver-verification/${driverId}/review`, "PATCH",
                      { status: "approved" }, "Documentação aprovada.")}>
                    <ShieldCheck size={17}/> Aprovar documentos
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="verification-form">
                <label>Placa do veículo
                  <input value={data?.plate || ""} maxLength={10} placeholder="ABC1D23 ou ABC-1234"
                    inputMode="text" autoCapitalize="characters" autoCorrect="off"
                    aria-invalid={Boolean(fieldErrors.plate)}
                    disabled={busy} onChange={e => updateField("plate", e.target.value.toUpperCase())} />
                  <small>Placas antigas e Mercosul são aceitas, com ou sem hífen.</small>
                  {fieldErrors.plate && <small className="verification-field-error">{fieldErrors.plate}</small>}
                </label>
                <label>Validade da CNH
                  <input type="date" value={data?.cnhExpiresAt || ""}
                    aria-invalid={Boolean(fieldErrors.cnhExpiresAt)}
                    disabled={busy} onChange={e => updateField("cnhExpiresAt", e.target.value)} />
                  <small>Informe a data de vencimento impressa na CNH.</small>
                  {fieldErrors.cnhExpiresAt && <small className="verification-field-error">{fieldErrors.cnhExpiresAt}</small>}
                </label>
                <label>Exercício do CRLV
                  <input type="number" min={new Date().getFullYear()} max={new Date().getFullYear()+1}
                    value={data?.crlvYear || ""} disabled={busy}
                    aria-invalid={Boolean(fieldErrors.crlvYear)}
                    onChange={e => updateField("crlvYear", e.target.value)} />
                  <small>Exercício que consta no documento do veículo.</small>
                  {fieldErrors.crlvYear && <small className="verification-field-error">{fieldErrors.crlvYear}</small>}
                </label>
                <label className="verification-checkbox">
                  <input type="checkbox" checked={Boolean(data?.rntrcApplies)} disabled={busy}
                    onChange={e => updateField("rntrcApplies", e.target.checked)}/>
                  Minha atividade exige RNTRC (cadastro ANTT).
                </label>
                {data?.rntrcApplies && <label>Número RNTRC
                  <input inputMode="numeric" placeholder="Número para verificação" disabled={busy}
                    value={data.rntrc || ""} onChange={e => updateField("rntrc", e.target.value)}/>
                </label>}
                <p className="verification-legal-warning">A declaração de não aplicabilidade do RNTRC não dispensa requisitos legais. O Master avaliará seu enquadramento e os seguros exigíveis.</p>
                <button className="secondary" type="button" disabled={busy}
                  onClick={saveVehicleDetails}>
                  Salvar dados do veículo
                </button>
              </div>
              <div className="verification-documents">
                <h4>Fotos obrigatórias</h4>
                <p>Os documentos são privados. Use boa iluminação, sem cortar informações.</p>
                {documentList.map((doc) => (
                  <DocUpload kind={doc.kind} exists={doc.exists} key={doc.kind}
                    disabled={busy}
                    onUpload={(kind, image) => action("/driver-verification/documents/" + kind,
                      "POST", { image }, "Documento enviado em segurança.")} />
                ))}
              </div>
              <button className="primary full" type="button" disabled={busy || !canSubmit}
                onClick={() => action("/driver-verification/submit", "POST", {},
                  "Documentos enviados para análise do Master.")}>
                <ShieldCheck size={18} /> Enviar documentação para aprovação
              </button>
              <small className="muted">Depois de enviar tudo, aguarde a decisão da administração. Ao alterar uma foto ou dado, uma verificação anterior perde a validade.</small>
            </>
          )}
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="photo-success" role="status">{message}</p>}
    </section>
  );
}
