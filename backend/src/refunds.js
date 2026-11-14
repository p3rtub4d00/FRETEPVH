// Simulated refunds only. A real gateway must confirm a refund before a future
// production flow can mark it as paid. Never accept amounts from the browser.
const reject = (status, message) => { throw Object.assign(new Error(message), { status }); };
const reasonText = value => {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason.length < 10 || reason.length > 500) reject(400, 'Informe um motivo de 10 a 500 caracteres.');
  return reason;
};
export const refundBlocks = request => ['pending', 'approved', 'refunded_simulated'].includes(request.refundStatus);
export const canRequestRefund = request => request.paymentMethod === 'pix_freteon' &&
  Number.isSafeInteger(request.agreedPriceCents) && request.agreedPriceCents > 0 &&
  request.paymentStatus === 'simulated_paid' && ['booked', 'transit', 'completed', 'cancelled'].includes(request.status) &&
  request.payoutStatus !== 'paid_simulated' && request.disputeStatus !== 'open' &&
  (!request.refundStatus || request.refundStatus === 'none');

export function applyRefund(request, user, action, reason) {
  const master = user.role === 'master';
  const client = user.role === 'cliente' && String(user._id) === request.clientId;
  if (action === 'request_refund') {
    if (!client) reject(403, 'Somente o cliente deste frete pode solicitar reembolso.');
    if (!canRequestRefund(request)) reject(409, 'Este pagamento não permite nova solicitação de reembolso.');
    request.refundReason = reasonText(reason);
    request.refundStatus = 'pending';
    request.refundRequestedAt = new Date();
    request.refundStage = request.status;
    request.refundAmountCents = request.agreedPriceCents;
  } else {
    if (!master) reject(403, 'Somente o Master pode decidir sobre o reembolso.');
    if (request.paymentMethod !== 'pix_freteon' || request.paymentStatus !== 'simulated_paid' ||
        request.payoutStatus === 'paid_simulated') reject(409, 'Pagamento indisponível para reembolso.');
    if (['approve_refund', 'reject_refund'].includes(action)) {
      if (request.refundStatus !== 'pending') reject(409, 'Não existe reembolso aguardando análise.');
      request.refundDecisionReason = reasonText(reason);
      request.refundReviewedAt = new Date();
      request.refundReviewedBy = String(user._id);
      request.refundStatus = action === 'approve_refund' ? 'approved' : 'rejected';
      if (action === 'approve_refund') {
        request.status = 'cancelled';
        request.payoutStatus = 'none';
        request.commissionStatus = 'waived';
        request.commissionDueAt = null;
      }
    } else if (action === 'simulate_refund') {
      if (request.refundStatus !== 'approved') reject(409, 'Aprove o reembolso antes de simular a devolução.');
      request.refundStatus = 'refunded_simulated';
      request.paymentStatus = 'refunded_simulated';
      request.refundedAt = new Date();
      request.refundedBy = String(user._id);
    } else reject(400, 'Ação de reembolso inválida.');
  }
}
