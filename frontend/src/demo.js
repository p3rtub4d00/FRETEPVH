export const initialState = {
  version: 1,
  available: true,
  drivers: [
    {
      id: "marcos",
      name: "Marcos Lima",
      initials: "ML",
      vehicle: "Fiat Strada · Picape",
      rating: "4,9",
      trips: 38,
      status: "approved",
    },
    {
      id: "ana",
      name: "Ana Costa",
      initials: "AC",
      vehicle: "Fiat Fiorino · Utilitário",
      rating: "4,8",
      trips: 26,
      status: "approved",
    },
    {
      id: "rafael",
      name: "Rafael Santos",
      initials: "RS",
      vehicle: "Hyundai HR · Caminhão pequeno",
      rating: "Novo",
      trips: 0,
      status: "pending",
    },
  ],
  requests: [
    {
      id: "FON-1042",
      title: "Sofá de 3 lugares",
      origin: "Centro, Porto Velho",
      destination: "Nova Porto Velho, Porto Velho",
      date: "",
      time: "14:00",
      vehicle: "Picape",
      helper: true,
      description:
        "Sofá de 2 metros. Retirada no térreo, com ajuda para carregar.",
      photos: [],
      status: "open",
      proposals: [
        {
          id: "p1",
          driverId: "marcos",
          price: 85,
          time: "14:00",
          note: "Tenho cordas e lona. Ajuda para carregar incluída.",
        },
        {
          id: "p2",
          driverId: "ana",
          price: 100,
          time: "13:00",
          note: "Transporte em veículo fechado. Ajudante incluído.",
        },
      ],
    },
    {
      id: "FON-1041",
      title: "Entrega de caixas",
      origin: "Olaria, Porto Velho",
      destination: "Embratel, Porto Velho",
      date: "",
      time: "09:00",
      vehicle: "Utilitário",
      helper: false,
      description: "Cinco caixas de tamanho médio.",
      photos: [],
      status: "completed",
      selectedId: "p3",
      rating: 5,
      proposals: [
        {
          id: "p3",
          driverId: "marcos",
          price: 70,
          time: "09:00",
          note: "Caixas acomodadas no compartimento de carga.",
        },
      ],
    },
  ],
};
export function loadDemo() {
  try {
    const stored = JSON.parse(localStorage.getItem("freteon-demo-v1"));
    if (
      stored?.version === 1 &&
      Array.isArray(stored.requests) &&
      Array.isArray(stored.drivers)
    )
      return stored;
  } catch {
    /* A demonstração continua quando o armazenamento está indisponível. */
  }
  return structuredClone(initialState);
}
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
