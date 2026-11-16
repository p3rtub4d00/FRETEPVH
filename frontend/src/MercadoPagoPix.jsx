import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, RefreshCw, QrCode } from "lucide-react";
import { api } from "./api.js";
import { money } from "./format.js";

const labels = { freight: "Pagar frete com Pix", commission: "Pagar comissão com Pix" };
export default function MercadoPagoPix({ requestId, kind, onPaid, gateway }) {
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const notified = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    let live = true;
    notified.current = false;
    setOrder(null);
    setError("");
    setChecking(true);
    async function fetchStatus() {
      try {
        const result = await api(`/payments/orders/${requestId}/${kind}`);
        if (!live) return;
        setOrder(result);
        if (result.status === "approved" && !notified.current) {
          notified.current = true;
          onPaidRef.current?.();
        }
      } catch (cause) {
        if (live) setError(cause.message);
      } finally {
        if (live) setChecking(false);
      }
    }
    fetchStatus();
    const interval = setInterval(() => {
      if (!document.hidden) fetchStatus();
    }, 12000);
    return () => { live = false; clearInterval(interval); };
  }, [requestId, kind]);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api(`/payments/orders/${requestId}/${kind}`, {
        method: "POST", body: { email: email.trim(), cpf: cpf.replace(/\D/g, "") }
      });
      setOrder(data);
      setCpf("");
      if (data.status === "approved" && !notified.current) {
        notified.current = true;
        onPaidRef.current?.();
      }
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/payments/orders/${requestId}/${kind}`);
      setOrder(result);
      if (result.status === "approved" && !notified.current) {
        notified.current = true;
        onPaidRef.current?.();
      }
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function copyPix() {
    try {
      await navigator.clipboard.writeText(order.qrCode);
      setCopied(true);
    } catch { setError("Copie o código Pix pelo campo abaixo."); }
  }
  const approved = order?.status === "approved";
  const unavailable = Boolean(order?.unavailable) || (!gateway?.enabled && !order?.qrCode && !approved);
  const provider = order?.provider || gateway?.preferred || "mercadopago";
  const providerName = provider === "pagbank" ? "PagBank" : "Mercado Pago";
  const sandbox = provider === "pagbank" && gateway?.pagbankEnvironment === "sandbox";
  return <section className="mp-pix-panel" aria-label={labels[kind]}>
    <div className="mp-pix-head"><QrCode size={20}/><strong>{labels[kind]} · {providerName}</strong></div>
    {sandbox && <p className="muted">Ambiente PagBank de testes: este Pix não representa cobrança real.</p>}
    {checking ? (
      <p className="muted" role="status">Consultando situação do Pix no banco...</p>
    ) : approved ? (
      <div className="mp-pix-success" role="status">
        <CheckCircle2 size={22}/>
        <span>{order?.reviewRequired
          ? `Pagamento identificado no ${providerName}, aguardando conferência do Master.`
          : `Pagamento confirmado pelo ${providerName}. O financeiro do FreteOn foi atualizado.`}</span>
      </div>
    ) : order?.qrCode ? (
      <div className="mp-pix-payment">
        <strong>Pix de {money(order.amountCents / 100)}</strong>
        {order.qrCodeBase64 && (
          <img className="mp-pix-qr" src={`data:image/png;base64,${order.qrCodeBase64}`} alt="QR Code para pagamento Pix"/>
        )}
        <label>Código Pix copia e cola
          <textarea readOnly rows={3} value={order.qrCode} onFocus={event => event.target.select()}/>
        </label>
        <button type="button" className="secondary full" onClick={copyPix}>
          <Copy size={17}/> {copied ? "Código copiado" : "Copiar código Pix"}
        </button>
        <p className="muted">Pague pelo aplicativo do seu banco. A confirmação é automática e pode levar alguns instantes.</p>
        <button type="button" className="secondary full" disabled={busy} onClick={refresh}>
          <RefreshCw size={17}/> {busy ? "Consultando..." : "Verificar pagamento"}
        </button>
      </div>
    ) : unavailable ? (
      <p className="wallet-note" role="status">Pagamento por Pix indisponível: {providerName} ainda não está habilitado no Render. O Master precisa configurar as credenciais e liberar o ambiente de produção. Nenhum pagamento foi registrado.</p>
    ) : order?.status && order.status !== "none" && order.status !== "created" ? (
      <div className="mp-pix-payment">
        <p className="muted">Cobrança: {order.status === "pending" ? "Aguardando pagamento" :
          order.status === "rejected" ? "Não aprovada" :
          order.status === "cancelled" ? "Cancelada" : "Em análise"}.</p>
        <button type="button" className="secondary full" disabled={busy} onClick={refresh}>
          <RefreshCw size={17}/> Atualizar pagamento
        </button>
      </div>
    ) : (
      <form onSubmit={create}>
        <p className="muted">O valor é calculado pelo FreteOn. O Pix será emitido para a conta {providerName} do FreteOn.</p>
        <label>E-mail do pagador
          <input type="email" required autoComplete="email" maxLength={200}
            placeholder="seuemail@exemplo.com" value={email}
            onChange={event => setEmail(event.target.value)}/>
        </label>
        <label>CPF do pagador
          <input inputMode="numeric" required pattern="[0-9]{11}" maxLength={11}
            placeholder="Somente números" value={cpf}
            onChange={event => setCpf(event.target.value)}/>
        </label>
        <button type="submit" className="primary full" disabled={busy}>
          <QrCode size={18}/> {busy ? "Gerando..." : "Gerar Pix"}
        </button>
      </form>
    )}
    {order?.reviewRequired && <p className="info">Pagamento registrado, mas requer conferência pelo Master antes de liberar valores.</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
