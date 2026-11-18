import { readFreightDraft, saveFreightDraft, deleteFreightDraft } from "./freightDraft.js";
import { PhoneVerificationPanel, PhoneVerificationMaster } from "./PhoneVerification.jsx";
import { mapsRouteUrl } from "./addressFormat.js";
import FreightCarousel from "./FreightCarousel.jsx";
import RefundPanel, { refundBlocked } from "./RefundPanel.jsx";
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
  Menu,
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
  MessageSquare,
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
import { RecoveryMaster } from "./PasswordRecovery.jsx";
import CommissionSettings from "./CommissionSettings.jsx";
import MasterNotifications, { useMasterNotifications } from "./MasterNotifications.jsx";
import PushNotificationsPanel from "./PushNotificationsPanel.jsx";
import DriverVerificationPanel from "./DriverVerificationPanel.jsx";
import WalletPanel, { PaymentLabel, CommissionPreview } from "./WalletPanel.jsx";
import MercadoPagoPix from "./MercadoPagoPix.jsx";
import FreightChatPanel from "./FreightChatPanel.jsx";
import MasterFreightReports, { ReportFreightForm } from "./MasterFreightReports.jsx";
import TeamManagement from "./TeamManagement.jsx";
import HelpCenter from "./HelpCenter.jsx";
import CampaignManager, { CampaignViewer } from "./CampaignManager.jsx";

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
    ["notificacoes", "Notificações", BellRing],
    ["motoristas", "Motoristas", Truck],
    ["fretes", "Fretes", Package],
    ["financeiro", "Financeiro", FileCheck2],
    ["comissoes", "Taxas de comissão", FileCheck2],
    ["usuarios", "Usuários", Users],
    ["equipe", "Gestão de equipe", ShieldCheck],
    ["auditoria", "Auditoria", History],
    ["recuperacao", "Recuperar senhas", ShieldCheck],
    ["verificacao-telefone", "Verificar telefones", ShieldCheck],
    ["privacidade", "Privacidade LGPD", ShieldCheck],
    ["central-ajuda", "Central de Ajuda", CircleHelp],
    ["campanhas", "Campanhas e comunicados", BellRing],
    ["denuncias", "Denúncias", Flag],
  ],
};

const masterPagePermissions = {
  inicio: "dashboard.view", notificacoes: "notifications.view",
  motoristas: "drivers.view", fretes: "freights.view",
  financeiro: "finance.view", comissoes: "finance.view",
  usuarios: "users.view", denuncias: "support.view", auditoria: "audit.view"
};
function visibleNavigation(area, user) {
  if (area !== "master" || user.adminRole === "owner") return navigation[area];
  const permissions = user.adminPermissions || [];
  return navigation.master.filter(([key]) => permissions.includes(masterPagePermissions[key]));
}
function Route({ request }) {
  return (
    <div className="route">
      <div>
        <span className="route-dot" />
        <p>
          <small>Retirada</small>
          {request.origin}
          {request.originAddress?.complement && <small>Complemento: {request.originAddress.complement}</small>}
          {request.originAddress?.reference && <small>Referência: {request.originAddress.reference}</small>}
        </p>
      </div>
      <div>
        <MapPin size={15} />
        <p>
          <small>Entrega</small>
          {request.destination}
          {request.destinationAddress?.complement && <small>Complemento: {request.destinationAddress.complement}</small>}
          {request.destinationAddress?.reference && <small>Referência: {request.destinationAddress.reference}</small>}
        </p>
      </div>
    </div>
  );
}
function RouteDistance({ request }) {
  return <div className="freight-distance">
    <a className="maps-route-button" href={mapsRouteUrl(request.origin, request.destination)} target="_blank" rel="noopener noreferrer">
      <MapPin size={18}/> Abrir rota no Google Maps <ArrowRight size={17}/>
    </a>
    <small className="maps-route-help">Veja a distância e o tempo estimado no Maps.</small>
  </div>;
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

// Checkout Pix do cliente: pagamento em primeiro plano; rota e conversa ficam
// disponíveis sem ocupar toda a altura do modal na abertura.
function ClientPixCheckoutCompact({
  request, currentUserId, drivers, gateway, busy, onPaid,
  onPhoto, onReport, onFinanceAction, onCancel,
}) {
  const proposal = request.proposals?.find(item => item.id === request.selectedId);
  const driver = drivers.find(person => person.id === request.driverId) ||
    drivers.find(person => person.id === proposal?.driverId);
  const awaitingPix = request.paymentStatus === "awaiting";
  const sandboxApproved = request.paymentProvider === "pagbank" &&
    request.paymentProviderEnvironment === "sandbox" && Boolean(request.pagbankTestApprovedAt);
  const bankPaid = ["paid_mp", "paid_pagbank"].includes(request.paymentStatus) && !sandboxApproved;

  return (
    <div className="client-pix-compact">
      <section className="client-pix-overview" aria-label="Resumo do frete contratado">
        <div className="client-pix-overview-head">
          <span className="status booked">Contratado</span>
          <div className="client-pix-total">
            <small>Valor do frete</small>
            <strong>{money((request.agreedPriceCents || 0) / 100)}</strong>
          </div>
        </div>
        <div className="client-pix-mini-route">
          <div><MapPin size={15}/><span><small>Retirada</small><strong title={request.origin}>{request.origin}</strong></span></div>
          <div><MapPin size={15}/><span><small>Entrega</small><strong title={request.destination}>{request.destination}</strong></span></div>
        </div>
        <div className="client-pix-driver-summary">
          <Truck size={16}/>
          <span>Motorista: <strong>{driver?.name || "Contratado"}</strong>
            {proposal?.time ? ` · Retirada às ${proposal.time}` : ""}
          </span>
        </div>
      </section>

      {awaitingPix && (
        <MercadoPagoPix requestId={request.id} kind="freight"
          gateway={gateway} onPaid={onPaid} compact />
      )}
      {sandboxApproved && (
        <p className="client-pix-test-note" role="status">
          <CheckCircle2 size={17}/> Pix aprovado no PagBank sandbox. Este frete pode seguir em homologação, sem movimentar dinheiro real.
        </p>
      )}
      {bankPaid && (
        <p className="client-pix-test-note" role="status">
          <CheckCircle2 size={17}/> Pagamento Pix confirmado pelo banco. O motorista pode prosseguir com o transporte.
        </p>
      )}

      <details className="client-pix-disclosure">
        <summary><Package size={18}/><span>Ver detalhes, fotos e rota</span><ChevronRight size={18}/></summary>
        <div className="client-pix-disclosure-content">
          <Route request={request}/>
          <RouteDistance request={request}/>
          {request.description && <p>{request.description}</p>}
          <p className="muted">{request.vehicle || "Veículo a combinar"} · {request.helper ? "Com ajudante" : "Sem ajudante"} · {request.time}</p>
          {proposal?.note && <p className="muted">Observação do motorista: {proposal.note}</p>}
          {request.photos?.length > 0 && (
            <div className="freight-gallery">
              <h3>Fotos da carga ({request.photos.length})</h3>
              <div className="freight-gallery-images">
                {request.photos.map((photo, index) => (
                  <button type="button" key={index} onClick={() => onPhoto(index)}>
                    <FreightPhotoImage src={photo} alt={`Abrir foto ${index + 1} da carga`}/>
                  </button>
                ))}
              </div>
            </div>
          )}
          <RefundPanel request={request} role="cliente" busy={busy} onAction={onFinanceAction}/>
        </div>
      </details>

      <details className="client-pix-disclosure">
        <summary><MessageSquare size={18}/><span>Conversa com o motorista</span><ChevronRight size={18}/></summary>
        <div className="client-pix-disclosure-content">
          <FreightChatPanel requestId={request.id} currentUserId={currentUserId} onReport={onReport}/>
        </div>
      </details>

      {!refundBlocked(request) && !bankPaid && !sandboxApproved && (
        <button type="button" className="client-pix-cancel" onClick={onCancel}>
          Cancelar pedido
        </button>
      )}
    </div>
  );
}

function DriverContractCompact({ request, currentUserId, busy, onAdvance, onPhoto, onReport, onFinanceAction, testFlowEnabled = false }) {
  const [chatOpen, setChatOpen] = useState(false);
  const accepted = request.proposals.find((proposal) => proposal.id === request.selectedId);
  const gross = Number.isFinite(request.agreedPriceCents) ? request.agreedPriceCents : Math.round(Number(accepted?.price || 0) * 100);
  const rate = Number.isFinite(request.commissionRate) ? request.commissionRate : 10;
  const fee = Number.isFinite(request.commissionCents) ? request.commissionCents : Math.round(gross * rate / 100);
  const net = Number.isFinite(request.driverNetCents) ? request.driverNetCents : gross - fee;
  const sandboxApproved = testFlowEnabled && request.paymentMethod === "pix_freteon" &&
    request.paymentProvider === "pagbank" && request.paymentProviderEnvironment === "sandbox" &&
    Boolean(request.pagbankTestApprovedAt);
  const pixWaiting = request.paymentMethod === "pix_freteon" &&
    !(request.paymentStatus === "paid_mp" ||
      (request.paymentStatus === "paid_pagbank" && request.paymentProviderEnvironment === "production")) &&
    !sandboxApproved;
  const startBlocked = busy || refundBlocked(request) || (request.status === "booked" && pixWaiting);
  const time = accepted?.time || request.time;
  const canAdvance = ["booked", "transit"].includes(request.status);

  return (
    <div className="driver-compact">
      <div className="driver-compact-status">
        <CheckCircle2 size={18} />
        <span>{request.status === "booked" ? "Frete contratado" : "Em transporte"}</span>
        <span className={`status ${request.status}`}>{statusLabels[request.status]}</span>
      </div>
      <Route request={request} />
      <section className="driver-compact-payment" aria-label="Resumo do pagamento combinado">
        <PaymentLabel method={request.paymentMethod} />
        <div className="driver-compact-values">
          <span>Valor combinado</span><strong>{money(gross / 100)}</strong>
          <span>Comissão FreteOn ({rate}%)</span><strong>− {money(fee / 100)}</strong>
          <span className="driver-compact-net-label">Após comissão</span><strong className="driver-compact-net">{money(net / 100)}</strong>
        </div>
        {request.paymentMethod === "card_driver" && <small>Valor antes das taxas da sua maquininha.</small>}
        {request.paymentMethod === "pix_freteon" && <small>{sandboxApproved
          ? "Pix de teste aprovado no PagBank. Você pode iniciar e concluir este frete de homologação. Não haverá repasse bancário."
          : "Pix do cliente confirmado pelo banco libera o transporte. Repasse ao motorista após a entrega e confirmação."}</small>}
        {request.paymentMethod === "cash_driver" && <small>Pagamento em dinheiro diretamente ao motorista.</small>}
      </section>
      <div className="driver-compact-meta">
        <span><Clock3 size={16} /> {request.date ? new Date(`${request.date}T12:00:00`).toLocaleDateString("pt-BR") : "Data a combinar"} · {time}</span>
        <span><Package size={16} /> {request.helper ? "Com ajudante" : "Sem ajudante"}</span>
      </div>
      {request.description && (
        <details className="driver-compact-expand">
          <summary><Package size={17} /> Descrição da carga <ChevronRight size={17} /></summary>
          <p>{request.description}</p>
        </details>
      )}
      {request.photos?.length > 0 && (
        <details className="driver-compact-expand">
          <summary><Camera size={17} /> Ver fotos da carga ({request.photos.length}) <ChevronRight size={17} /></summary>
          <div className="freight-gallery-images">
            {request.photos.map((photo, index) => (
              <button type="button" key={index} onClick={() => onPhoto(index)} aria-label={`Ampliar foto ${index + 1} da carga`}>
                <FreightPhotoImage src={photo} alt={`Foto ${index + 1} da carga`} />
              </button>
            ))}
          </div>
        </details>
      )}
      {request.vehicle && <p className="driver-compact-vehicle"><Truck size={15} /> {request.vehicle}</p>}
      <button type="button" className="driver-compact-link" onClick={() => setChatOpen(open => !open)}
        aria-expanded={chatOpen} aria-controls={`driver-chat-${request.id}`}>
        <MessageSquare size={19} />
        <span>{chatOpen ? "Fechar conversa" : "Abrir conversa com o cliente"}</span>
        <ChevronRight size={19} className={chatOpen ? "driver-compact-chevron-open" : ""} />
      </button>
      {chatOpen && <div id={`driver-chat-${request.id}`}>
        <FreightChatPanel requestId={request.id} currentUserId={currentUserId} onReport={onReport} />
      </div>}
      <RouteDistance request={request} />
      <RefundPanel request={request} role="motorista" busy={busy} onAction={onFinanceAction} />
      {canAdvance && (
        <div className="driver-compact-footer">
          {request.status === "booked" && pixWaiting && (
            <p className="info">Aguardando confirmação do Pix para iniciar o transporte.</p>
          )}
          {request.status === "booked" && sandboxApproved && (
            <p className="info">PagBank sandbox aprovado. Transporte liberado apenas para teste; nenhum dinheiro real foi recebido.</p>
          )}
          {refundBlocked(request) && <p className="info">Frete suspenso para análise do reembolso.</p>}
          <button type="button" className="primary full" disabled={startBlocked} onClick={onAdvance}>
            <Truck size={19} /> {request.status === "booked" ? "Iniciar transporte" : "Concluir frete"}
          </button>
        </div>
      )}
    </div>
  );
}

function DriverOpenFreightProposal({ request, driverId, commissionRate, available, onSubmit, onReport }) {
  const [expandedPhoto, setExpandedPhoto] = useState(-1);
  const currentProposal = request.proposals?.find(proposal => proposal.driverId === driverId);
  return (
    <div className="driver-open-layout">
      <section className="driver-open-brief" aria-label="Resumo do pedido">
        <div className="driver-open-route">
          <div><span>Retirada</span><strong>{request.origin}</strong></div>
          <div><span>Entrega</span><strong>{request.destination}</strong></div>
        </div>
        <div className="driver-open-meta">
          <span><Clock3 size={15}/> {request.date ? new Date(`${request.date}T12:00:00`).toLocaleDateString("pt-BR") : "Data a combinar"} · {request.time}</span>
          <span><Users size={15}/> {request.helper ? "Cliente precisa de ajudante" : "Sem ajudante solicitado"}</span>
        </div>
        {request.paymentMethod && <PaymentLabel method={request.paymentMethod}/>}
        <details className="driver-open-extra">
          <summary><Package size={18}/><span>Descrição, fotos e rota</span>{request.photos?.length > 0 && <small>{request.photos.length} foto(s)</small>}<ChevronRight size={18}/></summary>
          <div className="driver-open-extra-body">
            {request.description && <p className="driver-open-description">{request.description}</p>}
            {request.vehicle && <p className="muted">Veículo solicitado: {request.vehicle}</p>}
            {request.originAddress?.complement && <p className="muted">Complemento da retirada: {request.originAddress.complement}</p>}
            {request.originAddress?.reference && <p className="muted">Referência da retirada: {request.originAddress.reference}</p>}
            {request.destinationAddress?.complement && <p className="muted">Complemento da entrega: {request.destinationAddress.complement}</p>}
            {request.destinationAddress?.reference && <p className="muted">Referência da entrega: {request.destinationAddress.reference}</p>}
            {request.photos?.length > 0 && (
              <div className="driver-open-photos">
                {request.photos.map((photo, index) => (
                  <button key={index} type="button" aria-label={`Ver foto ${index + 1} da carga`}
                    aria-pressed={expandedPhoto === index}
                    onClick={() => setExpandedPhoto(previous => previous === index ? -1 : index)}>
                    <FreightPhotoImage src={photo} alt={`Foto ${index + 1} da carga`}/>
                  </button>
                ))}
                {expandedPhoto >= 0 && <FreightPhotoImage className="driver-open-expanded-photo"
                  src={request.photos[expandedPhoto]} alt={`Foto ampliada da carga ${expandedPhoto + 1}`} eager />}
              </div>
            )}
            <RouteDistance request={request}/>
          </div>
        </details>
        {currentProposal && <p className="driver-open-existing">Você já enviou uma proposta. É possível atualizar o preço e os serviços enquanto o pedido estiver aberto.</p>}
        <button type="button" className="driver-open-report" onClick={onReport}>
          <Flag size={15}/> Denunciar problema neste pedido
        </button>
      </section>
      <ProposalForm key={request.id} request={request} driverId={driverId}
        commissionRate={commissionRate} available={available} onSubmit={onSubmit}/>
    </div>
  );
}

function RequestForm({ onCreate, onClose, requestError, userId }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftFound, setDraftFound] = useState(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [data, setData] = useState({
    title: "",
    origin: "",
    destination: "",
    originPoint: null,
    destinationPoint: null,
    routeEstimate: null,
    paymentMethod: "",
    description: "",
    helper: false,
    date: "",
    time: "",
    photos: [],
  });
  useEffect(() => {
    let active = true;
    readFreightDraft(userId).then(draft => {
      if (!active) return;
      if (draft?.data) setDraftFound(draft);
    }).catch(() => {
      if (active) setDraftStatus('Armazenamento local indisponível; os dados podem não ser recuperados.');
    }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (!draftReady || draftFound) return undefined;
    const timer = setTimeout(() => {
      saveFreightDraft(userId, data, step).then(() => setDraftStatus('Rascunho salvo automaticamente'))
        .catch(() => setDraftStatus('Não foi possível salvar o rascunho neste aparelho.'));
    }, 650);
    return () => clearTimeout(timer);
  }, [userId, data, step, draftReady, draftFound]);
  function restoreDraft() {
    setData(draftFound.data);
    setStep(Math.max(0, Math.min(3, Number(draftFound.step) || 0)));
    setDraftFound(null);
    setDraftStatus('Rascunho recuperado');
  }
  async function discardDraft() {
    try { await deleteFreightDraft(userId); } catch { setDraftStatus('Não foi possível apagar o rascunho salvo.'); }
    setDraftFound(null);
    setDraftStatus('Novo frete iniciado');
  }
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
    if (step === 1 && data.origin.trim() === data.destination.trim()) {
      setError("Informe endereços diferentes para retirada e entrega.");
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (new Date(`${data.date}T${data.time}`) <= new Date()) {
      setError("Escolha uma data e um horário futuros.");
      return;
    }
    setLoading(true);
    try {
      const published = await onCreate(data);
      if (published) {
        // Limpa somente após confirmação de publicação, preservando o rascunho em caso de falha.
        try { await deleteFreightDraft(userId); } catch { /* pode ser apagado na próxima abertura */ }
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal title="Solicitar frete" onClose={onClose} error={requestError}>
      <div className="steps request-steps" aria-label="Etapas da solicitação">
        {["Retirada", "Entrega", "Carga", "Agendar"].map((label, index) => (
          <span key={label} className={index <= step ? "active" : ""}>
            {index + 1}. {label}
          </span>
        ))}
      </div>
      {draftFound && <div className="freight-draft-prompt" role="status">
        <strong>Você tem um frete não finalizado</strong>
        <p>Encontramos um rascunho salvo neste aparelho. Deseja continuar de onde parou?</p>
        <div className="freight-draft-actions">
          <button type="button" className="primary" onClick={restoreDraft}>Continuar rascunho</button>
          <button type="button" className="secondary" onClick={discardDraft}>Descartar e começar novo</button>
        </div>
      </div>}
      {!draftFound && draftStatus && <small className="freight-draft-status" role="status">{draftStatus}</small>}
      <form onSubmit={submit} style={draftFound ? { display: 'none' } : undefined}>
        {step === 0 && (
          <RoutePicker
            data={data}
            mode="origin"
            onChange={(patch) =>
              setData((previous) => ({ ...previous, ...patch }))
            }
          />
        )}
        {step === 1 && (
          <RoutePicker
            data={data}
            mode="destination"
            onChange={(patch) =>
              setData((previous) => ({ ...previous, ...patch }))
            }
          />
        )}
        {step === 2 && (
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
            <p className="freight-open-vehicle-notice">
              <Truck size={18} />
              Seu pedido será mostrado a todos os motoristas disponíveis e verificados.
              Cada motorista avalia a carga, suas fotos e o trajeto antes de oferecer um preço.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                name="helper"
                checked={data.helper}
                onChange={update}
              />
              <span>Preciso de ajudante para carregar <small className="muted" style={{ display: "block", marginTop: 4 }}>O ajudante tem custo. O motorista deve incluir esse serviço no valor total da proposta.</small></span>
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
        {step === 3 && (
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
                ["pix_freteon", "Pix pelo FreteOn", "O Pix é gerado após escolher o motorista. O transporte aguarda a confirmação do banco."],
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
                {data.helper ? "Preciso de ajudante" : "Não preciso de ajudante"}
              </p>
              {data.routeEstimate && (
                <p className="route-in-review">
                  {(data.routeEstimate.distanceMeters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km pelas ruas · {data.routeEstimate.durationMinutes} min estimados
                </p>
              )}
              <small>
                O pedido ficará aberto a todos os motoristas habilitados na plataforma.
                Eles avaliam a carga e decidem se desejam enviar uma proposta.
                Você escolhe o motorista e o preço.
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
            {photoProcessing ? "Preparando fotos..." : step === 3 ? "Publicar pedido" : "Continuar"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function App({ user, onLogout, onExpired, sessions, onSwitchRole }) {
  const area = user.role;
  const masterOwner = area === "master" && user.adminRole === "owner";
  const menu = visibleNavigation(area, user);
  const [state, setState] = useState({
    requests: [],
    drivers: [],
    users: [],
    available: false,
    wallet: { simulated: true },
    user,
  });
  const [page, setPage] = useState("inicio");
  const [masterMenuOpen, setMasterMenuOpen] = useState(false);
  useEffect(() => { setMasterMenuOpen(false); }, [area]);
  useEffect(() => { if (!masterMenuOpen) return; const onKey = (event) => { if (event.key === "Escape") setMasterMenuOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [masterMenuOpen]);
  const [commissionRate, setCommissionRate] = useState(10);
  useEffect(() => { if (area === "motorista") api("/commission/current").then(c => setCommissionRate(c.rate)).catch(() => {}); }, [area]);
  const masterNotifications = useMasterNotifications(area === "master" && (masterOwner || user.adminPermissions?.includes("notifications.view")));
  const masterUnreadByCategory = (key) => masterNotifications.items.filter(item => !item.read && item.category === key).length;
  const [recoveryPending, setRecoveryPending] = useState(0);
  useEffect(() => {
    if (!masterOwner) return;
    let active = true;
    const check = () => api("/recovery/master").then(data => { if (active) setRecoveryPending(data.items.filter(x => x.status === "pending").length); }).catch(() => {});
    check();
    const timer = setInterval(check, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [area, page, masterOwner]);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [install, setInstall] = useState(null);
  const [filter, setFilter] = useState("all");
  const [driverProposalView, setDriverProposalView] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const seenCompletions = useRef(new Set());
  const seenAcceptedBookings = useRef(new Set());
  const modalRef = useRef(null);
  useEffect(() => { modalRef.current = modal; }, [modal]);
  function showError(error) {
    if (!mounted.current) return;
    setLoaded(true);
    if (error.status === 401) onExpired();
    else setNotice(error.message);
  }
  async function refresh() {
    const data = await api("/state", { headers: { "X-FreteOn-Role": area } });
    if (mounted.current) {
      if (data.user?.role !== area || data.user?.id !== user.id) return;
      setState(data);
      setNotice("");
      setLoaded(true);
      if (area === "cliente" && !modalRef.current) {
        const toReview = data.requests.find((request) =>
          request.status === "completed" && !refundBlocked(request) &&
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
      setNotice("Registro financeiro atualizado.");
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
        request.status === "completed" && !refundBlocked(request) &&
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
  // Propostas em análise ficam separadas dos fretes contratados/concluídos.
  // As não escolhidas e as canceladas continuam acessíveis em Encerradas.
  const myProposals = area === "motorista"
    ? state.requests.filter(request =>
        request.proposals?.some(proposal => proposal.driverId === user.id))
    : [];
  const proposalPending = myProposals.filter(request => request.status === "open");
  const proposalClosed = myProposals.filter(request =>
    request.status === "cancelled" ||
    (["booked", "transit", "completed"].includes(request.status) &&
      request.driverId !== user.id));
  let requests = state.requests;
  if (page === "historico")
    requests = state.requests.filter((request) =>
      request.status === "completed" &&
      (area !== "motorista" || request.driverId === user.id),
    );
  else if (area === "cliente" && page === "fretes")
    requests = state.requests.filter((request) =>
      ["open", "booked", "transit"].includes(request.status) ||
      (filter === "cancelled" && request.status === "cancelled"),
    );
  else if (area === "motorista")
    requests =
      page === "propostas"
        ? driverProposalView === "pending" ? proposalPending : proposalClosed
        : state.requests.filter(
            (request) =>
              request.status === "open" ||
              (request.proposals.find(
                (proposal) => proposal.id === request.selectedId,
              )?.driverId === user.id &&
                ["booked", "transit"].includes(request.status)),
          );
  else if (page === "inicio") requests = active;
  if (filter !== "all" && page === "fretes")
    requests = requests.filter((request) => request.status === filter);

  function requestCard(request, featured = false) {
    return (
      <article className={`freight-card${featured === true ? " freight-card-featured" : ""}`} key={request.id}>
        <div className="card-top">
          <div className="package-icon">
            <Package size={22} />
          </div>
          <span className={`status ${request.status}`}>
            {statusLabels[request.status]}
          </span>
        </div>
        <h3>{request.title}</h3>
        {featured !== true && <small className="muted">
          {request.id}{request.vehicle ? ` · ${request.vehicle}` : " · Aberto a todos os veículos"}
        </small>}
        {featured === true && <p className="freight-card-summary">{request.description || "Confira os detalhes da carga antes de enviar sua proposta."}</p>}
        <Route request={request} />
        {request.photos?.length > 0 && (
          <button type="button" className="freight-card-photo" onClick={() =>
            setModal({ type: "detail", id: request.id })}>
            <FreightPhotoImage src={request.photos[0]} alt={`Foto da carga: ${request.title}`} />
            <span><Camera size={16} /> Ver {request.photos.length} foto(s) da carga</span>
          </button>
        )}
        {request.paymentMethod && <PaymentLabel method={request.paymentMethod} />}
        {request.refundStatus && request.refundStatus !== "none" && <p className="wallet-status warning">{{pending: "Reembolso em análise · frete suspenso", approved: "Reembolso aprovado", rejected: "Reembolso recusado — veja a justificativa", refunded_simulated: "Registro antigo: devolução não conciliada com banco"}[request.refundStatus]}</p>}
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
        {area === "motorista" ? <div className="driver-card-actions">
          <button type="button"
            className={request.status === "open" ? "driver-proposal-button" : "driver-details-button"}
            onClick={() => setModal({ type: "detail", id: request.id })}>
            {request.status === "open"
              ? request.proposals.some(p => p.driverId === user.id)
                ? "Ver detalhes e editar proposta"
                : "Ver detalhes e enviar proposta"
              : "Ver detalhes"}
            <ArrowRight size={18}/>
          </button>
        </div> : request.status === "open" ? (
          <button type="button" className={`client-proposals-cta${request.proposals.length ? " has-proposals" : ""}`}
            onClick={() => setModal({ type: "detail", id: request.id })}>
            <span className="client-proposals-cta-icon"><FileCheck2 size={23}/></span>
            <span className="client-proposals-cta-copy">
              <strong>{request.proposals.length ? "Ver propostas dos motoristas" : "Aguardando propostas"}</strong>
              <small>{request.proposals.length ? `${request.proposals.length} ${request.proposals.length === 1 ? "proposta recebida" : "propostas recebidas"} · Toque para comparar` : "Seu pedido está disponível para os motoristas"}</small>
            </span>
            {request.proposals.length > 0 && <span className="client-proposals-cta-count">{request.proposals.length}</span>}
            <ChevronRight size={21} className="client-proposals-cta-arrow"/>
          </button>
        ) : <button className="card-link" onClick={() => setModal({ type: "detail", id: request.id })}>Ver detalhes <ArrowRight size={18}/></button>}
      </article>
    );
  }

  function clientFreightCard(request) {
    const proposalCount = request.proposals?.length || 0;
    const isOpen = request.status === "open";
    const needsConfirmation = request.status === "completed" &&
      request.paymentMethod && !request.deliveryConfirmedAt &&
      request.disputeStatus === "none" && !refundBlocked(request);
    const date = request.date
      ? new Date(`${request.date}T12:00:00`)
      : new Date(request.createdAt || 0);
    const dateLabel = !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
      : "Data não informada";
    const actionLabel = isOpen
      ? proposalCount > 0 ? "Ver propostas dos motoristas" : "Ver detalhes do pedido"
      : needsConfirmation ? "Confirmar entrega"
      : ["booked", "transit"].includes(request.status) ? "Acompanhar frete"
      : "Ver detalhes do frete";

    return (
      <article className="driver-history-card client-freight-card" key={request.id}>
        <div className="driver-history-heading">
          <span className={`status ${request.status}`}>
            {statusLabels[request.status]}
          </span>
          <span className="driver-history-date"><Clock3 size={14}/> {dateLabel}</span>
        </div>
        <h3>{request.title}</h3>
        <div className="driver-history-addresses">
          <div><span>Retirada</span><strong>{request.origin}</strong></div>
          <div><span>Entrega</span><strong>{request.destination}</strong></div>
        </div>
        <div className="client-freight-card-summary">
          {request.status === "open" ? (
            <span className={`client-freight-proposals${proposalCount > 0 ? " has-proposals" : ""}`}>
              <FileCheck2 size={17}/>
              {proposalCount > 0
                ? `${proposalCount} ${proposalCount === 1 ? "proposta recebida" : "propostas recebidas"}`
                : "Aguardando propostas"}
            </span>
          ) : Number.isFinite(request.agreedPriceCents) ? (
            <div className="driver-history-price">
              <span>Valor combinado</span>
              <strong>{money(request.agreedPriceCents / 100)}</strong>
            </div>
          ) : null}
          {request.photos?.length > 0 && (
            <span className="client-freight-photo-count"><Camera size={15}/> {request.photos.length} foto(s) da carga</span>
          )}
          {needsConfirmation && <span className="client-freight-attention">Entrega aguardando confirmação</span>}
        </div>
        <button type="button"
          className={`driver-history-details${isOpen && proposalCount > 0 ? " client-freight-action-highlight" : ""}`}
          onClick={() => setModal({ type: "detail", id: request.id })}>
          {actionLabel} <ArrowRight size={18}/>
        </button>
      </article>
    );
  }

  function driverProposalCard(request) {
    const proposal = request.proposals.find(item => item.driverId === user.id);
    const isOpen = request.status === "open";
    const wasCancelled = request.status === "cancelled";
    const statusText = isOpen ? "Aguardando decisão do cliente" :
      wasCancelled ? "Pedido cancelado" : "Outra proposta foi escolhida";
    const date = proposal?.createdAt || request.createdAt;
    const dateLabel = date && !Number.isNaN(new Date(date).getTime())
      ? new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
      : "Data não informada";
    return (
      <article className="driver-history-card driver-proposal-card" key={request.id}>
        <div className="driver-history-heading">
          <span className={`driver-proposal-status ${isOpen ? "waiting" : "closed"}`}>
            <FileCheck2 size={15}/> {statusText}
          </span>
          <span className="driver-history-date"><Clock3 size={14}/> {dateLabel}</span>
        </div>
        <h3>{request.title}</h3>
        <div className="driver-history-addresses">
          <div><span>Retirada</span><strong>{request.origin}</strong></div>
          <div><span>Entrega</span><strong>{request.destination}</strong></div>
        </div>
        {proposal && <div className="driver-history-price">
          <span>Valor da sua proposta</span>
          <strong>{money(proposal.price)}</strong>
        </div>}
        <button type="button" className="driver-history-details"
          onClick={() => setModal({ type: "detail", id: request.id })}>
          {isOpen ? "Ver ou atualizar proposta" : "Ver detalhes do pedido"}
          <ArrowRight size={18}/>
        </button>
      </article>
    );
  }

  function driverHistoryCard(request) {
    const completed = request.status === "completed";
    const date = request.completedAt || request.updatedAt || request.createdAt;
    const dateLabel = date && !Number.isNaN(new Date(date).getTime())
      ? new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
      : request.date
        ? new Date(`${request.date}T12:00:00`).toLocaleDateString("pt-BR")
        : "Data não informada";
    return (
      <article className="driver-history-card" key={request.id}>
        <div className="driver-history-heading">
          <span className={`status ${request.status}`}>
            {completed ? <CheckCircle2 size={15} /> : <X size={15} />}
            {statusLabels[request.status]}
          </span>
          <span className="driver-history-date"><Clock3 size={14} /> {dateLabel}</span>
        </div>
        <h3>{request.title}</h3>
        <div className="driver-history-addresses">
          <div><span>Retirada</span><strong>{request.origin}</strong></div>
          <div><span>Entrega</span><strong>{request.destination}</strong></div>
        </div>
        {Number.isFinite(request.agreedPriceCents) && (
          <div className="driver-history-price">
            <span>Valor combinado</span>
            <strong>{money(request.agreedPriceCents / 100)}</strong>
          </div>
        )}
        {request.commissionStatus === "pending" && (
          <p className="driver-history-pending">Comissão pendente · Acompanhe em Minha carteira</p>
        )}
        <button type="button" className="driver-history-details"
          onClick={() => setModal({ type: "detail", id: request.id })}>
          Ver detalhes do frete <ArrowRight size={18}/>
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
          {menu.map(([key, label, Icon]) => (
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
                ((key === "motoristas" && pending.length > 0) || (key === "recuperacao" && recoveryPending > 0) || (key === "notificacoes" && masterNotifications.unread > 0) || (["financeiro", "fretes", "denuncias"].includes(key) && masterUnreadByCategory(key) > 0)) && (
                  <span className="count">{key === "recuperacao" ? recoveryPending : key === "notificacoes" ? masterNotifications.unread : ["financeiro", "fretes", "denuncias"].includes(key) ? masterUnreadByCategory(key) : pending.length}</span>
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
          {area === "master" && <button type="button" className="master-menu-toggle" aria-label="Abrir menu administrativo" aria-expanded={masterMenuOpen} aria-controls="master-mobile-drawer" onClick={() => setMasterMenuOpen(true)}><Menu size={24} /></button>}
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
              onClick={() => area === "master" ? (masterNotifications.refresh(), setPage("notificacoes")) : setModal({ type: "notifications" })}
            >
              <Bell size={20} />
              {(area === "master" ? masterNotifications.unread > 0 : area === "motorista" ? bookingsPending.length > 0 : totalProposals > 0) && (
                <span className="notification-dot" />
              )}
            </button>
            <Avatar account={state.user} />
          </div>
        </header>
        <div className="account-bar">
          <span>
            {state.user.name} · {area === "master" ? (masterOwner ? "Master Principal" : user.adminRole === "financeiro" ? "Financeiro" : user.adminRole === "operacional" ? "Operacional" : user.adminRole === "atendimento" ? "Atendimento" : "Auditor") : areas[area]}
          </span>
          <RoleSwitcher
            activeRole={area}
            sessions={sessions}
            onSwitch={onSwitchRole}
          />
          <button onClick={logout}>Sair desta conta</button>
        </div>
        <main>
          {(area === "cliente" || area === "motorista") && <CampaignViewer role={area} />}
          {!loaded && <p role="status">Carregando seus dados…</p>}
          {loaded && area === "cliente" && !state.user.phoneVerified && (
            <div className="phone-confirm-home-banner" role="status">
              <ShieldCheck size={23} aria-hidden="true"/>
              <div>
                <strong>Confirme seu celular para solicitar fretes</strong>
                <p>Para proteger sua conta, confirme seu número pelo código enviado pela equipe no WhatsApp. Após a confirmação, este aviso desaparecerá automaticamente.</p>
                <button type="button" className="primary" onClick={() => setPage("perfil")}>
                  Confirmar meu celular <ArrowRight size={16}/>
                </button>
              </div>
            </div>
          )}
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
                  : menu.find((item) => item[0] === page)?.[1]}
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
            {area === "cliente" && page === "fretes" && (
              <button
                className="primary"
                onClick={() => setModal({ type: "create" })}
              >
                <Plus size={19} />
                Solicitar frete
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
              mpEnabled={state.mercadoPagoEnabled}
              gateway={state.paymentGateway}
              onPaid={refresh}
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
            <section className={`panel profile${area === "motorista" ? " driver-profile-compact" : ""}`}>
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
              {area === "cliente" && (
                <details className="driver-profile-documents">
                  <summary>
                    <ShieldCheck size={20}/>
                    <span><strong>Segurança da conta</strong>
                      <small>{state.user.phoneVerified ? "Telefone confirmado" : "Confirme seu número de telefone"}</small>
                    </span>
                    <ChevronRight size={19} className="driver-profile-disclosure-arrow"/>
                  </summary>
                  <PhoneVerificationPanel onVerified={refresh}/>
                </details>
              )}
              {area === "motorista" && (
                <>
                  <div className="driver-profile-overview">
                    <div>
                      <Truck size={19} />
                      <span><strong>Meu veículo</strong><small>{driver.vehicle || "Não informado"}</small></span>
                    </div>
                    <div>
                      <ShieldCheck size={19} />
                      <span><strong>Situação da conta</strong>
                        <small className={state.user.verified ? "driver-profile-approved" : "driver-profile-pending"}>
                          {state.user.verified ? "Verificada" : "Verificação pendente"}
                        </small>
                      </span>
                    </div>
                  </div>
                  <details className="driver-profile-documents">
                    <summary>
                      <FileCheck2 size={20}/>
                      <span><strong>Documentos e verificação</strong>
                        <small>{state.user.verified
                          ? "Consultar ou atualizar documentos"
                          : "Abrir para enviar documentos e acompanhar a análise"}</small>
                      </span>
                      <ChevronRight size={19} className="driver-profile-disclosure-arrow"/>
                    </summary>
                    <PhoneVerificationPanel onVerified={refresh}/>
                    <DriverVerificationPanel
                      driverId={user.id} role="motorista"
                      onChange={refresh}
                    />
                  </details>
                </>
              )}
              {["cliente", "motorista", "master"].includes(area) && (
                <details className="profile-push-settings">
                  <summary><BellRing size={18}/> Notificações do aparelho</summary>
                  <PushNotificationsPanel role={area} accountId={user.id}/>
                </details>
              )}
              {area !== "master" && (
                <button type="button" className="fretinho-help-button" onClick={() => setModal({ type: "help" })} aria-label="Abrir Central de Ajuda FreteOn">
                  <img src="/assets/fretinho-ajuda.svg" alt="" width="56" height="56" />
                  <span><strong>Precisa de ajuda?</strong><small>Fale com o Fretinho · Central de Ajuda</small></span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              )}
              <button className="secondary" onClick={logout}>
                Sair da conta
              </button>
            </section>
          ) : area === "master" && page === "campanhas" && masterOwner ? (
            <CampaignManager />
          ) : area === "master" && page === "notificacoes" ? (
            <MasterNotifications notifications={masterNotifications} accountId={user.id} onNavigate={setPage}/>
          ) : area === "master" && page === "comissoes" ? (
            <CommissionSettings readOnly={!masterOwner}/>
          ) : area === "master" && page === "equipe" && masterOwner ? (
             <TeamManagement />
           ) : area === "master" && page === "auditoria" ? (
             <TeamManagement auditOnly />
           ) : area === "master" && page === "privacidade" ? (
            <PrivacyMaster />
          ) : area === "master" && page === "central-ajuda" ? (
            <HelpCenter role="master" />
          ) : area === "master" && page === "verificacao-telefone" && masterOwner ? (
            <PhoneVerificationMaster />
          ) : area === "master" && page === "recuperacao" ? (
            <RecoveryMaster />
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
            <MasterFreightReports />
          ) : (
            <section>
              <div className="section-heading">
                <h2>
                  {page === "historico"
                    ? "Fretes concluídos"
                    : area === "motorista" && page === "propostas"
                      ? "Minhas propostas"
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
                  {(area === "cliente" ? [
                    ["all", "Em andamento"],
                    ["open", "Aguardando propostas"],
                    ["booked", "Contratados"],
                    ["transit", "Em transporte"],
                    ["cancelled", "Cancelados"],
                  ] : [
                    ["all", "Todos"],
                    ["open", "Propostas"],
                    ["booked", "Contratados"],
                    ["transit", "Em transporte"],
                    ["completed", "Concluídos"],
                    ["cancelled", "Cancelados"],
                  ]).map(([key, label]) => (
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
              {area === "motorista" && page === "propostas" && (
                <div className="driver-proposal-filters" role="group" aria-label="Filtrar propostas enviadas">
                  <button type="button" className={driverProposalView === "pending" ? "active" : ""}
                    aria-pressed={driverProposalView === "pending"}
                    onClick={() => setDriverProposalView("pending")}>
                    Aguardando resposta <span>{proposalPending.length}</span>
                  </button>
                  <button type="button" className={driverProposalView === "closed" ? "active" : ""}
                    aria-pressed={driverProposalView === "closed"}
                    onClick={() => setDriverProposalView("closed")}>
                    Encerradas <span>{proposalClosed.length}</span>
                  </button>
                </div>
              )}
              {area === "motorista" && page === "inicio" ? <>
                <FreightCarousel requests={requests.filter(request => request.status === "open")} renderCard={requestCard}/>
                {!requests.some(request => request.status === "open") && <Empty title="Nenhum chamado disponível">Novos pedidos aparecerão aqui assim que forem publicados.</Empty>}
                {requests.some(request => request.status !== "open") && <>
                  <div className="section-heading"><h2>Seus fretes contratados</h2></div>
                  <div className="cards">{requests.filter(request => request.status !== "open").map(request => requestCard(request))}</div>
                </>}
              </> : area === "motorista" && page === "propostas" ? (
                <div className="driver-history-carousel">
                  <FreightCarousel
                    key={`motorista-propostas-${driverProposalView}`}
                    requests={[...requests].sort((a, b) =>
                      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())}
                    renderCard={driverProposalCard}
                    ariaLabel={driverProposalView === "pending" ? "Propostas aguardando resposta" : "Propostas encerradas"}
                    itemName="frete"
                  />
                </div>
              ) : area === "motorista" && page === "historico" ? (
                <div className="driver-history-carousel">
                  <FreightCarousel
                    requests={[...requests].sort((a, b) =>
                      new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime() -
                      new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime())}
                    renderCard={driverHistoryCard}
                    ariaLabel="Histórico de fretes do motorista"
                    itemName="frete"
                  />
                </div>
              ) : area === "cliente" && ["fretes", "historico"].includes(page) ? (
                <div className="client-freights-carousel">
                  <FreightCarousel
                    key={`cliente-${page}-${filter}`}
                    requests={[...requests].sort((a, b) =>
                      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())}
                    renderCard={clientFreightCard}
                    ariaLabel={page === "historico" ? "Histórico de fretes do cliente" : "Meus fretes"}
                    itemName="frete"
                  />
                </div>
              ) : <div className="cards">{requests.map(request => requestCard(request))}</div>}
              {!requests.length && !(area === "motorista" && page === "inicio") && (
                <Empty title={area === "motorista" && page === "propostas"
                  ? driverProposalView === "pending" ? "Nenhuma proposta aguardando" : "Nenhuma proposta encerrada"
                  : area === "motorista" && page === "historico" ? "Nenhum frete concluído"
                  : area === "cliente" && page === "historico"
                  ? "Nenhum frete concluído"
                  : area === "cliente" && page === "fretes" && filter === "cancelled"
                    ? "Nenhum frete cancelado"
                    : area === "cliente" && page === "fretes"
                      ? "Nenhum frete nesta situação"
                      : "Nenhum frete por aqui"}>
                  {area === "motorista" && page === "propostas"
                    ? driverProposalView === "pending"
                      ? "As propostas enviadas a pedidos abertos aparecerão aqui."
                      : "Ofertas não escolhidas e pedidos cancelados aparecerão aqui."
                    : area === "motorista" && page === "historico"
                      ? "Seus fretes concluídos aparecerão aqui."
                      : area === "cliente" && page === "historico"
                        ? "Os fretes finalizados aparecerão aqui."
                    : area === "cliente" && page === "fretes"
                      ? "Consulte as outras situações ou solicite um novo frete."
                      : "Novos pedidos e atualizações aparecerão nesta área."}
                </Empty>
              )}
            </section>
          )}
          {area === "master" && (
            <footer className="dashboard-footer-compact">
              <span>© {new Date().getFullYear()} FreteOn · Grupo Rubli</span>
              <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
              <a href="/privacidade" target="_blank" rel="noopener noreferrer">Privacidade</a>
            </footer>
          )}
        </main>
        {area !== "master" && <nav className="mobile-nav" aria-label="Navegação principal">
          {menu.map(([key, label, Icon]) => (
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
        </nav>}
      </div>
      {area === "master" && <div className={`master-drawer-layer${masterMenuOpen ? " open" : ""}`} aria-hidden={!masterMenuOpen}>
        <button type="button" className="master-drawer-backdrop" aria-label="Fechar menu" tabIndex={masterMenuOpen ? 0 : -1} onClick={() => setMasterMenuOpen(false)} />
        <aside id="master-mobile-drawer" className="master-mobile-drawer" aria-label="Menu administrativo" inert={!masterMenuOpen}>
          <div className="master-drawer-heading"><strong>Menu Master</strong><button type="button" aria-label="Fechar menu" onClick={() => setMasterMenuOpen(false)}><X size={23}/></button></div>
          <nav>{navigation.master.map(([key, label, Icon]) => <button type="button" key={key} className={page === key ? "selected" : ""} onClick={() => { setPage(key); setFilter("all"); setMasterMenuOpen(false); }}><Icon size={21}/><span>{label}</span>{((key === "motoristas" && pending.length > 0) || (key === "recuperacao" && recoveryPending > 0) || (key === "notificacoes" && masterNotifications.unread > 0)) && <span className="master-drawer-count">{key === "recuperacao" ? recoveryPending : key === "notificacoes" ? masterNotifications.unread : pending.length}</span>}</button>)}</nav>
        </aside>
      </div>}
      {modal?.type === "create" && (
        <RequestForm
          requestError={notice}
          onCreate={createRequest}
          userId={user.id}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "driverBooking" && selected && area === "motorista" &&
        selected.driverId === user.id && (
        <Modal
          title={selected.title}
          error={notice}
          busy={busy}
          onClose={() => setModal(null)}
        >
          <DriverContractCompact
            key={selected.id}
            request={selected}
            currentUserId={user.id}
            busy={busy}
            testFlowEnabled={state.paymentGateway?.testFlowEnabled}
            onPhoto={(index) => setModal({ type: "photo", id: selected.id, index, returnTo: "driverBooking" })}
            onReport={() => setModal({ type: "report", id: selected.id })}
            onFinanceAction={walletAction}
            onAdvance={async () => {
              if (await updateRequest(selected.id, { status: selected.status === "booked" ? "transit" : "completed" })) {
                setModal(null);
                setNotice(selected.status === "booked" ? "Transporte iniciado!" : "Frete concluído!");
              }
            }}
          />
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
          <RefundPanel request={selected} role={area} busy={busy} onAction={walletAction} canManage={masterOwner || user.adminPermissions?.includes("finance.refund")}/>
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
              selected.disputeStatus === "none" && !refundBlocked(selected) && (
              <div className="completion-actions">
                <h3>Confirme a entrega</h3>
                <p>
                  {selected.paymentMethod === "pix_freteon"
                    ? ["paid_mp", "paid_pagbank"].includes(selected.paymentStatus)
                      ? "Confirme que recebeu sua carga corretamente. O Pix foi confirmado pelo banco."
                      : "Confirme sua entrega somente após verificar que o pagamento consta como aprovado no FreteOn."
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
              !selected.rating && selected.disputeStatus !== "open" && !refundBlocked(selected) && (
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
          {area === "motorista" && selected.driverId === user.id &&
           ["booked", "transit"].includes(selected.status) ? (
            <DriverContractCompact
              key={selected.id}
              request={selected}
              currentUserId={user.id}
              busy={busy}
              onPhoto={(index) => setModal({ type: "photo", id: selected.id, index, returnTo: "detail" })}
              onReport={() => setModal({ type: "report", id: selected.id })}
              onFinanceAction={walletAction}
              onAdvance={async () => {
                if (await updateRequest(selected.id, { status: selected.status === "booked" ? "transit" : "completed" })) {
                  setModal(null);
                  setNotice(selected.status === "booked" ? "Transporte iniciado!" : "Frete concluído!");
                }
              }}
            />
          ) : area === "motorista" && selected.status === "open" ? (
            <DriverOpenFreightProposal
              key={selected.id}
              request={selected}
              driverId={user.id}
              commissionRate={commissionRate}
              available={
                state.user.verified &&
                !state.wallet?.blocked &&
                (selected.paymentMethod !== "card_driver" || state.user.acceptsCard) &&
                !busy
              }
              onReport={() => setModal({ type: "report", id: selected.id })}
              onSubmit={(proposal) =>
                mutate(`/requests/${selected.id}/proposals`, "POST", proposal, () => {
                  setModal(null);
                  setNotice("Proposta enviada ao cliente.");
                })
              }
            />
          ) : area === "cliente" && selected.status === "booked" &&
              selected.paymentMethod === "pix_freteon" ? (
            <ClientPixCheckoutCompact
              key={selected.id}
              request={selected}
              currentUserId={user.id}
              drivers={state.drivers}
              gateway={state.paymentGateway}
              busy={busy}
              onPaid={refresh}
              onFinanceAction={walletAction}
              onPhoto={index => setModal({ type: "photo", id: selected.id, index, returnTo: "detail" })}
              onReport={() => setModal({ type: "report", id: selected.id })}
              onCancel={() => setModal({ type: "cancel", id: selected.id })}
            />
          ) : (
            <>
          <span className={`status ${selected.status}`}>
            {statusLabels[selected.status]}
          </span>
          <Route request={selected} />
          <RefundPanel key={`refund-${selected.id}`} request={selected} role={area} busy={busy} onAction={walletAction} canManage={masterOwner || user.adminPermissions?.includes("finance.refund")}/>
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
                    rate={selected.commissionRate}
                    method={selected.paymentMethod}
                  />
                )
              )}
              {selected.paymentMethod === "pix_freteon" && (
                <p className="muted">O Pix será pago à conta FreteOn pelo banco selecionado, depois da contratação. A coleta aguarda confirmação bancária.</p>
              )}
              {selected.paymentMethod === "card_driver" && (
                <p className="muted">O cliente pagará na maquininha do motorista. A taxa bancária deve estar considerada no preço da proposta.</p>
              )}
              {selected.paymentMethod === "cash_driver" && (
                <p className="muted">Pagamento em dinheiro diretamente ao motorista ao final do serviço.</p>
              )}
            </div>
          )}
          <RouteDistance request={selected} busy={busy} />
          <p>{selected.description}</p>
          <p className="muted">
            {selected.vehicle ? `${selected.vehicle} · ` : "Tipo de veículo a combinar · "}
            {selected.helper ? "Com ajudante" : "Sem ajudante"} ·{" "}
            {selected.time}
          </p>
          {area === "cliente" && ["open", "booked"].includes(selected.status) && !selected.proposals?.length ? (
            <FreightPhotoPicker
              photos={selected.photos || []}
              busy={busy}
              onAdd={(photos) => addFreightPhotos(selected.id, photos)}
              onRemove={(index) => removeFreightPhoto(selected.id, index)}
            />
          ) : area === "cliente" && selected.proposals?.length ? (
            selected.photos?.length > 0 ? (
              <details className="freight-gallery freight-gallery-collapsible">
                <summary><Camera size={17}/> Ver fotos já enviadas ({selected.photos.length})</summary>
                <div className="freight-gallery-images">
                  {selected.photos.map((photo, i) => (
                    <button type="button" key={i} onClick={() =>
                      setModal({ type: "photo", id: selected.id, index: i })}>
                      <FreightPhotoImage src={photo} alt={`Abrir foto ${i + 1} da carga`} />
                    </button>
                  ))}
                </div>
              </details>
            ) : null
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
              focusOnOpen={modal.focusProposal}
              key={selected.id}
              request={selected}
              available={
                state.user.verified &&
                !state.wallet?.blocked &&
                (selected.paymentMethod !== "card_driver" || state.user.acceptsCard) &&
                !busy
              }
              driverId={user.id}
              commissionRate={commissionRate}
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
                {area === "motorista"
                  ? selected.status === "cancelled" ? "Minha proposta · pedido cancelado"
                    : selected.driverId !== user.id ? "Minha proposta · não selecionada"
                    : "Minha proposta"
                  : selected.status === "open" ? "Compare as propostas" : "Proposta escolhida"}
              </h3>
              {selected.proposals
                .filter(
                  (proposal) =>
                    area === "motorista"
                      ? proposal.driverId === user.id
                      : selected.status === "open" || proposal.id === selected.selectedId,
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
                  Aguardando propostas de motoristas verificados.
                </p>
              )}
            </>
          )}
          {["booked", "transit"].includes(selected.status) &&
            ((area === "cliente" && selected.clientId === user.id) ||
             (area === "motorista" && selected.driverId === user.id)) && (
              <FreightChatPanel requestId={selected.id} currentUserId={user.id}
                onReport={() => setModal({ type: "report", id: selected.id })} />
            )}
          {area === "cliente" && selected.status === "open" && selected.proposals.length > 0 && (
            <button type="button" className="secondary full"
              onClick={() => setModal({ type: "report", id: selected.id })}>
              <Flag size={16}/> Denunciar tentativa de negociação por fora
            </button>
          )}
          {area === "motorista" && selected.status === "open" &&
            selected.proposals.some(p => p.driverId === user.id) && (
            <button type="button" className="secondary full"
              onClick={() => setModal({ type: "report", id: selected.id })}>
              <Flag size={16}/> Denunciar problema neste pedido
            </button>
          )}
          {area === "motorista" &&
            selected.proposals.find(
              (proposal) => proposal.id === selected.selectedId,
            )?.driverId === user.id &&
            ["booked", "transit"].includes(selected.status) && !refundBlocked(selected) && (
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
              <MercadoPagoPix key={selected.id} requestId={selected.id}
                kind="freight" gateway={state.paymentGateway} onPaid={refresh}/>
          )}
          {area === "cliente" && selected.paymentMethod === "pix_freteon" &&
            Boolean(selected.pagbankTestApprovedAt) && selected.paymentProviderEnvironment === "sandbox" && (
              <p className="info">Pix de teste aprovado no PagBank. O motorista pode realizar o fluxo de homologação; não há repasse bancário real.</p>
            )}
          {area === "cliente" && selected.paymentMethod === "pix_freteon" &&
            ["paid_mp", "paid_pagbank"].includes(selected.paymentStatus) && (
              <p className="info">Pix do frete confirmado pelo banco responsável.</p>
          )}
          {area === "cliente" && selected.status === "completed" &&
            selected.paymentMethod && !selected.deliveryConfirmedAt &&
            selected.disputeStatus === "none" && !refundBlocked(selected) && (
            <div className="finance-action">
              <h3>Confirmação da entrega e do pagamento</h3>
              <p>O motorista marcou este frete como concluído. Confirme somente após verificar a entrega
              {selected.paymentMethod !== "pix_freteon" ? " e efetuar o pagamento diretamente ao motorista." : "."}</p>
              <button className="primary full" disabled={busy || refundBlocked(selected)}
                onClick={() => walletAction(selected.id, "confirm_delivery")}>
                Confirmar entrega {selected.paymentMethod === "pix_freteon" ? "" : "e pagamento"}
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
            ["open", "booked"].includes(selected.status) && !refundBlocked(selected) &&
            !(selected.paymentMethod === "pix_freteon" && ["simulated_paid", "paid_mp", "paid_pagbank"].includes(selected.paymentStatus)) && (
              <button
                className="danger-link"
                onClick={() => setModal({ type: "cancel", id: selected.id })}
              >
                Cancelar pedido
              </button>
            )}
            </>
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
                ? "Após contratar o motorista, você deverá pagar o Pix gerado pelo FreteOn. O transporte começa após confirmação do banco."
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
      {modal?.type === "report" && selected && ["cliente", "motorista"].includes(area) && (
        <Modal title="Denunciar ocorrência" busy={busy}
          onClose={() => setModal({ type: "detail", id: selected.id })}>
          <ReportFreightForm request={selected} role={area} currentId={user.id}
            onDone={() => {
              setModal({ type: "detail", id: selected.id });
              setNotice("Denúncia enviada para análise do Master.");
            }} />
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
          <p>O pedido será encerrado e deixará de receber propostas. Cancelamentos após a contratação serão registrados para análise administrativa.</p>
          <form onSubmit={async event => {
            event.preventDefault();
            const reason = new FormData(event.currentTarget).get("cancelReason");
            if (await updateRequest(selected.id, { status: "cancelled", cancelReason: reason }))
              setModal(null);
          }}>
            <label>Motivo do cancelamento
              <select name="cancelReason" required defaultValue="">
                <option value="" disabled>Selecione um motivo</option>
                <option value="Não preciso mais do transporte">Não preciso mais do transporte</option>
                <option value="Alteração de data ou endereço">Alteração de data ou endereço</option>
                <option value="Não consegui concluir com o motorista">Não consegui concluir com o motorista</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
            </label>
            <button type="submit" className="primary full">Confirmar cancelamento</button>
          </form>
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
      {modal?.type === "notifications" && area !== "master" && (
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
        <Modal title="Central de Ajuda FreteOn" onClose={() => setModal(null)}>
          <HelpCenter role={area} onClose={() => setModal(null)}/>
        </Modal>
      )}
      {(
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

function ProposalForm({ request, available, driverId, onSubmit, commissionRate = 10 }) {
  const previous = request.proposals?.find(proposal => proposal.driverId === driverId);
  const [proposedPrice, setProposedPrice] = useState(String(previous?.price || ""));
  const services = [
    ["helper", "Ajudante incluso"],
    ["blanket", "Proteção com mantas"],
    ["disassembly", "Desmontagem e montagem"],
    ["stairs", "Retirada/entrega em escadas"],
    ["loading", "Carregamento e descarregamento"],
    ["tieDown", "Amarração e fixação da carga"],
  ];
  const feeNote = request.paymentMethod === "card_driver"
    ? `O cliente paga na sua maquininha. Considere as taxas bancárias no preço e repasse ${commissionRate}% ao FreteOn em até 72h após a confirmação do pagamento.`
    : request.paymentMethod === "cash_driver"
      ? `O cliente paga em dinheiro ao motorista. A comissão de ${commissionRate}% é repassada ao FreteOn em até 72h após a confirmação do pagamento.`
      : request.paymentMethod === "pix_freteon"
        ? "O Pix é recebido pelo FreteOn após confirmação bancária. Depois da entrega, solicite o repasse na carteira."
        : "Confirme a forma de pagamento com as informações deste pedido.";
  return (
    <form className="driver-proposal-form" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onSubmit({
        price: Number(data.get("price")),
        time: data.get("time"),
        services: data.getAll("services"),
      });
    }}>
      <header className="driver-proposal-form-header">
        <h3>{previous ? "Atualizar minha proposta" : "Enviar minha proposta"}</h3>
        <p>Informe o valor total do transporte e o horário de retirada.</p>
      </header>
      <div className="driver-proposal-main-fields">
        <label className="driver-proposal-price-field">
          Seu preço total (R$)
          <input type="number" name="price" inputMode="decimal" required min="1" max="100000"
            step="0.01" value={proposedPrice} onChange={event => setProposedPrice(event.target.value)}
            placeholder="0,00"/>
        </label>
        <label className="driver-proposal-time-field">
          Horário de retirada
          <input type="time" name="time" required defaultValue={previous?.time || request.time}/>
        </label>
      </div>
      <p className="driver-proposal-payment-note">{feeNote}</p>
      <fieldset className="proposal-services">
        <legend>Serviços incluídos no valor</legend>
        <p className="muted">Marque somente os serviços que você realmente fornecerá. O preço deve incluir os serviços selecionados.</p>
        <div className="driver-proposal-services-grid">
          {services.map(([key, label]) => (
            <label key={key} className="proposal-service-option">
              <input type="checkbox" name="services" value={key}
                defaultChecked={previous?.services?.includes(key)}/>
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <CommissionPreview price={proposedPrice} method={request.paymentMethod} rate={commissionRate}/>
      <div className="driver-proposal-submit">
        <button type="submit" className="primary full" disabled={!available}>
          {available ? previous ? "Atualizar proposta" : "Enviar proposta" : "Verifique seus documentos, carteira e meios de pagamento"}
          <ArrowRight size={18}/>
        </button>
      </div>
    </form>
  );
}
