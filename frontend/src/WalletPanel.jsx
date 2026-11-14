import RefundPanel, { refundBlocked } from "./RefundPanel.jsx";
import { useEffect, useState } from "react";
import { AlertCircle, Banknote, CheckCircle2, Clock3, CreditCard, QrCode, Wallet } from "lucide-react";
import { money } from "./format.js";

export const paymentLabels = {
  pix_freteon: "Pix pelo FreteOn",
  card_driver: "Cartão na maquininha",
  cash_driver: "Dinheiro ao motorista",
};

const byCents = (value) => money((value || 0) / 100);
const percentAmount = (price) => Math.round(Math.round(Number(price || 0) * 100) * 0.10);
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

export function CommissionPreview({ price, method }) {
  const grossCents = Math.round(Number(price || 0) * 100);
  if (!Number.isFinite(grossCents) || grossCents <= 0) return null;
  const commissionCents = percentAmount(price);
  return (
    <div className="commission-preview">
      <div><span>Valor total proposto</span><strong>{byCents(grossCents)}</strong></div>
      <div><span>Comissão FreteOn (10%)</span><strong>− {byCents(commissionCents)}</strong></div>
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
    if (request.paymentStatus === "awaiting") return <span className="wallet-status warning">Cliente ainda não simulou o Pix</span>;
    if (request.payoutStatus === "paid_simulated") return <span className="wallet-status success">Repasse simulado concluído</span>;
    if (request.payoutStatus === "requested") return <span className="wallet-status warning">Solicitação em análise pelo Master</span>;
    if (request.payoutStatus === "available") return <span className="wallet-status success">Repasse disponível para solicitar</span>;
    return <span className="wallet-status">Aguardando conclusão e confirmação do cliente</span>;
  }
  if (request.commissionStatus === "paid") return <span className="wallet-status success">Comissão quitada (simulação)</span>;
  if (request.commissionStatus === "waived") return <span className="wallet-status">Comissão dispensada</span>;
  if (request.commissionStatus === "pending") {
    const overdue = request.commissionDueAt && new Date(request.commissionDueAt).getTime() <= Date.now();
    return <span className={overdue ? "wallet-status warning" : "wallet-status"}>{overdue ? "Comissão vencida" : "Comissão a repassar"}</span>;
  }
  return <span className="wallet-status">Aguardando conclusão e confirmação do cliente</span>;
}

function FreightFinanceRow({ request, role, drivers, busy, onAction }) {
  const driver = drivers.find((person) => person.id === request.driverId);
  const isDriver = role === "motorista";
  const isMaster = role === "master";
  const amount = request.agreedPriceCents;
  const due = request.commissionDueAt
    ? new Date(request.commissionDueAt).toLocaleString("pt-BR", { timeZone: "America/Porto_Velho", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <article className="wallet-item">
      <div className="wallet-item-heading">
        <div>
          <strong>{request.title}</strong>
          <small>{request.origin} → {request.destination}</small>
          {isMaster && <small>Motorista: {driver?.name || "Cadastro não encontrado"}</small>}
        </div>
        <strong>{byCents(amount)}</strong>
      </div>
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
      {isDriver && request.commissionStatus === "pending" && request.disputeStatus !== "open" && (
        <button className="secondary full" disabled={busy || Boolean(request.commissionPaymentRequestedAt)}
          onClick={() => onAction(request.id, "notify_commission")}>
          {request.commissionPaymentRequestedAt ? "Pagamento informado ao Master" : "Informar comissão enviada (simulação)"}
        </button>
      )}
      {isMaster && !refundBlocked(request) && request.status === "completed" &&
        !request.deliveryConfirmedAt && request.disputeStatus !== "open" &&
        request.disputeStatus !== "resolved_cancelled" &&
        (request.paymentMethod !== "pix_freteon" || request.paymentStatus === "simulated_paid") && (
          <button className="secondary full" disabled={busy}
            onClick={() => onAction(request.id, "confirm_delivery_master")}>
            Confirmar entrega após análise (simulação)
          </button>
      )}
      {isMaster && !refundBlocked(request) && request.commissionStatus === "pending" && request.disputeStatus !== "open" && (
        <button className="primary full" disabled={busy}
          onClick={() => onAction(request.id, "confirm_commission_master")}>
          Confirmar quitação da comissão (simulação)
        </button>
      )}
      {isMaster && !refundBlocked(request) && request.payoutStatus === "requested" && request.disputeStatus !== "open" && (
        <div className="wallet-transfer">
          <p>Chave Pix do motorista: <strong className="wallet-pix-key">{driver?.pixKey || "Não cadastrada"}</strong></p>
          <button className="primary full" disabled={busy || !driver?.pixKey}
            onClick={() => onAction(request.id, "confirm_payout_master")}>
            Confirmar repasse manual (simulação)
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
    </article>
  );
}

export default function WalletPanel({ role, user, wallet, requests, drivers, busy, onAction, onSavePreferences }) {
  const [pixKey, setPixKey] = useState("");
  const [acceptsCard, setAcceptsCard] = useState(false);
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
  const sorted = [...all].sort((a, b) => priority(a) - priority(b));
  const amount = wallet || {};
  return (
    <section className="wallet-section">
      <div className="wallet-banner">
        <Wallet size={22} />
        <div><strong>Carteira FreteOn · Simulação</strong><p>Nenhum Pix ou repasse real será realizado nesta versão.</p></div>
      </div>
      {role === "master" && all.some(r => ["pending", "approved"].includes(r.refundStatus)) && <p className="wallet-alert" role="status">{all.filter(r => r.refundStatus === "pending").length} reembolso(s) em análise · {all.filter(r => r.refundStatus === "approved").length} aguardando devolução simulada. Solicitações aparecem primeiro no extrato.</p>}
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
      )}
      <div className="section-heading"><h2>{role === "master" ? "Controle de pagamentos e repasses" : "Extrato por frete"}</h2></div>
      {sorted.length ? (
        <div className="wallet-history">
          {sorted.map((request) =>
            <FreightFinanceRow key={request.id} request={request} role={role}
              drivers={drivers} busy={busy} onAction={onAction} />
          )}
        </div>
      ) : (
        <div className="panel"><p className="muted">Nenhum frete contratado com pagamento simulado ainda.</p></div>
      )}
      <p className="wallet-legal">Valores ilustrativos, sem movimentação bancária. As comissões de dinheiro e cartão vencem 72 horas após a confirmação da entrega e do recebimento. Contestação aberta suspende a cobrança automática.</p>
    </section>
  );
}
