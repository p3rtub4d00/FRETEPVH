import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  Home,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Star,
  Truck,
  Users,
  X,
  History,
  LayoutDashboard,
  CircleHelp,
  Flag,
  Camera,
} from "lucide-react";
import { money, statusLabels } from "./format.js";
import { api } from "./api.js";
import RoutePicker from "./RoutePicker.jsx";
import RoleSwitcher from "./RoleSwitcher.jsx";
import ProfilePhotoEditor, { Avatar } from "./ProfilePhotoEditor.jsx";
import ProfileDetailsEditor from "./ProfileDetailsEditor.jsx";
import FreightPhotoPicker, { FreightPhotoImage } from "./FreightPhotoPicker.jsx";
import { pendingDriverBookings } from "./driverBooking.js";
import PrivacyMaster from "./PrivacyMaster.jsx";
import PushNotificationsPanel from "./PushNotificationsPanel.jsx";
import DriverVerificationPanel from "./DriverVerificationPanel.jsx";
import WalletPanel, { PaymentLabel, CommissionPreview } from "./WalletPanel.jsx";

const areas = { cliente: "Cliente", motorista: "Motorista", master: "Master" };
const navigation = {
  cliente: [
    ["inicio", "Início", Home],
    ["fretes", "Meus fretes", Package],
    ["historico", "Histórico", History],
    ["perfil", "Meu perfil", Users],
  ],
  motorista: [
    ["inicio", "Pedidos", Home],
    ["propostas", "Propostas", Package],
    ["historico", "Histórico", History],
    ["carteira", "Minha carteira", FileCheck2],
    ["perfil", "Meu perfil", Users],
  ],
  master: [
    ["inicio", "Visão geral", LayoutDashboard],
    ["motoristas", "Motoristas", Truck],
    ["fretes", "Fretes", Package],
    ["financeiro", "Financeiro", FileCheck2],
    ["usuarios", "Usuários", Users],
    ["privacidade", "Privacidade LGPD", ShieldCheck],
    ["denuncias", "Denúncias", Flag],
  ],
};

function Route({ request }) {
  return (
    <div className="route">
      <div>
        <span className="route-dot" />
        <p>
          <small>Retirada</small>
          {request.origin}
        </p>
      </div>
      <div>
        <MapPin size={15} />
        <p>
          <small>Entrega</small>
          {request.destination}
        </p>
      </div>
    </div>
  );
}
function RouteDistance({ request, onCalculate, busy }) {
  const mapUrl = "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" +
    encodeURIComponent(request.origin) + "&destination=" + encodeURIComponent(request.destination);
  return (
    <div className="freight-distance">
      {request.distanceMeters != null ? (
        <span>
          <MapPin size={16} />
          {(request.distanceMeters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km pelas ruas
          {request.durationMinutes != null && <> · {request.durationMinutes} min estimados</>}
        </span>
      ) : (
        <span><MapPin size={16} /> Distância ainda não calculada</span>
      )}
      <a href={mapUrl} target="_blank" rel="noopener noreferrer">Consultar trajeto no Google Maps</a>
      {request.distanceMeters == null && onCalculate && (
        <button type="button" className="text-button" disabled={busy}
          onClick={onCalculate}>Calcular km</button>
      )}
    </div>
  );
}
function Empty({ title, children }) {
  return (
    <div className="empty">
      <Package size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Modal({ title, onClose, children, error, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X />
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Salvando…</p>}
      <fieldset disabled={busy}>{children}</fieldset>
    </dialog>
  );
}

function RequestForm({ onCreate, onClose, requestError }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [data, setData] = useState({
    title: "",
    origin: "",
    destination: "",
    originPoint: null,
    destinationPoint: null,
    routeEstimate: null,
    paymentMethod: "",
    description: "",
    vehicle: "Picape",
    helper: false,
    date: "",
    time: "",
    photos: [],
  });
  const update = (event) =>
    setData((previous) => ({
      ...previous,
      [event.target.name]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (photoProcessing) {
      setError("Finalize o processamento da foto antes de continuar.");
      return;
    }
    if (step === 0 && data.origin.trim() === data.destination.trim()) {
      setError("Informe endereços diferentes para retirada e entrega.");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (new Date(`${data.date}T${data.time}`) <= new Date()) {
      setError("Escolha uma data e um horário futuros.");
      return;
    }
    setLoading(true);
    try {
      await onCreate(data);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal title="Solicitar frete" onClose={onClose} error={requestError}>
      <div className="steps">
        {["Trajeto", "Carga", "Agendamento"].map((label, index) => (
          <span key={label} className={index <= step ? "active" : ""}>
            {index + 1}. {label}
          </span>
        ))}
      </div>
      <form onSubmit={submit}>
        {step === 0 && (
          <RoutePicker
            data={data}
            onChange={(patch) =>
              setData((previous) => ({ ...previous, ...patch }))
            }
          />
        )}
        {step === 1 && (
          <>
            <label>
              O que você vai transportar?
              <input
                autoFocus
                name="title"
                value={data.title}
                onChange={update}
                required
                minLength={3}
                maxLength={70}
                placeholder="Ex. sofá de 3 lugares"
              />
            </label>
            <label>
              Detalhes da carga
              <textarea
                name="description"
                value={data.description}
                onChange={update}
                required
                maxLength={500}
                placeholder="Dimensões, quantidade, escadas e cuidados necessários"
              />
            </label>
            <label>
              Veículo
              <select name="vehicle" value={data.vehicle} onChange={update}>
                {["Picape", "Utilitário", "Caminhão pequeno", "Caminhão"].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  ),
                )}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                name="helper"
                checked={data.helper}
                onChange={update}
              />
              Preciso de ajuda para carregar
            </label>
            <FreightPhotoPicker
              photos={data.photos}
              busy={loading}
              onBusyChange={setPhotoProcessing}
              onAdd={(images) => {
                setData(previous => ({ ...previous, photos: [...previous.photos, ...images] }));
                return true;
              }}
              onRemove={(index) =>
                setData(previous => ({
                  ...previous,
                  photos: previous.photos.filter((_, i) => i !== index),
                }))
              }
            />
          </>
        )}
        {step === 2 && (
          <>
            <div className="form-grid">
              <label>
                Data
                <input
                  autoFocus
                  type="date"
                  required
                  name="date"
                  value={data.date}
                  onChange={update}
                  min={new Date().toLocaleDateString("en-CA")}
                />
              </label>
              <label>
                Horário
                <input
                  type="time"
                  required
                  name="time"
                  value={data.time}
                  onChange={update}
                />
              </label>
            </div>
            <div className="payment-selection">
              <h3>Como deseja pagar pelo frete?</h3>
              <p className="muted">Escolha antes de publicar. Os motoristas verão a modalidade antes de enviar propostas.</p>
              {[
                ["cash_driver", "Dinheiro ao motorista", "Pague diretamente ao motorista ao final do serviço."],
                ["card_driver", "Cartão na maquininha", "O motorista precisa aceitar cartão; ele informa um preço que considere a taxa da maquininha."],
                ["pix_freteon", "Pix pelo FreteOn", "Por enquanto é apenas uma simulação. Nenhum Pix real será cobrado."],
              ].map(([value, label, help]) => (
                <label key={value} className={`payment-choice ${data.paymentMethod === value ? "selected" : ""}`}>
                  <input type="radio" name="paymentMethod" value={value} required
                    checked={data.paymentMethod === value} onChange={update} />
                  <span><strong>{label}</strong><small>{help}</small></span>
                </label>
              ))}
            </div>
            <div className="review">
              <h3>{data.title}</h3>
              <Route request={data} />
              {data.paymentMethod && <PaymentLabel method={data.paymentMethod} />}
              <p className="photo-review-counter">Fotos anexadas: <strong>{data.photos.length}/3</strong></p>
              <p>
                {data.vehicle} · {data.helper ? "Com ajudante" : "Sem ajudante"}
              </p>
              {data.routeEstimate && (
                <p className="route-in-review">
                  {(data.routeEstimate.distanceMeters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km pelas ruas · {data.routeEstimate.durationMinutes} min estimados
                </p>
              )}
              <small>
                Os motoristas enviam seus preços. Você escolhe a proposta.
              </small>
              <p className="freight-legal-notice">
                <ShieldCheck size={16} />
                O FreteOn apenas intermedeia a contratação: o transporte e a guarda da carga são executados pelo motorista escolhido, observadas as responsabilidades previstas em lei.
                <a href="/termos" target="_blank" rel="noopener noreferrer">Ler Termos de Uso</a>
              </p>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          {step > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
          )}
          <button className="primary" disabled={loading || photoProcessing}>
            {photoProcessing ? "Preparando fotos..." : step === 2 ? "Publicar pedido" : "Continuar"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function App({ user, onLogout, onExpired, sessions, onSwitchRole }) {
  const area = user.role;
  const [state, setState] = useState({
    requests: [],
    drivers: [],
    users: [],
    available: false,
    wallet: { simulated: true },
    user,
  });
  const [page, setPage] = useState("inicio");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [install, setInstall] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const seenCompletions = useRef(new Set());
  const seenAcceptedBookings = useRef(new Set());
  const modalRef = useRef(null);
  useEffect(() => { modalRef.current = modal; }, [modal]);
  function showError(error) {
    if (error.status === 401) onExpired();
    else setNotice(error.message);
  }
  async function refresh() {
    const data = await api("/state");
    if (mounted.current) {
      setState(data);
      setLoaded(true);
      if (area === "cliente" && !modalRef.current) {
        const toReview = data.requests.find((request) =>
          request.status === "completed" &&
          !seenCompletions.current.has(request.id) &&
          ((request.paymentMethod && !request.deliveryConfirmedAt &&
              request.disputeStatus === "none") ||
            (!request.rating && request.disputeStatus !== "open" &&
              (!request.paymentMethod || request.deliveryConfirmedAt)))
        );
        if (toReview) {
          seenCompletions.current.add(toReview.id);
          setModal({ type: "completion", id: toReview.id });
        }
      } else if (area === "motorista" && !modalRef.current) {
        // A seleção do cliente já fica salva no MongoDB. Nunca abra para
        // motoristas que apenas enviaram propostas não escolhidas.
        const booked = pendingDriverBookings(data.requests, user.id).find(
          (request) => !seenAcceptedBookings.current.has(request.id),
        );
        if (booked) {
          seenAcceptedBookings.current.add(booked.id);
          setModal({ type: "driverBooking", id: booked.id });
        }
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    refresh().catch(showError);
    const interval = setInterval(() => {
      if (!document.hidden && !inFlight.current) refresh().catch(showError);
    }, area === "motorista" ? 5000 : 15000);
    // Ao voltar ao aplicativo no celular, cheque imediatamente novas contratações.
    const checkOnReturn = () => {
      if (!document.hidden && !inFlight.current) refresh().catch(showError);
    };
    window.addEventListener("focus", checkOnReturn);
    document.addEventListener("visibilitychange", checkOnReturn);
    const serviceWorkerAlert = (event) => {
      if (event.data?.type === "FRETEON_PUSH_EVENT" &&
          (!event.data?.role || event.data.role === area) && !inFlight.current)
        refresh().catch(showError);
    };
    navigator.serviceWorker?.addEventListener("message", serviceWorkerAlert);
    const handler = (event) => {
      event.preventDefault();
      setInstall(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", checkOnReturn);
      document.removeEventListener("visibilitychange", checkOnReturn);
      navigator.serviceWorker?.removeEventListener("message", serviceWorkerAlert);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);
  async function mutate(path, method, body, after) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    try {
      await api(path, { method, body });
      await refresh();
      after?.();
      return true;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function updateRequest(id, patch) {
    return mutate(`/requests/${id}`, "PATCH", patch);
  }
  async function createRequest(data) {
    return mutate("/requests", "POST", data, () => {
      setModal(null);
      setPage("fretes");
      setNotice("Pedido publicado. Aguarde as propostas dos motoristas.");
    });
  }
  function walletAction(id, action, extras = {}) {
    return mutate(`/requests/${id}/finance`, "POST", { action, ...extras }, () => {
      setNotice("Registro financeiro atualizado (somente simulação).");
    });
  }
  function addFreightPhotos(id, photos) {
    return mutate(`/requests/${id}/photos`, "POST", { photos },
      () => setNotice("Foto(s) da carga salva(s) e disponível(is) para os motoristas."));
  }
  function removeFreightPhoto(id, index) {
    return mutate(`/requests/${id}/photos/${index}`, "DELETE", {},
      () => setNotice("Foto removida do pedido."));
  }
  function saveProfilePhoto(photo) {
    return mutate("/profile/photo", "PATCH", { photo },
      () => setNotice(photo ? "Foto de perfil atualizada." : "Foto removida."));
  }
  function calculateMissingDistance(id) {
    return mutate(`/requests/${id}/calculate-route`, "POST", {},
      () => setNotice("Distância calculada e salva."));
  }
  function savePaymentPreferences(preferences) {
    return mutate("/payment-preferences", "PATCH", preferences, () => {
      setNotice("Preferências de pagamento salvas.");
    });
  }
  async function logout() {
    try {
      await onLogout();
    } catch (error) {
      showError(error);
    }
  }
  const active = state.requests.filter((request) =>
    ["open", "booked", "transit"].includes(request.status),
  );
  const completed = state.requests.filter(
    (request) => request.status === "completed",
  );
  const bookingsPending = area === "motorista"
    ? pendingDriverBookings(state.requests, user.id)
    : [];
  const completionPending = area === "cliente"
    ? state.requests.filter((request) =>
        request.status === "completed" &&
        ((request.paymentMethod && !request.deliveryConfirmedAt &&
          request.disputeStatus === "none") ||
         (!request.rating && request.disputeStatus !== "open" &&
              (!request.paymentMethod || request.deliveryConfirmedAt)))
      )
    : [];
  const selected = modal?.id
    ? state.requests.find((request) => request.id === modal.id)
    : null;
  const pending = state.drivers.filter((driver) => driver.status === "pending");
  const driver =
    state.drivers.find((person) => person.id === user.id) || state.user;
  const totalProposals = active.reduce(
    (sum, request) => sum + request.proposals.length,
    0,
  );
  let requests = state.requests;
  if (page === "historico")
    requests = state.requests.filter((request) =>
      ["completed", "cancelled"].includes(request.status),
    );
  else if (area === "motorista")
    requests =
      page === "propostas"
        ? state.requests.filter((request) =>
            request.proposals.some((proposal) => proposal.driverId === user.id),
          )
        : state.requests.filter(
            (request) =>
              request.status === "open" ||
              (request.proposals.find(
                (proposal) => proposal.id === request.selectedId,
              )?.driverId === user.id &&
                ["booked", "transit"].includes(request.status)),
          );
  else if (page === "inicio") requests = active;
  if (filter !== "all")
    requests = requests.filter((request) => request.status === filter);

  function requestCard(request) {
    return (
      <article className="freight-card" key={request.id}>
        <div className="card-top">
          <div className="package-icon">
            <Package size={22} />
          </div>
          <span className={`status ${request.status}`}>
            {statusLabels[request.status]}
          </span>
        </div>
        <h3>{request.title}</h3>
        <small className="muted">
          {request.id} · {request.vehicle}
        </small>
        <Route request={request} />
        {request.photos?.length > 0 && (
          <button type="button" className="freight-card-photo" onClick={() =>
            setModal({ type: "detail", id: request.id })}>
            <FreightPhotoImage src={request.photos[0]} alt={`Foto da carga: ${request.title}`} />
            <span><Camera size={16} /> Ver {request.photos.length} foto(s) da carga</span>
          </button>
        )}
        {request.paymentMethod && <PaymentLabel method={request.paymentMethod} />}
        <div className="card-meta">
          <span>
            <Clock3 size={15} />
            {request.date
              ? new Date(`${request.date}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "short" },
                )
              : "Sem data"}{" "}
            · {request.time}
          </span>
          <span>{request.helper ? "Com ajudante" : "Sem ajudante"}</span>
        </div>
        <RouteDistance request={request} />
        <button
          className="card-link"
          onClick={() => setModal({ type: "detail", id: request.id })}
        >
          {request.status === "open"
            ? area === "motorista"
              ? "Ver pedido e enviar proposta"
              : `${request.proposals.length} propostas recebidas`
            : "Ver detalhes"}
          <ArrowRight size={18} />
        </button>
      </article>
    );
  }

  return (
    <div className="app-shell">
      {busy && (
        <div className="operation-status" role="status">
          Salvando…
        </div>
      )}

      <aside className="sidebar">
        <a href="/" className="brand">
          <img src="/assets/logo.png" alt="FreteOn" />
        </a>
        <div className="location">
          <MapPin size={16} />
          Porto Velho, RO
        </div>
        <div className="sidebar-label">
          ÁREA DO{" "}
          {area === "master" ? "ADMINISTRADOR" : areas[area].toUpperCase()}
        </div>
        <nav>
          {navigation[area].map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "selected" : ""}
              onClick={() => {
                setPage(key);
                setFilter("all");
              }}
            >
              <Icon size={20} />
              {label}
              {area === "master" &&
                key === "motoristas" &&
                pending.length > 0 && (
                  <span className="count">{pending.length}</span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={23} />
          <strong>Seu frete, sua escolha.</strong>
          <p>
            Conectando quem precisa transportar a quem está pronto para ajudar.
          </p>
          <button onClick={() => setModal({ type: "help" })}>
            <CircleHelp size={18} />
            Como funciona
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-logo">
            <img src="/assets/logo.png" alt="FreteOn" />
          </div>
          <div className="breadcrumb">
            FreteOn <ChevronRight size={14} />
            {areas[area]}
          </div>
          <div className="top-actions">
            {install && (
              <button
                className="install"
                onClick={async () => {
                  await install.prompt();
                  setInstall(null);
                }}
              >
                <Download size={17} />
                Instalar
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Notificações"
              onClick={() => setModal({ type: "notifications" })}
            >
              <Bell size={20} />
              {(area === "motorista" ? bookingsPending.length > 0 : totalProposals > 0) && (
                <span className="notification-dot" />
              )}
            </button>
            <Avatar account={state.user} />
          </div>
        </header>
        <div className="account-bar">
          <span>
            {state.user.name} · {areas[area]}
          </span>
          <RoleSwitcher
            activeRole={area}
            sessions={sessions}
            onSwitch={onSwitchRole}
          />
          <button onClick={logout}>Sair desta conta</button>
        </div>
        <main>
          {!loaded && <p role="status">Carregando seus dados…</p>}
          {area === "motorista" && !state.user.verified && (
            <div className="verification-action-banner" role="status">
              <ShieldCheck size={23}/>
              <div>
                <strong>Verifique seus documentos para receber novos fretes</strong>
                <p>
                  {state.user.verificationStatus === "pending"
                    ? "Sua documentação está em análise pelo Master."
                    : state.user.verificationStatus === "rejected"
                      ? "O Master solicitou correções na documentação."
                      : state.user.verificationStatus === "expired"
                        ? "Sua CNH ou CRLV precisa ser atualizado."
                        : "Envie CNH, CRLV, selfie e dados do veículo para aprovação."}
                  {" "}Fretes já contratados continuam disponíveis.
                </p>
              </div>
              <button type="button" className="primary"
                onClick={() => setPage("perfil")}>Enviar documentos</button>
            </div>
          )}

          {area === "motorista" && state.user.verificationExpiringSoon && state.user.verified && (
            <div className="verification-action-banner" role="status">
              <ShieldCheck size={23}/>
              <div><strong>A validade da sua CNH está próxima.</strong>
                <p>Atualize seus dados em Meu perfil antes do vencimento para evitar a suspensão de novas propostas.</p>
              </div>
              <button className="secondary" onClick={() => setPage("perfil")}>Atualizar documentos</button>
            </div>
          )}
          {area === "motorista" && state.wallet?.blocked && (
            <div className="wallet-alert" role="alert">
              <span>Você possui comissão vencida há mais de 72 horas. Novas propostas estão temporariamente suspensas.</span>
              <button className="secondary" onClick={() => setPage("carteira")}>Ver minha carteira</button>
            </div>
          )}
          {bookingsPending.length > 0 && (
            <div className="driver-booking-banner" role="status">
              <div>
                <CheckCircle2 size={21} />
                <span>
                  <strong>{bookingsPending.length === 1
                    ? "Sua proposta foi aceita! Você tem um frete contratado."
                    : `Você tem ${bookingsPending.length} fretes contratados.`}</strong>
                  <small>Veja os detalhes completos e inicie o transporte pelo painel.</small>
                </span>
              </div>
              <button className="primary" onClick={() =>
                setModal({ type: "driverBooking", id: bookingsPending[0].id })}>
                Ver contratação
              </button>
            </div>
          )}
          {completionPending.length > 0 && (
            <div className="completion-banner" role="status">
              <div>
                <CheckCircle2 size={19} />
                <span><strong>{completionPending.length} frete(s) aguardando sua atenção</strong>
                <small>Confirme a entrega e avalie o motorista sem entrar no Histórico.</small></span>
              </div>
              <button className="primary" onClick={() =>
                setModal({ type: "completion", id: completionPending[0].id })}>
                Ver frete e finalizar
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {area === "cliente"
                  ? "VAMOS COLOCAR SEUS PLANOS EM MOVIMENTO"
                  : area === "motorista"
                    ? "SEU PRÓXIMO FRETE COMEÇA AQUI"
                    : "ADMINISTRAÇÃO FRETEON"}
              </p>
              <h1>
                {page === "inicio"
                  ? area === "cliente"
                    ? `Olá, ${state.user.name.split(" ")[0]}.`
                    : area === "motorista"
                      ? `Olá, ${state.user.name.split(" ")[0]}.`
                      : "Visão geral"
                  : navigation[area].find((item) => item[0] === page)?.[1]}
              </h1>
              <p className="subtitle">
                {page === "perfil"
                  ? area === "cliente"
                    ? "Gerencie sua foto, seus dados e preferências."
                    : area === "motorista"
                      ? "Atualize seu perfil e sua documentação."
                      : "Gerencie os dados da sua conta."
                  : area === "cliente"
                    ? "Encontre o motorista certo para o seu frete."
                    : area === "motorista"
                      ? "Escolha os pedidos e envie o seu melhor preço."
                      : "Acompanhe a operação em Porto Velho."}
              </p>
            </div>
            {area === "cliente" && ["inicio", "fretes"].includes(page) && (
              <button
                className="primary"
                onClick={() => setModal({ type: "create" })}
              >
                <Plus size={19} />
                Solicitar frete
              </button>
            )}
            {area === "motorista" && (
              <button
                disabled={!state.user.verified}
                title={!state.user.verified ? "Envie e aprove seus documentos antes de ficar disponível." : ""}
                className={`availability ${state.available ? "online" : ""}`}
                onClick={() =>
                  mutate("/availability", "PATCH", {
                    available: !state.available,
                  })
                }
              >
                <span />
                {state.available ? "Disponível para fretes" : "Indisponível"}
              </button>
            )}
          </div>
          {page === "inicio" && area === "cliente" && (
            <section className="hero">
              <div>
                <span className="hero-kicker">FRETES EM PORTO VELHO</span>
                <h2>
                  Precisa levar?
                  <br />A gente conecta.
                </h2>
                <p>
                  Conte o que vai transportar, receba propostas
                  <br className="desktop-only" /> e escolha quem vai com você.
                </p>
                <button onClick={() => setModal({ type: "create" })}>
                  Pedir meu frete
                  <ArrowRight size={19} />
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="road" />
                <div className="art-pin">
                  <MapPin size={27} />
                </div>
                <Truck size={125} strokeWidth={1.3} />
                <div className="art-package">
                  <Package size={35} />
                </div>
                <span>Do seu ponto A ao ponto B.</span>
              </div>
            </section>
          )}
          {page === "inicio" && (
            <div className="stats">
              <div>
                <span className="stat-icon">
                  <Package />
                </span>
                <p>
                  {area === "master"
                    ? "Fretes ativos"
                    : area === "motorista"
                      ? "Pedidos abertos"
                      : "Em andamento"}
                  <strong>
                    {area === "motorista"
                      ? state.requests.filter(
                          (request) => request.status === "open",
                        ).length
                      : active.length}
                  </strong>
                </p>
              </div>
              <div>
                <span className="stat-icon orange">
                  <FileCheck2 />
                </span>
                <p>
                  {area === "master"
                    ? "Aguardando aprovação"
                    : area === "motorista"
                      ? "Propostas enviadas"
                      : "Propostas recebidas"}
                  <strong>
                    {area === "master"
                      ? pending.length
                      : area === "motorista"
                        ? state.requests.filter((request) =>
                            request.proposals.some(
                              (proposal) => proposal.driverId === user.id,
                            ),
                          ).length
                        : totalProposals}
                  </strong>
                </p>
              </div>
              <div>
                <span className="stat-icon green">
                  <CheckCircle2 />
                </span>
                <p>
                  Fretes concluídos<strong>{completed.length}</strong>
                </p>
              </div>
            </div>
          )}
          {((area === "motorista" && page === "carteira") ||
             (area === "master" && page === "financeiro")) ? (
            <WalletPanel
              role={area}
              user={state.user}
              wallet={state.wallet}
              requests={state.requests}
              drivers={state.drivers}
              busy={busy}
              onAction={walletAction}
              onSavePreferences={savePaymentPreferences}
            />
          ) : area === "master" && ["inicio", "motoristas"].includes(page) ? (
            <section>
              <div className="section-heading">
                <h2>
                  {page === "inicio"
                    ? "Motoristas aguardando aprovação"
                    : "Motoristas cadastrados"}
                </h2>
                <span className="muted">{pending.length} pendente(s)</span>
              </div>
              <div className="panel">
                {(page === "inicio" ? pending : state.drivers).map((person) => (
                  <div className="person-row" key={person.id}>
                    <Avatar account={person} />
                    <div>
                      <strong>{person.name} {person.verified && (
                        <span className="driver-verified-label"><ShieldCheck size={13}/> Verificado</span>
                      )}</strong>
                      <p>
                        {person.vehicle || areas[person.role]}{" "}
                        {area === "master" && person.phone
                          ? `· ${person.phone}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`status ${person.status === "approved" ? "completed" : "open"}`}
                    >
                      {person.verified
                        ? "Verificado"
                        : person.verificationStatus === "expired"
                          ? "Documentos vencidos"
                          : person.verificationStatus === "rejected"
                            ? "Correções necessárias"
                            : person.verificationStatus === "unsubmitted"
                              ? "Sem documentos"
                              : "Em análise"}
                    </span>
                    <button
                      className="secondary"
                      onClick={() =>
                        setModal({ type: "driver", driverId: person.id })
                      }
                    >
                      Analisar
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ))}
                {page === "inicio" && !pending.length && (
                  <Empty title="Análises em dia">
                    Todos os cadastros foram analisados.
                  </Empty>
                )}
              </div>
              {page === "inicio" && (
                <div className="section-heading">
                  <h2>Atividade dos fretes</h2>
                  <button
                    className="text-button"
                    onClick={() => setPage("fretes")}
                  >
                    Ver todos
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {page === "inicio" && (
                <div className="cards">{active.map(requestCard)}</div>
              )}
            </section>
          ) : page === "perfil" ? (
            <section className="panel profile">
              {["cliente", "motorista"].includes(area) ? (
                <ProfilePhotoEditor account={state.user} busy={busy} onSave={saveProfilePhoto} />
              ) : <Avatar account={state.user} large />}
              {["cliente", "motorista"].includes(area) ? (
                <ProfileDetailsEditor account={state.user} busy={busy} onSaved={refresh} />
              ) : (
                <>
                  <h2>{state.user.name}</h2>
                  <p>{state.user.phone} · Porto Velho, RO</p>
                </>
              )}
              {area === "motorista" && (
                <>
                  <div className="profile-item">
                    <Truck />
                    <div>
                      <strong>Meu veículo</strong>
                      <p>{driver.vehicle}</p>
                    </div>
                  </div>
                  <div className="profile-item">
                    <ShieldCheck />
                    <div>
                      <strong>Situação do cadastro</strong>
                      <p>
                        {state.user.verified
                          ? "Conta verificada e aprovada pelo Master."
                          : "Documentos necessários para enviar novas propostas. Consulte a análise abaixo."}
                      </p>
                    </div>
                  </div>
                </>
              )}
              {area === "motorista" && (
                <DriverVerificationPanel
                  driverId={user.id} role="motorista"
                  onChange={refresh}
                />
              )}
              {["cliente", "motorista"].includes(area) && (
                <details className="profile-push-settings">
                  <summary><BellRing size={18}/> Notificações do aparelho</summary>
                  <PushNotificationsPanel role={area} accountId={user.id}/>
                </details>
              )}
              <button className="secondary" onClick={logout}>
                Sair da conta
              </button>
            </section>
          ) : area === "master" && page === "privacidade" ? (
            <PrivacyMaster />
          ) : page === "usuarios" ? (
            <section className="panel">
              <h2>Usuários cadastrados</h2>
              {state.users.map((person) => (
                <div key={person.id} className="person-row">
                  <Avatar account={person} />
                  <div>
                    <strong>{person.name}</strong>
                    <p>
                      {person.vehicle || areas[person.role]}{" "}
                      {area === "master" && person.phone
                        ? `· ${person.phone}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          ) : page === "denuncias" ? (
            <section className="panel">
              <Empty title="Nenhuma denúncia">
                O envio de denúncias estará disponível em uma próxima etapa.
              </Empty>
            </section>
          ) : (
            <section>
              <div className="section-heading">
                <h2>
                  {page === "historico"
                    ? "Seus fretes anteriores"
                    : area === "motorista"
                      ? "Encontre seu próximo frete"
                      : page === "inicio"
                        ? "Acompanhe seus fretes"
                        : "Todos os fretes"}
                </h2>
                {page === "inicio" && area === "cliente" && (
                  <button
                    className="text-button"
                    onClick={() => setPage("fretes")}
                  >
                    Ver todos
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              {page === "fretes" && (
                <div className="filters">
                  {[
                    ["all", "Todos"],
                    ["open", "Propostas"],
                    ["booked", "Contratados"],
                    ["transit", "Em transporte"],
                    ["completed", "Concluídos"],
                    ["cancelled", "Cancelados"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {area === "motorista" && !state.available && (
                <p className="info">
                  Você está indisponível. Ative sua disponibilidade para enviar
                  propostas.
                </p>
              )}
              <div className="cards">{requests.map(requestCard)}</div>
              {!requests.length && (
                <Empty title="Nenhum frete por aqui">
                  Novos pedidos e atualizações aparecerão nesta área.
                </Empty>
              )}
            </section>
          )}
          <footer>
            <span>FreteOn · Porto Velho, RO</span>
            <div className="dashboard-legal-links">
              <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
              <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
            </div>
            <button onClick={() => setModal({ type: "help" })}>
              Precisa de ajuda?
            </button>
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Navegação principal">
          {navigation[area].map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "selected" : ""}
              onClick={() => {
                setPage(key);
                setFilter("all");
              }}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      {modal?.type === "create" && (
        <RequestForm
          requestError={notice}
          onCreate={createRequest}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "driverBooking" && selected && area === "motorista" &&
        selected.driverId === user.id && (
        <Modal
          title="Sua proposta foi aceita!"
          error={notice}
          busy={busy}
          onClose={() => setModal(null)}
        >
          <div className="driver-acceptance-content">
            <div className="driver-acceptance-headline">
              <CheckCircle2 size={35} />
              <div>
                <strong>Frete contratado com sucesso</strong>
                <p>O cliente escolheu você para realizar este transporte.</p>
              </div>
            </div>
            <div className="driver-acceptance-heading">
              <strong>{selected.title}</strong>
              <span className="status booked">{statusLabels[selected.status]}</span>
            </div>
            <Route request={selected} />
            <RouteDistance request={selected} busy={busy}
              onCalculate={() => calculateMissingDistance(selected.id)} />
            <div className="driver-acceptance-info">
              <span><Clock3 size={16} />
                {selected.date ? new Date(`${selected.date}T12:00:00`).toLocaleDateString("pt-BR") : "Data não definida"}
                {" · "}
                {selected.proposals.find((proposal) => proposal.id === selected.selectedId)?.time || selected.time}
              </span>
              <span><Truck size={16} /> {selected.vehicle}</span>
              <span><Package size={16} />
                {selected.helper ? "Cliente solicitou ajudante" : "Sem ajudante solicitado"}
              </span>
            </div>
            <div className="driver-acceptance-description">
              <strong>Descrição da carga</strong>
              <p>{selected.description}</p>
            </div>
            <div className="freight-gallery">
              <h3>Fotos da carga ({selected.photos?.length || 0})</h3>
              {selected.photos?.length ? (
                <div className="freight-gallery-images">
                  {selected.photos.map((photo, index) => (
                    <button type="button" key={index} onClick={() =>
                      setModal({ type: "photo", id: selected.id, index, returnTo: "driverBooking" })}>
                      <FreightPhotoImage src={photo} alt={`Ampliar foto ${index + 1} da carga`} />
                    </button>
                  ))}
                </div>
              ) : <p className="muted">O cliente não anexou fotos.</p>}
            </div>
            <div className="driver-acceptance-payment">
              <h3>Pagamento combinado</h3>
              <PaymentLabel method={selected.paymentMethod} />
              {selected.agreedPriceCents != null ? (
                <CommissionPreview
                  price={selected.agreedPriceCents / 100}
                  method={selected.paymentMethod}
                />
              ) : (
                <p className="client-total-price">
                  Preço aceito:{" "}
                  <strong>{money(selected.proposals.find((proposal) =>
                    proposal.id === selected.selectedId)?.price || 0)}</strong>
                </p>
              )}
            </div>
            {selected.status === "booked" && (
              <div className="driver-acceptance-actions">
                {selected.paymentMethod === "pix_freteon" &&
                  selected.paymentStatus !== "simulated_paid" && (
                  <p className="info">
                    Aguardando o cliente confirmar o Pix de teste.
                    Você poderá iniciar o transporte após essa simulação.
                  </p>
                )}
                <button className="primary full"
                  disabled={busy ||
                    (selected.paymentMethod === "pix_freteon" &&
                     selected.paymentStatus !== "simulated_paid")}
                  onClick={async () => {
                    if (await updateRequest(selected.id, { status: "transit" })) {
                      setModal(null);
                      setNotice("Transporte iniciado! Os detalhes permanecem em Meus fretes.");
                    }
                  }}>
                  <Truck size={18} /> Iniciar transporte
                </button>
              </div>
            )}
            {selected.status !== "booked" && (
              <p className="info">A situação desta contratação mudou. Consulte os detalhes do frete.</p>
            )}
            <button type="button" className="text-button"
              onClick={() => setModal({ type: "detail", id: selected.id })}>
              Ver detalhes tradicionais
            </button>
            <button type="button" className="text-button"
              onClick={() => setModal(null)}>
              Fechar por enquanto
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "completion" && selected && (
        <Modal
          title={selected.deliveryConfirmedAt || !selected.paymentMethod
            ? "Avalie seu frete" : "Seu frete foi concluído!"}
          error={notice}
          busy={busy}
          onClose={() => setModal(null)}
        >
          <div className="completion-modal-content">
            <div className="completion-modal-headline">
              <CheckCircle2 size={35} />
              <div>
                <strong>{selected.title}</strong>
                <p className="muted">O motorista marcou este transporte como concluído.</p>
              </div>
            </div>
            <Route request={selected} />
            {selected.agreedPriceCents != null && (
              <p className="client-total-price">Valor total do frete:{" "}
                <strong>{money(selected.agreedPriceCents / 100)}</strong>
              </p>
            )}
            <div className="completion-driver">
              <Avatar account={state.drivers.find((driver) => driver.id === selected.driverId)} />
              <div>
                <small>Motorista</small>
                <strong>{state.drivers.find((driver) => driver.id === selected.driverId)?.name || "Motorista contratado"}</strong>
              </div>
            </div>
            {selected.paymentMethod && !selected.deliveryConfirmedAt &&
              selected.disputeStatus === "none" && (
              <div className="completion-actions">
                <h3>Confirme a entrega</h3>
                <p>
                  {selected.paymentMethod === "pix_freteon"
                    ? "Confirme que recebeu sua carga corretamente. O pagamento continua em modo simulação."
                    : "Confirme somente se recebeu a carga e efetuou o pagamento combinado diretamente ao motorista."}
                </p>
                <button className="primary full" disabled={busy}
                  onClick={() => walletAction(selected.id, "confirm_delivery")}>
                  <Check size={18} /> Confirmar entrega e continuar
                </button>
                <button className="secondary full" disabled={busy}
                  onClick={() => setModal({ type: "issue", id: selected.id })}>
                  Informar um problema
                </button>
              </div>
            )}
            {(selected.deliveryConfirmedAt || !selected.paymentMethod) &&
              !selected.rating && selected.disputeStatus !== "open" && (
              <div className="completion-actions">
                <h3>Como foi o serviço?</h3>
                <p>Escolha de 1 a 5 estrelas para avaliar o motorista.</p>
                <div className="completion-stars">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button key={score} type="button" disabled={busy}
                      aria-label={`Avaliar com ${score} estrela${score === 1 ? "" : "s"}`}
                      onClick={async () => {
                        if (await updateRequest(selected.id, { rating: score })) {
                          setModal(null);
                          setNotice("Frete finalizado. Obrigado por avaliar o motorista!");
                        }
                      }}>
                      <Star size={25} />
                      <span>{score}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selected.rating && (
              <p className="info">Sua avaliação foi registrada: {selected.rating} de 5 estrelas.</p>
            )}
            {selected.disputeStatus === "open" && (
              <p className="info">A entrega está em análise pela administração.</p>
            )}
            <button type="button" className="text-button" onClick={() => setModal(null)}>
              {selected.rating ? "Fechar" : "Fazer isso depois"}
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "detail" && selected && (
        <Modal
          error={notice}
          busy={busy}
          title={selected.title}
          onClose={() => setModal(null)}
        >
          <span className={`status ${selected.status}`}>
            {statusLabels[selected.status]}
          </span>
          <Route request={selected} />
          {selected.paymentMethod && (
            <div className="freight-payment-panel">
              <PaymentLabel method={selected.paymentMethod} />
              {selected.agreedPriceCents != null && (
                area === "cliente" ? (
                  <p className="client-total-price">
                    Valor total do frete: <strong>{money(selected.agreedPriceCents / 100)}</strong>
                  </p>
                ) : (
                  <CommissionPreview
                    price={selected.agreedPriceCents / 100}
                    method={selected.paymentMethod}
                  />
                )
              )}
              {selected.paymentMethod === "pix_freteon" && (
                <p className="muted">Pix pelo FreteOn em modo simulação. Nenhum pagamento real será recebido.</p>
              )}
              {selected.paymentMethod === "card_driver" && (
                <p className="muted">O cliente pagará na maquininha do motorista. A taxa bancária deve estar considerada no preço da proposta.</p>
              )}
              {selected.paymentMethod === "cash_driver" && (
                <p className="muted">Pagamento em dinheiro diretamente ao motorista ao final do serviço.</p>
              )}
            </div>
          )}
          <RouteDistance request={selected} busy={busy}
            onCalculate={() => calculateMissingDistance(selected.id)} />
          <p>{selected.description}</p>
          <p className="muted">
            {selected.vehicle} ·{" "}
            {selected.helper ? "Com ajudante" : "Sem ajudante"} ·{" "}
            {selected.time}
          </p>
          {area === "cliente" && ["open", "booked"].includes(selected.status) ? (
            <FreightPhotoPicker
              photos={selected.photos || []}
              busy={busy}
              onAdd={(photos) => addFreightPhotos(selected.id, photos)}
              onRemove={(index) => removeFreightPhoto(selected.id, index)}
            />
          ) : (
            <div className="freight-gallery">
              <h3>Fotos da carga ({selected.photos?.length || 0})</h3>
              {selected.photos?.length ? (
                <div className="freight-gallery-images">
                  {selected.photos.map((photo, i) => (
                    <button type="button" key={i} onClick={() =>
                      setModal({ type: "photo", id: selected.id, index: i })}>
                      <FreightPhotoImage src={photo} alt={`Abrir foto ${i + 1} da carga`} />
                    </button>
                  ))}
                </div>
              ) : <p className="muted">O cliente não anexou fotos a este frete.</p>}
            </div>
          )}
          {area === "motorista" && selected.status === "open" ? (
            <ProposalForm
              key={selected.id}
              request={selected}
              available={
                state.available && state.user.verified &&
                !state.wallet?.blocked &&
                (selected.paymentMethod !== "card_driver" || state.user.acceptsCard) &&
                !busy
              }
              driverId={user.id}
              onSubmit={(proposal) =>
                mutate(
                  `/requests/${selected.id}/proposals`,
                  "POST",
                  proposal,
                  () => {
                    setModal(null);
                    setNotice("Proposta enviada ao cliente.");
                  },
                )
              }
            />
          ) : (
            <>
              <h3>
                {selected.status === "open"
                  ? "Compare as propostas"
                  : "Proposta escolhida"}
              </h3>
              {selected.proposals
                .filter(
                  (proposal) =>
                    selected.status === "open" ||
                    proposal.id === selected.selectedId,
                )
                .map((proposal) => {
                  const person = state.drivers.find(
                    (item) => item.id === proposal.driverId,
                  );
                  return (
                    <div className="proposal" key={proposal.id}>
                      <div className="proposal-heading">
                        <Avatar account={person} />
                        <div>
                          <strong>{person.name} {person.verified && (
                          <span className="driver-verified-label"><ShieldCheck size={13}/> Verificado</span>
                        )}</strong>
                          <small>
                            <Star size={13} />
                            {person?.rating || "Novo"} · {person?.trips || 0}{" "}
                            fretes
                          </small>
                        </div>
                        <strong className="price">
                          {money(proposal.price)}
                        </strong>
                      </div>
                      <p>
                        {person.vehicle} · Retirada às {proposal.time}
                      </p>
                      <p className="muted">{proposal.note}</p>
                      {selected.status === "open" && area === "cliente" && (
                        <button
                          className="primary full"
                          onClick={() =>
                            setModal({
                              type: "confirm",
                              id: selected.id,
                              proposalId: proposal.id,
                            })
                          }
                        >
                          Escolher motorista
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              {!selected.proposals.length && (
                <p className="info">
                  Aguardando propostas dos motoristas disponíveis.
                </p>
              )}
            </>
          )}
          {area === "motorista" &&
            selected.proposals.find(
              (proposal) => proposal.id === selected.selectedId,
            )?.driverId === user.id &&
            ["booked", "transit"].includes(selected.status) && (
              <button
                className="primary full"
                onClick={() =>
                  updateRequest(selected.id, {
                    status:
                      selected.status === "booked" ? "transit" : "completed",
                  })
                }
              >
                {selected.status === "booked"
                  ? "Iniciar transporte"
                  : "Concluir frete"}
              </button>
            )}
          {area === "cliente" && selected.paymentMethod === "pix_freteon" &&
             selected.status === "booked" && selected.paymentStatus === "awaiting" && (
            <div className="finance-action">
              <p className="info">Frete contratado. Simule o Pix para liberar o início do transporte. Não existe pagamento real nesta versão.</p>
              <button className="primary full" disabled={busy}
                onClick={() => walletAction(selected.id, "simulate_pix_payment")}>
                Simular pagamento Pix de {money(selected.agreedPriceCents / 100)}
              </button>
            </div>
          )}
          {area === "cliente" && selected.status === "completed" &&
            selected.paymentMethod && !selected.deliveryConfirmedAt &&
            selected.disputeStatus === "none" && (
            <div className="finance-action">
              <h3>Confirmação da entrega e do pagamento</h3>
              <p>O motorista marcou este frete como concluído. Confirme somente após verificar a entrega
              {selected.paymentMethod !== "pix_freteon" ? " e efetuar o pagamento diretamente ao motorista." : "."}</p>
              <button className="primary full" disabled={busy}
                onClick={() => walletAction(selected.id, "confirm_delivery")}>
                Confirmar entrega {selected.paymentMethod === "pix_freteon" ? "(simulação)" : "e pagamento"}
              </button>
              <button className="secondary full" disabled={busy}
                onClick={() => setModal({ type: "issue", id: selected.id })}>
                Informar problema na entrega
              </button>
            </div>
          )}
          {area === "cliente" && selected.status === "completed" &&
             selected.paymentMethod && selected.deliveryConfirmedAt &&
             selected.disputeStatus === "none" &&
             selected.canDispute === true && (
            <div className="finance-action">
              <p className="muted">Entrega confirmada. Se houver um problema antes da liquidação, informe ao Master.</p>
              <button className="secondary full" disabled={busy}
                onClick={() => setModal({ type: "issue", id: selected.id })}>Abrir contestação</button>
            </div>
          )}
          {area === "cliente" && selected.status === "completed" &&
            (selected.deliveryConfirmedAt || !selected.paymentMethod) && (
            <div className="rating">
              <h3>
                {selected.rating
                  ? `Sua avaliação: ${selected.rating} de 5`
                  : "Como foi seu frete?"}
              </h3>
              {!selected.rating &&
                [1, 2, 3, 4, 5].map((score) => (
                  <button
                    aria-label={`Avaliar com ${score} estrelas`}
                    key={score}
                    onClick={() =>
                      updateRequest(selected.id, { rating: score })
                    }
                  >
                    {score}
                    <Star size={20} />
                  </button>
                ))}
            </div>
          )}
          {area === "cliente" &&
            ["open", "booked"].includes(selected.status) && (
              <button
                className="danger-link"
                onClick={() => setModal({ type: "cancel", id: selected.id })}
              >
                Cancelar pedido
              </button>
            )}
        </Modal>
      )}
      {modal?.type === "photo" && selected && (
        <Modal title="Foto da carga" onClose={() => setModal({ type: modal.returnTo || "detail", id: selected.id })}>
          <FreightPhotoImage className="freight-photo-expanded"
            src={selected.photos?.[modal.index]} alt={`Foto ${modal.index + 1} da carga`} eager />
          <button className="secondary full" onClick={() =>
            setModal({ type: modal.returnTo || "detail", id: selected.id })}>Voltar aos detalhes</button>
        </Modal>
      )}
      {modal?.type === "confirm" && selected && (
        <Modal
          error={notice}
          busy={busy}
          title="Confirmar motorista"
          onClose={() => setModal({ type: "detail", id: selected.id })}
        >
          <p>
            Você está escolhendo{" "}
            <strong>
              {
                state.drivers.find(
                  (person) =>
                    person.id ===
                    selected.proposals.find((p) => p.id === modal.proposalId)
                      .driverId,
                ).name
              }
            </strong>{" "}
            por{" "}
            <strong>
              {money(
                selected.proposals.find((p) => p.id === modal.proposalId).price,
              )}
            </strong>
            .
          </p>
          <div className="finance-action">
            <PaymentLabel method={selected.paymentMethod} />
            <p className="freight-legal-notice">
              <ShieldCheck size={16} />
              O contrato de transporte é celebrado diretamente com o motorista. O FreteOn fornece a intermediação digital e não inclui seguro automático da carga.
              <a href="/termos" target="_blank" rel="noopener noreferrer">Ver responsabilidades</a>
            </p>
            <p className="client-total-price">
              Total a pagar:{" "}
              <strong>{money(selected.proposals.find((p) => p.id === modal.proposalId).price)}</strong>
            </p>
            <p className="info">
              {selected.paymentMethod === "pix_freteon"
                ? "Pagamento Pix apenas simulado após a contratação. Não haverá cobrança real."
                : selected.paymentMethod === "card_driver"
                  ? "Pague diretamente na maquininha do motorista. O preço total informado na proposta deve incluir os custos da transação."
                  : selected.paymentMethod === "cash_driver"
                    ? "Pague em dinheiro diretamente ao motorista na entrega."
                    : "Forma de pagamento não registrada neste pedido antigo."}
            </p>
          </div>
          <button
            className="primary full"
            onClick={async () => {
              if (
                await updateRequest(selected.id, {
                  status: "booked",
                  selectedId: modal.proposalId,
                })
              )
                setModal({ type: "detail", id: selected.id });
            }}
          >
            Confirmar contratação
            <Check size={18} />
          </button>
        </Modal>
      )}
      {modal?.type === "issue" && selected && (
        <Modal title="Informar problema com o frete" error={notice} busy={busy}
          onClose={() => setModal({ type: "detail", id: selected.id })}>
          <IssueForm busy={busy} onSubmit={async (reason) => {
            if (await walletAction(selected.id, "report_issue", { reason }))
              setModal({ type: "detail", id: selected.id });
          }} />
        </Modal>
      )}
      {modal?.type === "cancel" && selected && (
        <Modal
          error={notice}
          busy={busy}
          title="Cancelar pedido?"
          onClose={() => setModal({ type: "detail", id: selected.id })}
        >
          <p>O pedido será encerrado e deixará de receber propostas.</p>
          <button
            className="primary full"
            onClick={async () => {
              if (await updateRequest(selected.id, { status: "cancelled" }))
                setModal(null);
            }}
          >
            Confirmar cancelamento
          </button>
        </Modal>
      )}
      {modal?.type === "driver" && (
        <Modal
          error={notice}
          busy={busy}
          title="Análise de motorista"
          onClose={() => setModal(null)}
        >
          <h3>
            {state.drivers.find((person) => person.id === modal.driverId).name}
          </h3>
          <p>
            {
              state.drivers.find((person) => person.id === modal.driverId)
                .vehicle
            }
          </p>
          <div className="review">
            <FileCheck2 />
            <p>Celular: {state.drivers.find((person) => person.id === modal.driverId).phone}</p>
          </div>
          <DriverVerificationPanel
            key={modal.driverId}
            driverId={modal.driverId}
            role="master"
            onChange={refresh}
          />
        </Modal>
      )}
      {modal?.type === "notifications" && (
        <Modal
          error={notice}
          busy={busy}
          title="Atualizações dos fretes"
          onClose={() => setModal(null)}
        >
          {area === "motorista" ? (
            <>
              {bookingsPending.map((request) => (
                <button className="notification-row" key={request.id}
                  onClick={() => setModal({ type: "driverBooking", id: request.id })}>
                  <CheckCircle2 size={22} color="#268559" />
                  <span>
                    <strong>Proposta aceita: {request.title}</strong>
                    <small>Cliente confirmou sua contratação. Toque para visualizar o frete completo.</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!bookingsPending.length && <p>Você não possui novos fretes contratados.</p>}
            </>
          ) : (
            <>
              {active
                .filter((request) => request.proposals.length)
                .map((request) => (
                  <button className="notification-row" key={request.id}
                    onClick={() => setModal({ type: "detail", id: request.id })}>
                    <Bell size={20} />
                    <span>
                      <strong>{request.title}</strong>
                      <small>{request.proposals.length} proposta(s) recebida(s)</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              {!totalProposals && <p>Sem novas propostas.</p>}
            </>
          )}
        </Modal>
      )}
      {modal?.type === "help" && (
        <Modal
          error={notice}
          busy={busy}
          title="Como funciona o FreteOn"
          onClose={() => setModal(null)}
        >
          <div className="help-step">
            <MapPin />
            <div>
              <h3>Conte o que precisa levar</h3>
              <p>Informe retirada, entrega, carga e horário.</p>
            </div>
          </div>
          <div className="help-step">
            <FileCheck2 />
            <div>
              <h3>Compare as propostas</h3>
              <p>Veja preço, veículo e informações do motorista.</p>
            </div>
          </div>
          <div className="help-step">
            <Truck />
            <div>
              <h3>Escolha e acompanhe</h3>
              <p>Confirme o motorista e avalie após a entrega.</p>
            </div>
          </div>
          <p className="info">
            Pedidos, propostas e pagamentos simulados ficam registrados na conta.
            Para motoristas com o painel aberto, contratações novas são verificadas
            aproximadamente a cada 5 segundos. Dinheiro e cartão
            são recebidos pelo motorista; Pix pelo FreteOn ainda é simulado.
          </p>
        </Modal>
      )}
      {area !== "master" && (
        <PushNotificationsPanel role={area} accountId={user.id} autoInvite
          canDisplay={loaded && !modal && page === "inicio"}
        />
      )}
    </div>
  );
}

function IssueForm({ onSubmit, busy }) {
  const [reason, setReason] = useState("");
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit(reason.trim());
    }}>
      <p>Descreva o problema para o Master analisar. Enquanto a contestação estiver aberta,
      não será feita a liberação ou cobrança automática referente a este frete.</p>
      <label>O que aconteceu?
        <textarea value={reason} required minLength={10} maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Descreva a situação da entrega ou pagamento..." />
      </label>
      <button type="submit" className="primary full" disabled={busy || reason.trim().length < 10}>
        Enviar contestação
      </button>
    </form>
  );
}

function ProposalForm({ request, available, driverId, onSubmit }) {
  const previous = request.proposals.find(
    (proposal) => proposal.driverId === driverId,
  );
  const [proposedPrice, setProposedPrice] = useState(String(previous?.price || ""));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({
          price: Number(data.get("price")),
          time: data.get("time"),
          note: data.get("note").trim(),
        });
      }}
    >
      <h3>{previous ? "Atualizar minha proposta" : "Enviar proposta"}</h3>
      <div className="payment-choice-notice">
        <strong>Pagamento escolhido pelo cliente</strong>
        <PaymentLabel method={request.paymentMethod} />
        <p>{request.paymentMethod === "card_driver"
          ? "Você recebe na sua maquininha e repassa 10% ao FreteOn em até 72h após a confirmação do pagamento."
          : request.paymentMethod === "cash_driver"
          ? "Você recebe em dinheiro e repassa 10% ao FreteOn em até 72h após a confirmação do pagamento."
          : request.paymentMethod === "pix_freteon"
          ? "Pix pelo FreteOn (simulação). Após a entrega, solicite seu repasse manual pela carteira."
          : "Pedido anterior sem forma de pagamento definida."}</p>
      </div>
      <div className="form-grid">
        <label>
          Seu preço (R$)
          <input
            type="number"
            name="price"
            required
            min="1"
            max="100000"
            step="0.01"
            value={proposedPrice}
            onChange={(event) => setProposedPrice(event.target.value)}
            placeholder="0,00"
          />
        </label>
        <label>
          Horário de retirada
          <input
            type="time"
            name="time"
            required
            defaultValue={previous?.time || request.time}
          />
        </label>
      </div>
      <label>
        O que está incluído?
        <textarea
          name="note"
          required
          maxLength={400}
          defaultValue={previous?.note}
          placeholder="Ajudante, proteção da carga e outras informações"
        />
      </label>
      <CommissionPreview price={proposedPrice} method={request.paymentMethod} />
      <button className="primary full" disabled={!available}>
        {available ? "Enviar proposta" : "Verifique sua disponibilidade, carteira e meios de pagamento"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
