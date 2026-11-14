import { useState } from 'react';
import { money } from './format.js';

export const refundBlocked = request => ['pending', 'approved', 'refunded_simulated'].includes(request.refundStatus);
const labels = {
  pending: 'Reembolso em análise', approved: 'Reembolso aprovado · aguardando simulação',
  rejected: 'Reembolso recusado', refunded_simulated: 'Reembolsado (simulação)',
};
const stages = { booked: 'Contratado', transit: 'Em transporte', completed: 'Concluído', cancelled: 'Cancelado' };
const date = value => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Porto_Velho' }) : '';

export default function RefundPanel({ request, role, busy, onAction }) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const status = request.refundStatus || 'none';
  const canAsk = role === 'cliente' && request.canRequestRefund;
  if (status === 'none' && !canAsk) return null;
  async function submit(action) {
    setError('');
    const ok = await onAction(request.id, action, { reason });
    if (ok) { setEditing(false); setReason(''); }
    else setError('Não foi possível concluir. Confira o aviso do painel e tente novamente.');
  }
  return <section className="refund-panel" aria-label="Cancelamento e reembolso">
    <h3>{labels[status] || 'Cancelamento e reembolso Pix'}</h3>
    <p className="muted">Somente simulação. Nenhum dinheiro será devolvido ou movimentado nesta versão.</p>
    {status !== 'none' && <>
      <p><strong>Valor integral: {money(request.refundAmountCents / 100)}</strong></p>
      <p>Solicitado em {date(request.refundRequestedAt)} · Etapa: {stages[request.refundStage] || request.refundStage}</p>
      <p><strong>Motivo:</strong> {request.refundReason}</p>
      {status === 'pending' && <p className="info">O frete e o repasse estão suspensos até a análise do Master. Se o transporte já começou, combine pelo chat os cuidados com a carga.</p>}
      {request.refundDecisionReason && <p><strong>Decisão do Master:</strong> {request.refundDecisionReason} · {date(request.refundReviewedAt)}</p>}
      {status === 'rejected' && <p>O frete mantém a etapa anterior. Confira a justificativa acima.</p>}
      {status === 'approved' && <p>O frete foi cancelado. A aprovação ainda não representa uma devolução concluída.</p>}
      {request.refundedAt && <p>Devolução simulada registrada em {date(request.refundedAt)}.</p>}
    </>}
    {canAsk && !editing && <button type="button" className="secondary full" disabled={busy} onClick={() => setEditing(true)}>Cancelar e solicitar reembolso</button>}
    {(canAsk && editing || role === 'master' && status === 'pending') && <form onSubmit={event => { event.preventDefault(); submit(role === 'master' ? 'approve_refund' : 'request_refund'); }}>
      <label>{role === 'master' ? 'Justificativa da decisão' : 'Motivo do cancelamento'}
        <textarea required minLength={10} maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Descreva em pelo menos 10 caracteres" />
      </label>
      {role === 'master' ? <>
        <p>Analise a etapa do transporte e o motivo. A aprovação cancela o frete e autoriza o reembolso integral simulado.</p>
        <button className="primary full" disabled={busy}>Aprovar reembolso integral</button>
        <button type="button" className="secondary full" disabled={busy || reason.trim().length < 10} onClick={() => submit('reject_refund')}>Recusar com justificativa</button>
      </> : <>
        <p>Solicitação de {money(request.agreedPriceCents / 100)}. O pedido ficará suspenso para análise; não há aprovação automática.</p>
        <button className="primary full" disabled={busy}>Enviar solicitação ao Master</button>
        <button type="button" className="secondary full" disabled={busy} onClick={() => setEditing(false)}>Voltar</button>
      </>}
    </form>}
    {role === 'master' && status === 'approved' && <button className="primary full" disabled={busy} onClick={() => submit('simulate_refund')}>Simular devolução de {money(request.refundAmountCents / 100)}</button>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
