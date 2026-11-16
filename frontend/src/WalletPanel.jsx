import RefundPanel, { refundBlocked } from "./RefundPanel.jsx";
import MercadoPagoPix from "./MercadoPagoPix.jsx";
import PaymentProviderAdmin from "./PaymentProviderAdmin.jsx";
import { useEffect, useState } from "react";
import { AlertCircle, Banknote, CheckCircle2, Clock3, CreditCard, QrCode, Wallet, ChevronDown, ChevronRight } from "lucide-react";
import { money } from "./format.js";

export const paymentLabels = {
  pix_freteon: "Pix pelo FreteOn",
  card_driver: "Cartão na maquininha",
  cash_driver: "Dinheiro ao motorista",
};

const byCents = (value) => money((value || 0) / 100);
const percentAmount = (price, rate = 10) => Math.round(Math.round(Number(price || 0) * 100) * rate / 100);
const paymentIcon = {
  pix_freteon: QrCode,
  card_driver: CreditCard,
  cash_driver: Banknote,
};

export function PaymentLabel({ method }) {
  const Icon = paymentIcon[method];
  if (!Icon) return <span className="payment-tag muted">Pagamento não definido (pedido antigo)</span>;
  return (
    <span className="payment-tag"><Icon size={16} aria-hidden="true" /> {paymentLabels[method]}</span>
  );
}

export function CommissionPreview({ price, method, rate = 10 }) {
  const grossCents = Math.round(Number(price || 0) * 100);
  if (!Number.isFinite(grossCents) || grossCents <= 0) return null;
  const commissionCents = percentAmount(price, rate);
  return (
    <div className="commission-preview">
      <div><span>Valor total proposto</span><strong>{byCents(grossCents)}</strong></div>
      <div><span>Comissão FreteOn ({rate}%)</span><strong>− {byCents(commissionCents)}</strong></div>
      <div><span>Motorista após comissão</span><strong>{byCents(grossCents - commissionCents)}</strong></div>
      {method === "card_driver" && <small>Não inclui as taxas da sua maquininha. Considere-as ao propor o preço.</small>}
      {method === "pix_freteon" && <small>Repasse Pix manual após a entrega confirmada, somente em simulação.</small>}
    </div>
  );
}

function StatusText({ request }) {
  const state = request.disputeStatus;
  if (state === "open") return <span className="wallet-status warning">Em contestação — sem bloqueio automático</span>;
  if (state === "resolved_cancelled") return <span className="wallet-status">Cancelado pela administração</span>;
  if (request.paymentMethod === "pix_freteon") {
    if (request.paymentStatus === "refunded_simulated") return <span className="wallet-status">Reembolso simulado</span>;
    if (request.paymentStatus === "refunded_mp") return <span className="wallet-status success">Reembolso confirmado pelo Mercado Pago</span>;
    if (request.paymentStatus === "refunded_pagbank") return <span className="wallet-status success">Reembolso confirmado pelo PagBank</span>;
    if (request.paymentStatus === "awaiting") return <span className="wallet-status warning">Aguardando Pix do cliente</span>;
    if (request.payoutStatus === "paid_simulated") return <span className="wallet-status success">Repasse simulado concluído</span>;
    if (request.payoutStatus === "paid_manual") return <span className="wallet-status success">Repasse manual registrado</span>;
    if (request.payoutStatus === "requested") return <span className="wallet-status warning">Solicitação em análise pelo Master</span>;
    if (request.payoutStatus === "available") return <span className="wallet-status success">Repasse disponível para solicitar</span>;
    return <span className="wallet-status">Aguardando conclusão e confirmação do cliente</span>;
  }
  if (request.commissionStatus === "paid") return <span className="wallet-status success">Comissão quitada</span>;
  if (request.commissionStatus === "waived") return <span className="wallet-status">Comissão dispensada</span>;
  if (request.commissionStatus === "pending") {
    const overdue = request.commissionDueAt && new Date(request.commissionDueAt).getTime() <= Date.now();
    return <span className={overdue ? "wallet-status warning" : "wallet-status"}>{overdue ? "Comissão vencida" : "Comissão a repassar"}</span>;
  }
  return <span className="wallet-status">Aguardando conclusão e confirmação do cliente</span>;
}


// A carteira do motorista distingue pendências financeiras, fretes em curso e histórico já encerrado.
// O status de execução "completed" não significa que a comissão ou o repasse foi quitado.
export function driverWalletBucket(request) {
  if (["pending", "approved"].includes(request.refundStatus) ||
      request.disputeStatus === "open" ||
      request.commissionStatus === "pending" ||
      ["available", "requested"].includes(request.payoutStatus)) return "pending";
  if (["booked", "transit"].includes(request.status)) return "active";
  if (request.status === "completed" && !request.deliveryConfirmedAt &&
      request.commissionStatus !== "paid" && request.commissionStatus !== "waived" &&
      request.payoutStatus !== "paid_simulated" &&
      request.paymentStatus !== "refunded_simulated" &&
      request.disputeStatus !== "resolved_cancelled") return "pending";
  return "history";
}
const driverTabLabels = {
  pending: { label: "Pendências", subtitle: "Comissões e repasses que ainda exigem acompanhamento." },
  active: { label: "Em andamento", subtitle: "Fretes contratados ou em transporte." },
  history: { label: "Histórico", subtitle: "Fretes encerrados e sem pendências financeiras." }
};
function driverEntryLabel(request) {
  if (["pending", "approved"].includes(request.refundStatus)) return "Reembolso em análise";
  if (request.disputeStatus === "open") return "Em contestação";
  if (request.commissionStatus === "pending") return request.commissionPaymentRequestedAt ? "Comissão informada ao Master" : "Comissão a repassar";
  if (request.payoutStatus === "available") return "Repasse Pix disponível";
  if (request.payoutStatus === "requested") return "Repasse solicitado";
  if (request.status === "booked") return "Frete contratado";
  if (request.status === "transit") return "Em transporte";
  if (request.status === "completed" && !request.deliveryConfirmedAt) return "Aguardando confirmação da entrega";
  if (request.commissionStatus === "paid") return "Comissão quitada";
  if (request.commissionStatus === "waived") return "Comissão dispensada";
  if (["paid_simulated", "paid_manual"].includes(request.payoutStatus)) return "Repasse concluído";
  if (request.status === "cancelled") return "Cancelado";
  return "Concluído";
}


// Organização administrativa: as abas são visões de consulta sobre os mesmos fretes.
// Nenhum status financeiro é alterado pelo filtro; todas as ações existentes ficam no detalhe.
const masterTabLabels = {
  pending: { label: "Pendências", subtitle: "Operações que aguardam análise ou confirmação do Master." },
  commissions: { label: "Comissões", subtitle: "Comissões dos fretes pagos em dinheiro ou na maquininha." },
  payouts: { label: "Repasses", subtitle: "Repasses Pix disponíveis, solicitados ou concluídos." },
  refunds: { label: "Reembolsos", subtitle: "Solicitações de reembolso e contestações, abertas ou resolvidas." },
  history: { label: "Histórico", subtitle: "Fretes encerrados com situação financeira resolvida." },
  all: { label: "Todos", subtitle: "Consulta completa dos fretes com modalidade financeira registrada." },
};
const refundCases = request =>
  Boolean(request.refundStatus && request.refundStatus !== "none") ||
  Boolean(request.disputeStatus && request.disputeStatus !== "none");

export function masterFinancialAction(request) {
  if (["pending", "approved"].includes(request.refundStatus)) return true;
  if (request.disputeStatus === "open") return true;
  if (refundBlocked(request) || request.disputeStatus === "resolved_cancelled") return false;
  if (request.payoutStatus === "requested" || request.commissionStatus === "pending") return true;
  return request.status === "completed" && !request.deliveryConfirmedAt &&
    request.disputeStatus !== "resolved_cancelled" &&
    (request.paymentMethod !== "pix_freteon" || ["simulated_paid", "paid_mp", "paid_pagbank"].includes(request.paymentStatus));
}
function masterSettled(request) {
  if (masterFinancialAction(request) || !["completed", "cancelled"].includes(request.status)) return false;
  if (["pending", "approved"].includes(request.refundStatus)) return false;
  if (request.payoutStatus === "available" || request.payoutStatus === "requested") return false;
  return ["refunded_simulated", "refunded_mp", "refunded_pagbank"].includes(request.refundStatus) ||
    request.disputeStatus === "resolved_cancelled" ||
    ["paid", "waived"].includes(request.commissionStatus) ||
    ["paid_simulated", "paid_manual"].includes(request.payoutStatus);
}
export function masterFinancialBucket(request, tab) {
  if (tab === "pending") return masterFinancialAction(request);
  if (tab === "commissions") return ["cash_driver", "card_driver"].includes(request.paymentMethod) &&
    Number(request.commissionCents || 0) > 0;
  if (tab === "payouts") return request.paymentMethod === "pix_freteon" &&
    ["available", "requested", "paid_simulated", "paid_manual"].includes(request.payoutStatus);
  if (tab === "refunds") return refundCases(request);
  if (tab === "history") return masterSettled(request);
  return tab === "all";
}
function masterFinanceLabel(request) {
  if (request.refundStatus === "pending") return "Reembolso aguardando análise";
  if (request.refundStatus === "approved") return "Reembolso aprovado · aguarda devolução";
  if (request.disputeStatus === "open") return "Contestação aguardando decisão";
  if (request.payoutStatus === "requested") return "Repasse solicitado · confirmar";
  if (request.commissionStatus === "pending")
    return request.commissionPaymentRequestedAt ? "Motorista informou comissão · conferir" :
      request.commissionDueAt && new Date(request.commissionDueAt).getTime() <= Date.now()
        ? "Comissão vencida" : "Comissão a receber";
  if (request.status === "completed" && !request.deliveryConfirmedAt) return "Entrega aguardando confirmação";
  if (request.refundStatus === "refunded_simulated") return "Devolução registrada (simulação)";
  if (request.refundStatus === "refunded_mp") return "Devolução confirmada pelo Mercado Pago";
  if (request.refundStatus === "refunded_pagbank") return "Devolução confirmada pelo PagBank";
  if (request.refundStatus === "rejected") return "Reembolso recusado";
  if (request.disputeStatus === "resolved_cancelled") return "Contestação encerrada · valores dispensados";
  if (request.payoutStatus === "available") return "Repasse disponível para motorista solicitar";
  if (request.payoutStatus === "paid_simulated") return "Repasse concluído (simulação)";
  if (request.payoutStatus === "paid_manual") return "Repasse manual realizado";
  if (request.commissionStatus === "paid") return "Comissão quitada (simulação)";
  if (request.commissionStatus === "waived") return "Comissão dispensada";
  return driverEntryLabel(request);
}
function masterFinanceAmount(request, tab) {
  if (tab === "commissions") return request.commissionCents;
  if (tab === "payouts") return request.driverNetCents;
  if (tab === "refunds" && request.refundStatus && request.refundStatus !== "none")
    return request.refundAmountCents;
  if (request.refundStatus === "pending" || request.refundStatus === "approved")
    return request.refundAmountCents;
  if (request.payoutStatus === "requested") return request.driverNetCents;
  if (request.commissionStatus === "pending") return request.commissionCents;
  return request.agreedPriceCents;
}

function FreightFinanceRow({ request, role, drivers, busy, onAction, compact = false, masterTab = "pending", mpEnabled = false, gateway, onPaid }) {
  const [expanded, setExpanded] = useState(false);
  const [payoutReference, setPayoutReference] = useState("");
  const driver = drivers.find((person) => person.id === request.driverId);
  const isDriver = role === "motorista";
  const isMaster = role === "master";
  const amount = request.agreedPriceCents;
  const due = request.commissionDueAt
    ? new Date(request.commissionDueAt).toLocaleString("pt-BR", { timeZone: "America/Porto_Velho", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <article className={`wallet-item${compact ? " wallet-item-compact" : ""}${isMaster ? " wallet-master-item" : ""}`}>
      {compact && (
        <button type="button" className="wallet-row-toggle" aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}>
          <span className="wallet-row-main">
            <strong>{request.title}</strong>
            <small>{isMaster ? masterFinanceLabel(request) : driverEntryLabel(request)}</small>
            {isMaster && <small>Motorista: {driver?.name || "Cadastro não encontrado"}</small>}
            {request.commissionStatus === "pending" && (
              <small className="wallet-row-commission">Comissão: {byCents(request.commissionCents)}</small>
            )}
          </span>
          <span className="wallet-row-side">
            <strong>{byCents(isMaster ? masterFinanceAmount(request, masterTab) : amount)}</strong>
            <ChevronDown size={19} className={expanded ? "wallet-row-open" : ""} />
          </span>
        </button>
      )}
      {(!compact || expanded) && <>
      {compact ? (
        <p className="wallet-row-address">{request.origin} → {request.destination}</p>
      ) : (
        <div className="wallet-item-heading">
          <div>
            <strong>{request.title}</strong>
            <small>{request.origin} → {request.destination}</small>
            {isMaster && <small>Motorista: {driver?.name || "Cadastro não encontrado"}</small>}
          </div>
          <strong>{byCents(amount)}</strong>
        </div>
      )}
      <PaymentLabel method={request.paymentMethod} />
      <RefundPanel request={request} role={role} busy={busy} onAction={onAction} />
      {!refundBlocked(request) && <StatusText request={request} />}
      <div className="wallet-item-values">
        <span>Comissão: <strong>{byCents(request.commissionCents)}</strong></span>
        <span>Motorista: <strong>{byCents(request.driverNetCents)}</strong></span>
      </div>
      {request.commissionStatus === "pending" && due && (
        <p className="wallet-due"><Clock3 size={15} /> Vencimento: {due} (Porto Velho)</p>
      )}
      {request.commissionPaymentRequestedAt && request.commissionStatus === "pending" && (
        <p className="wallet-note">Motorista informou pagamento simulado. Aguardando confirmação do Master.</p>
      )}
      {request.disputeStatus === "open" && (
        <p className="wallet-note"><AlertCircle size={15} /> Reclamação: {request.disputeReason}</p>
      )}
      {isDriver && !refundBlocked(request) && request.payoutStatus === "available" && (
        <button className="primary full" disabled={busy} onClick={() => onAction(request.id, "request_payout")}>
          Solicitar repasse Pix manual (simulação)
        </button>
      )}
      {isDriver && request.commissionStatus === "pending" && request.disputeStatus !== "open" &&
        !refundBlocked(request) && (mpEnabled ? (
          <MercadoPagoPix requestId={request.id} kind="commission" gateway={gateway} onPaid={onPaid}/>
        ) : (
          <button className="secondary full" disabled={busy || Boolean(request.commissionPaymentRequestedAt)}
            onClick={() => onAction(request.id, "notify_commission")}>
            {request.commissionPaymentRequestedAt ? "Pagamento informado ao Master" : "Informar comissão enviada (simulação)"}
          </button>
        ))}
      
      {isMaster && !refundBlocked(request) && request.status === "completed" &&
        !request.deliveryConfirmedAt && request.disputeStatus !== "open" &&
        request.disputeStatus !== "resolved_cancelled" &&
        (request.paymentMethod !== "pix_freteon" || request.paymentStatus === "simulated_paid") && (
          <button className="secondary full" disabled={busy}
            onClick={() => onAction(request.id, "confirm_delivery_master")}>
            Confirmar entrega após análise (simulação)
          </button>
      )}
      {isMaster && !refundBlocked(request) && request.commissionStatus === "pending" &&
        request.disputeStatus !== "open" && (
          mpEnabled ? (
            <p className="wallet-note">A comissão será quitada somente após confirmação do Pix pelo banco responsável.</p>
          ) : request.commissionPaymentRequestedAt ? (
            <button className="primary full" disabled={busy}
              onClick={() => onAction(request.id, "confirm_commission_master")}>
              Confirmar quitação informada (simulação)
            </button>
          ) : (
            <p className="wallet-note">Aguardando o motorista informar o pagamento da comissão.</p>
          )
        )}
      {isMaster && !refundBlocked(request) && request.payoutStatus === "requested" && request.disputeStatus !== "open" && (
        <div className="wallet-transfer">
          <p>Chave Pix do motorista: <strong className="wallet-pix-key">{driver?.pixKey || "Não cadastrada"}</strong></p>
          {["paid_mp", "paid_pagbank"].includes(request.paymentStatus) && (
            <>
              <p className="info">O FreteOn recebeu o Pix real do cliente. Faça primeiro o repasse no seu banco. Este botão apenas registra a transferência realizada.</p>
              <label>Identificador do comprovante de repasse
                <input value={payoutReference} onChange={event => setPayoutReference(event.target.value)}
                  minLength={6} maxLength={100} placeholder="Identificador bancário ou comprovante"/>
              </label>
            </>
          )}
          <button className="primary full" disabled={busy || !driver?.pixKey ||
            (["paid_mp", "paid_pagbank"].includes(request.paymentStatus) && payoutReference.trim().length < 6)}
            onClick={() => onAction(request.id, "confirm_payout_master",
              ["paid_mp", "paid_pagbank"].includes(request.paymentStatus) ? { reference: payoutReference.trim() } : {})}>
            {["paid_mp", "paid_pagbank"].includes(request.paymentStatus) ? "Registrar repasse real já efetuado" : "Confirmar repasse manual (simulação)"}
          </button>
        </div>
      )}
      {isMaster && !refundBlocked(request) && request.disputeStatus === "open" && (
        <div className="wallet-review-actions">
          <button className="secondary" disabled={busy}
            onClick={() => onAction(request.id, "resolve_dispute_accept_master")}>Reconhecer entrega</button>
          <button className="secondary" disabled={busy}
            onClick={() => onAction(request.id, "resolve_dispute_cancel_master")}>Dispensar valores</button>
        </div>
      )}
      </>}
    </article>
  );
}

export default function WalletPanel({ role, user, wallet, requests, drivers, busy, onAction, onSavePreferences, mpEnabled = false, gateway, onPaid }) {
  const [pixKey, setPixKey] = useState("");
  const [acceptsCard, setAcceptsCard] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [visibleCount, setVisibleCount] = useState(5);
  const [masterTab, setMasterTab] = useState("pending");
  const [masterSearch, setMasterSearch] = useState("");
  const [masterVisibleCount, setMasterVisibleCount] = useState(5);
  useEffect(() => {
    if (role === "motorista") {
      setPixKey(wallet?.pixKey || "");
      setAcceptsCard(Boolean(user.acceptsCard));
    }
  }, [role, wallet?.pixKey, user.acceptsCard]);
  const all = requests.filter((request) =>
    request.paymentMethod &&
    request.selectedId &&
    (role === "master" || request.driverId === user.id)
  );
  const priority = (request) =>
    ["pending", "approved"].includes(request.refundStatus) ? -1 :
    request.disputeStatus === "open" ? 0 :
      request.payoutStatus === "requested" ? 1 :
        request.commissionStatus === "pending" ? 2 :
          request.payoutStatus === "available" ? 3 : 4;
  const sorted = [...all].sort((a, b) =>
    priority(a) - priority(b) ||
    (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  );
  const groups = { pending: [], active: [], history: [] };
  if (role === "motorista") sorted.forEach(request => groups[driverWalletBucket(request)].push(request));
  const driverRows = groups[activeTab] || [];
  const masterCounts = {};
  if (role === "master") Object.keys(masterTabLabels).forEach(tab => {
    masterCounts[tab] = all.filter(request => masterFinancialBucket(request, tab)).length;
  });
  const lookup = Object.fromEntries(drivers.map(driver => [driver.id, driver]));
  const query = masterSearch.trim().toLocaleLowerCase("pt-BR");
  const masterFiltered = role === "master" ? all.filter(request =>
    masterFinancialBucket(request, masterTab) && (
      !query || [request.title, request.origin, request.destination, request.id,
        lookup[request.driverId]?.name, lookup[request.driverId]?.phone]
        .some(item => String(item || "").toLocaleLowerCase("pt-BR").includes(query))
    )
  ) : [];
  const masterRows = [...masterFiltered].sort((a, b) =>
    Number(masterFinancialAction(b)) - Number(masterFinancialAction(a)) ||
    priority(a) - priority(b) ||
    new Date(b.updatedAt || b.createdAt || 0).getTime() -
    new Date(a.updatedAt || a.createdAt || 0).getTime()
  );
  const rows = role === "motorista"
    ? driverRows.slice(0, visibleCount)
    : masterRows.slice(0, masterVisibleCount);
  const amount = wallet || {};
  return (
    <section className="wallet-section">
      {role === "master" && <PaymentProviderAdmin initial={gateway} onSaved={onPaid}/>}
      <div className="wallet-banner">
        <Wallet size={22} />
        <div><strong>{mpEnabled ? `Financeiro FreteOn · ${gateway?.preferred === "pagbank" ? "PagBank" : "Mercado Pago"}` : "Carteira FreteOn · Simulação"}</strong><p>{mpEnabled ? `Pix conciliado pelo ${gateway?.preferred === "pagbank" ? "PagBank" : "Mercado Pago"}. Os repasses ao motorista continuam manuais.` : "Nenhum Pix ou repasse real será realizado nesta versão."}</p></div>
      </div>
      {role === "master" && all.some(r => ["pending", "approved"].includes(r.refundStatus)) && <p className="wallet-alert" role="status">{all.filter(r => r.refundStatus === "pending").length} reembolso(s) em análise · {all.filter(r => r.refundStatus === "approved").length} aguardando devolução. Solicitações aparecem primeiro no extrato.</p>}
      <div className="wallet-metrics">
        <div><span>{role === "master" ? "Comissões a receber" : "Comissões a repassar"}</span><strong>{byCents(amount.pendingCents)}</strong></div>
        <div><span>{role === "master" ? "Repasses pendentes" : "Saldo disponível para solicitar"}</span><strong>{byCents(role === "master" ? amount.requestedCents : amount.availableCents)}</strong></div>
        <div><span>Comissões vencidas</span><strong>{byCents(amount.overdueCents)}</strong></div>
        <div><span>Repasses realizados (simulação)</span><strong>{byCents(amount.paidOutCents)}</strong></div>
      </div>
      {role === "motorista" && amount.blocked && (
        <p className="wallet-alert" role="alert">
          <AlertCircle size={18} /> Novas propostas estão suspensas por comissão vencida. Você ainda pode concluir fretes contratados e acessar esta carteira.
        </p>
      )}
      {role === "motorista" && (
        <details className="wallet-preferences-disclosure">
          <summary><Wallet size={18}/> Configurar Pix e maquininha <ChevronDown size={17}/></summary>
          <form className="wallet-preferences" onSubmit={(event) => {
          event.preventDefault();
          onSavePreferences({ pixKey: pixKey.trim(), acceptsCard });
        }}>
          <h3>Como você recebe?</h3>
          <p className="muted">O Pix é necessário para solicitar repasses simulados. Cartão só aparece nas propostas se você aceitar sua própria maquininha.</p>
          <label className="checkbox"><input type="checkbox" checked={acceptsCard}
            onChange={(event) => setAcceptsCard(event.target.checked)} />
            Aceito cartão na minha própria maquininha
          </label>
          <label>Minha chave Pix para repasses manuais
            <input value={pixKey} onChange={(event) => setPixKey(event.target.value)}
              maxLength={150} placeholder="CPF, celular, e-mail ou chave aleatória" />
          </label>
          <button className="secondary" type="submit" disabled={busy}>Salvar preferências</button>
          </form>
        </details>
      )}
      <div className="section-heading"><h2>{role === "master" ? "Gestão financeira" : "Fretes e comissões"}</h2></div>
      {role === "master" && (
        <>
          <div className="wallet-master-overview">
            <div><span>Exigem ação</span><strong>{masterCounts.pending || 0}</strong></div>
            <div><span>Repasses solicitados</span><strong>{all.filter(r => r.payoutStatus === "requested").length}</strong></div>
            <div><span>Reembolsos em análise</span><strong>{all.filter(r => ["pending", "approved"].includes(r.refundStatus)).length}</strong></div>
            <div><span>Contestações abertas</span><strong>{all.filter(r => r.disputeStatus === "open").length}</strong></div>
          </div>
          <nav className="wallet-master-tabs" aria-label="Categorias financeiras">
            {Object.entries(masterTabLabels).map(([key, tab]) => (
              <button key={key} type="button" className={masterTab === key ? "active" : ""}
                aria-pressed={masterTab === key}
                onClick={() => { setMasterTab(key); setMasterVisibleCount(5); }}>
                <span>{tab.label}</span><strong>{masterCounts[key] || 0}</strong>
              </button>
            ))}
          </nav>
          <p className="wallet-master-help">{masterTabLabels[masterTab].subtitle}</p>
          <label className="wallet-master-search">
            <span>Buscar frete ou motorista</span>
            <input type="search" value={masterSearch} placeholder="Nome, pedido, cidade ou telefone"
              onChange={event => { setMasterSearch(event.target.value); setMasterVisibleCount(5); }}/>
          </label>
          <p className="wallet-master-result-count" aria-live="polite">
            {masterFiltered.length} {masterFiltered.length === 1 ? "registro encontrado" : "registros encontrados"}
            {masterFiltered.length > 0 ? ` · Exibindo ${Math.min(masterVisibleCount, masterFiltered.length)}` : ""}
          </p>
        </>
      )}
      {role === "motorista" && (
        <>
          <div className="wallet-driver-tabs" role="tablist" aria-label="Filtrar extrato por situação">
            {Object.entries(driverTabLabels).map(([key, item]) => (
              <button type="button" role="tab" key={key} id={`wallet-tab-${key}`}
                className={`wallet-driver-tab${activeTab === key ? " active" : ""}`}
                aria-selected={activeTab === key} aria-controls="wallet-driver-results"
                onClick={() => { setActiveTab(key); setVisibleCount(5); }}>
                <span>{item.label}</span>
                <strong>{groups[key].length}</strong>
              </button>
            ))}
          </div>
          <p className="wallet-driver-help">{driverTabLabels[activeTab].subtitle}</p>
        </>
      )}
      {rows.length ? (
        <div id="wallet-driver-results" className={`wallet-history${role === "motorista" ? " wallet-driver-history" : role === "master" ? " wallet-master-history" : ""}`}
          role={role === "motorista" ? "tabpanel" : undefined} aria-labelledby={role === "motorista" ? `wallet-tab-${activeTab}` : undefined}>
          {rows.map((request) =>
            <FreightFinanceRow key={request.id} request={request} role={role}
              drivers={drivers} busy={busy} onAction={onAction} mpEnabled={mpEnabled} gateway={gateway} onPaid={onPaid}
              compact={role === "motorista" || role === "master"} masterTab={masterTab}/>
          )}
        </div>
      ) : (
        <div id="wallet-driver-results" role={role === "motorista" ? "tabpanel" : undefined}
          aria-labelledby={role === "motorista" ? `wallet-tab-${activeTab}` : undefined}
          className="panel"><p className="muted">{role === "motorista"
            ? activeTab === "pending" ? "Nenhuma comissão ou repasse pendente."
              : activeTab === "active" ? "Nenhum frete em andamento."
              : "Seu histórico de fretes quitados aparecerá aqui."
            : masterSearch.trim() ? "Nenhum registro corresponde à busca nesta categoria." :
              masterTab === "pending" ? "Nenhuma operação aguardando ação do Master." :
              masterTab === "commissions" ? "Nenhuma comissão registrada." :
              masterTab === "payouts" ? "Nenhum repasse registrado." :
              masterTab === "refunds" ? "Nenhum reembolso ou contestação registrado." :
              masterTab === "history" ? "Nenhum frete com financeiro encerrado." :
              "Nenhum frete contratado com pagamento simulado ainda."}</p></div>
      )}
      {role === "motorista" && visibleCount < driverRows.length && (
        <button type="button" className="secondary wallet-load-more"
          onClick={() => setVisibleCount(count => count + 5)}>
          Mostrar mais {Math.min(5, driverRows.length - visibleCount)} frete(s)
          <ChevronRight size={16}/>
        </button>
      )}
      {role === "master" && masterVisibleCount < masterRows.length && (
        <button type="button" className="secondary wallet-load-more"
          onClick={() => setMasterVisibleCount(count => count + 5)}>
          Mostrar mais {Math.min(5, masterRows.length - masterVisibleCount)} registro(s)
          <ChevronRight size={16}/>
        </button>
      )}
      <p className="wallet-legal">{mpEnabled ? "Pagamentos Pix e reembolsos reais são confirmados pelo provedor utilizado na cobrança. O repasse ao motorista não é automático: o Master deve transferir o dinheiro e registrar o identificador do comprovante. Comissões vencem em 72 horas após a confirmação da entrega; contestações suspendem a cobrança." : "Valores ilustrativos, sem movimentação bancária. As comissões de dinheiro e cartão vencem 72 horas após a confirmação da entrega e do recebimento. Contestação aberta suspende a cobrança automática."}</p>
    </section>
  );
}
