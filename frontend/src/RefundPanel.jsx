import { useState } from 'react';
import { money } from './format.js';

export const refundBlocked = request => ['pending', 'approved', 'refunded_simulated', 'refunded_mp', 'refunded_pagbank'].includes(request.refundStatus);
const labels = {
  pending: 'Reembolso em análise', approved: 'Reembolso aprovado · aguardando confirmação do banco',
  rejected: 'Reembolso recusado', refunded_simulated: 'Registro antigo: devolução não conciliada',
  refunded_mp: 'Reembolso confirmado pelo Mercado Pago',
  refunded_pagbank: 'Reembolso confirmado pelo PagBank',
};
const stages = { booked: 'Contratado', transit: 'Em transporte', completed: 'Concluído', cancelled: 'Cancelado' };
const date = value => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Porto_Velho' }) : '';

export default function RefundPanel({ request, role, busy, onAction, canManage = true }) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const status = request.refundStatus || 'none';
  const gatewayPix = ['paid_mp', 'refunded_mp', 'paid_pagbank', 'refunded_pagbank'].includes(request.paymentStatus);
  const sandboxPix = ['paid_pagbank', 'refunded_pagbank'].includes(request.paymentStatus) && request.paymentProviderEnvironment === 'sandbox';
  const realPix = gatewayPix && !sandboxPix;
  const canAsk = role === 'cliente' && request.canRequestRefund && gatewayPix;
  if (status === 'none' && !canAsk) return null;
  async function submit(action) {
    setError('');
    const ok = await onAction(request.id, action, { reason });
    if (ok) { setEditing(false); setReason(''); }
    else setError('Não foi possível concluir. Confira o aviso do painel e tente novamente.');
  }
  return <section className="refund-panel" aria-label="Cancelamento e reembolso">
    <h3>{labels[status] || 'Cancelamento e reembolso Pix'}</h3>
    <p className="muted">{realPix
      ? "O Master analisa o pedido e solicita a devolução pelo banco que recebeu o Pix."
      : sandboxPix ? "Operação no ambiente PagBank de homologação, sem movimentação bancária real."
      : "Registro anterior sem pagamento bancário confirmado. Consulte a administração."}</p>
    {status !== 'none' && <>
      <p><strong>Valor integral: {money(request.refundAmountCents / 100)}</strong></p>
      <p>Solicitado em {date(request.refundRequestedAt)} · Etapa: {stages[request.refundStage] || request.refundStage}</p>
      <p><strong>Motivo:</strong> {request.refundReason}</p>
      {status === 'pending' && <p className="info">O frete e o repasse estão suspensos até a análise do Master. Se o transporte já começou, combine pelo chat os cuidados com a carga.</p>}
      {request.refundDecisionReason && <p><strong>Decisão do Master:</strong> {request.refundDecisionReason} · {date(request.refundReviewedAt)}</p>}
      {status === 'rejected' && <p>O frete mantém a etapa anterior. Confira a justificativa acima.</p>}
      {status === 'approved' && <p>O frete foi cancelado. A aprovação ainda não representa uma devolução concluída.</p>}
      {request.refundedAt && <p>Devolução registrada anteriormente em {date(request.refundedAt)}. Confira o comprovante bancário.</p>}
    </>}
    {canAsk && !editing && <button type="button" className="secondary full" disabled={busy} onClick={() => setEditing(true)}>Cancelar e solicitar reembolso</button>}
    {(canAsk && editing || role === 'master' && canManage && status === 'pending') && <form onSubmit={event => { event.preventDefault(); submit(role === 'master' ? 'approve_refund' : 'request_refund'); }}>
      <label>{role === 'master' ? 'Justificativa da decisão' : 'Motivo do cancelamento'}
        <textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Descreva em pelo menos 10 caracteres" />
      </label>
      {role === 'master' ? <>
        <p>Analise a etapa do transporte e o motivo. A aprovação cancela o frete e solicita a devolução pelo provedor do pagamento.</p>
        <button className="primary full" disabled={busy || !gatewayPix}>{gatewayPix ? `Aprovar e devolver via ${request.paymentStatus === "paid_pagbank" ? "PagBank" : "Mercado Pago"}${sandboxPix ? " (teste)" : ""}` : "Reembolso bancário indisponível para registro antigo"}</button>
        <button type="button" className="secondary full" disabled={busy || reason.trim().length < 10} onClick={() => submit('reject_refund')}>Recusar com justificativa</button>
      </> : <>
        <p>Solicitação de {money(request.agreedPriceCents / 100)}. O pedido ficará suspenso para análise; não há aprovação automática.</p>
        <button className="primary full" disabled={busy}>Enviar solicitação ao Master</button>
        <button type="button" className="secondary full" disabled={busy} onClick={() => setEditing(false)}>Voltar</button>
      </>}
    </form>}
    {role === 'master' && status === 'approved' && !gatewayPix && <p className="wallet-note">Registro antigo sem pagamento conciliado. Não efetue devolução pelo sistema; confira os registros anteriores.</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
