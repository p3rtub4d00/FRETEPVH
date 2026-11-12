/**
 * A contratação só pertence ao motorista cujo identificador foi selecionado.
 * Outras propostas do mesmo frete não devem gerar notificação de aceitação.
 */
export function isAcceptedDriverBooking(request, driverId) {
  if (!request || !driverId || request.status !== "booked") return false;
  if (request.driverId !== driverId || !request.selectedId) return false;
  return Array.isArray(request.proposals) && request.proposals.some(
    (proposal) => proposal.id === request.selectedId &&
      proposal.driverId === driverId,
  );
}

export function pendingDriverBookings(requests, driverId) {
  if (!Array.isArray(requests)) return [];
  return requests.filter((request) => isAcceptedDriverBooking(request, driverId));
}
