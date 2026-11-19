import { useEffect, useState } from "react";
import { Building2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "./api.js";
const names = { mercadopago: "Mercado Pago", pagbank: "PagBank", asaas: "Asaas" };

export default function PaymentProviderAdmin({ initial, onSaved, readOnly = false }) {
  const [current, setCurrent] = useState(initial?.preferred || "mercadopago");
  const [config, setConfig] = useState(initial || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (initial) {
      setConfig(initial);
      setCurrent(initial.preferred);
    }
  }, [initial?.preferred, initial?.enabled, initial?.updatedAt]);
  async function choose(provider) {
    if (busy || readOnly || provider === current) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/master/payment-provider", {
        method: "PATCH", body: { preferred: provider }
      });
      setCurrent(result.preferred);
      setConfig(result);
      onSaved?.();
    } catch (cause) {
      setError(cause.message);
    } finally { setBusy(false); }
  }
  return <section className="payment-provider-admin" aria-label="Banco preferencial para receber Pix">
    <div className="payment-provider-heading">
      <Building2 size={21}/>
      <div><strong>Banco preferencial para receber Pix</strong>
        <p>Defina para onde irão as novas cobranças de frete e comissões. Pagamentos antigos permanecem no banco de origem.</p>
      </div>
    </div>
    {readOnly && <p className="muted">Somente o Master Principal pode alterar o banco que recebe os pagamentos.</p>}
    <div className="payment-provider-options">
      {Object.entries(names).map(([provider, name]) => (
        <button key={provider} type="button" disabled={busy || readOnly}
          aria-pressed={current === provider} onClick={() => choose(provider)}
          className={current === provider ? "selected" : ""}>
          <span><strong>{name}</strong>
            <small>{config?.available?.[provider] ? "Credenciais configuradas" : "Aguardando configuração no Render"}</small>
          </span>
          {current === provider && <CheckCircle2 size={19}/>}
        </button>
      ))}
    </div>
    <div className={config?.enabled && config?.real ? "payment-provider-ready" : "payment-provider-warning"} role="status">
      {config?.enabled && config?.real ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
      <span>{config?.enabled && config?.real
        ? `Banco selecionado: ${names[current]}. Novos Pix serão gerados para recebimento real.`
        : config?.enabled
          ? `${names[current]} está habilitado somente para homologação. Não há recebimento bancário real neste ambiente.`
          : `${names[current]} selecionado, mas ainda não habilitado para Pix real. Configure as credenciais no Render antes de cobrar clientes.`}</span>
    </div>
    {config?.pagbankEnvironment === "sandbox" && current === "pagbank" && config.enabled && (
      <p className="muted">PagBank em sandbox: ambiente apenas para testes, sem recebimentos reais.</p>
    )}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
