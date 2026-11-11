export const statusLabels = {
  open: "Recebendo propostas",
  booked: "Contratado",
  transit: "Em transporte",
  completed: "Concluído",
  cancelled: "Cancelado",
};
export const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
