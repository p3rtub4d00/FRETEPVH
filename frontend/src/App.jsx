import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  Home,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Star,
  Truck,
  Users,
  X,
  History,
  LayoutDashboard,
  CircleHelp,
  Flag,
  Camera,
} from "lucide-react";
import { initialState, loadDemo, money, statusLabels } from "./demo.js";

const areas = { cliente: "Cliente", motorista: "Motorista", master: "Master" };
const navigation = {
  cliente: [
    ["inicio", "Início", Home],
    ["fretes", "Meus fretes", Package],
    ["historico", "Histórico", History],
    ["perfil", "Meu perfil", Users],
  ],
  motorista: [
    ["inicio", "Pedidos", Home],
    ["propostas", "Propostas", Package],
    ["historico", "Histórico", History],
    ["perfil", "Meu perfil", Users],
  ],
  master: [
    ["inicio", "Visão geral", LayoutDashboard],
    ["motoristas", "Motoristas", Truck],
    ["fretes", "Fretes", Package],
    ["usuarios", "Usuários", Users],
    ["denuncias", "Denúncias", Flag],
  ],
};

function Route({ request }) {
  return (
    <div className="route">
      <div>
        <span className="route-dot" />
        <p>
          <small>Retirada</small>
          {request.origin}
        </p>
      </div>
      <div>
        <MapPin size={15} />
        <p>
          <small>Entrega</small>
          {request.destination}
        </p>
      </div>
    </div>
  );
}
function Empty({ title, children }) {
  return (
    <div className="empty">
      <Package size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function RequestForm({ onCreate, onClose }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    title: "",
    origin: "",
    destination: "",
    description: "",
    vehicle: "Picape",
    helper: false,
    date: "",
    time: "",
    photos: [],
  });
  const update = (event) =>
    setData((previous) => ({
      ...previous,
      [event.target.name]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  async function photos(event) {
    const files = [...event.target.files];
    if (
      files.length + data.photos.length > 3 ||
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 600000,
      )
    ) {
      setError("Selecione até 3 fotos JPG, PNG ou WebP, com até 600 KB cada.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }),
        ),
      );
      setData((previous) => ({
        ...previous,
        photos: [...previous.photos, ...images],
      }));
    } catch {
      setError("Não foi possível abrir a foto. Tente outro arquivo.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }
  function submit(event) {
    event.preventDefault();
    setError("");
    if (step === 0 && data.origin.trim() === data.destination.trim()) {
      setError("Informe endereços diferentes para retirada e entrega.");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    if (new Date(`${data.date}T${data.time}`) <= new Date()) {
      setError("Escolha uma data e um horário futuros.");
      return;
    }
    onCreate(data);
  }
  return (
    <Modal title="Solicitar frete" onClose={onClose}>
      <div className="steps">
        {["Trajeto", "Carga", "Agendamento"].map((label, index) => (
          <span key={label} className={index <= step ? "active" : ""}>
            {index + 1}. {label}
          </span>
        ))}
      </div>
      <form onSubmit={submit}>
        {step === 0 && (
          <>
            <p className="muted">
              Informe os endereços completos em Porto Velho.
            </p>
            <label>
              Endereço de retirada
              <input
                autoFocus
                name="origin"
                value={data.origin}
                onChange={update}
                required
                minLength={5}
                maxLength={180}
                placeholder="Rua, número e bairro"
              />
            </label>
            <label>
              Endereço de entrega
              <input
                name="destination"
                value={data.destination}
                onChange={update}
                required
                minLength={5}
                maxLength={180}
                placeholder="Rua, número e bairro"
              />
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <label>
              O que você vai transportar?
              <input
                autoFocus
                name="title"
                value={data.title}
                onChange={update}
                required
                minLength={3}
                maxLength={70}
                placeholder="Ex. sofá de 3 lugares"
              />
            </label>
            <label>
              Detalhes da carga
              <textarea
                name="description"
                value={data.description}
                onChange={update}
                required
                maxLength={500}
                placeholder="Dimensões, quantidade, escadas e cuidados necessários"
              />
            </label>
            <label>
              Veículo
              <select name="vehicle" value={data.vehicle} onChange={update}>
                {["Picape", "Utilitário", "Caminhão pequeno", "Caminhão"].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  ),
                )}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                name="helper"
                checked={data.helper}
                onChange={update}
              />
              Preciso de ajuda para carregar
            </label>
            <label className="upload">
              <Camera size={20} /> Fotos da carga{" "}
              <small>Até 3 fotos · 600 KB por foto</small>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={photos}
                disabled={loading}
              />
            </label>
            <div className="photos">
              {data.photos.map((photo, index) => (
                <div key={photo}>
                  <img src={photo} alt={`Foto ${index + 1} da carga`} />
                  <button
                    type="button"
                    aria-label={`Remover foto ${index + 1}`}
                    onClick={() =>
                      setData({
                        ...data,
                        photos: data.photos.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="form-grid">
              <label>
                Data
                <input
                  autoFocus
                  type="date"
                  required
                  name="date"
                  value={data.date}
                  onChange={update}
                  min={new Date().toLocaleDateString("en-CA")}
                />
              </label>
              <label>
                Horário
                <input
                  type="time"
                  required
                  name="time"
                  value={data.time}
                  onChange={update}
                />
              </label>
            </div>
            <div className="review">
              <h3>{data.title}</h3>
              <Route request={data} />
              <p>
                {data.vehicle} · {data.helper ? "Com ajudante" : "Sem ajudante"}
              </p>
              <small>
                Os motoristas enviam seus preços. Você escolhe a proposta.
              </small>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          {step > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
          )}
          <button className="primary" disabled={loading}>
            {step === 2 ? "Publicar pedido de teste" : "Continuar"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function App() {
  const [state, setState] = useState(loadDemo);
  const [area, setArea] = useState(() => {
    const value = location.pathname.split("/")[1];
    return areas[value] ? value : "cliente";
  });
  const [page, setPage] = useState("inicio");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [install, setInstall] = useState(null);
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    try {
      localStorage.setItem("freteon-demo-v1", JSON.stringify(state));
    } catch {
      setNotice(
        "O armazenamento do navegador está cheio ou indisponível. As alterações desta sessão podem ser perdidas ao fechar.",
      );
    }
  }, [state]);
  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setInstall(event);
    };
    const pop = () => {
      const next = location.pathname.split("/")[1];
      setArea(areas[next] ? next : "cliente");
      setPage("inicio");
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  function changeArea(next) {
    setArea(next);
    setPage("inicio");
    setFilter("all");
    history.pushState({}, "", `/${next}`);
  }
  function updateRequest(id, patch) {
    setState((previous) => ({
      ...previous,
      requests: previous.requests.map((request) =>
        request.id === id ? { ...request, ...patch } : request,
      ),
    }));
  }
  function createRequest(data) {
    const request = {
      ...data,
      id: `FON-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      status: "open",
      proposals: [],
    };
    setState((previous) => ({
      ...previous,
      requests: [request, ...previous.requests],
    }));
    setModal(null);
    setPage("fretes");
    setNotice(
      "Pedido de teste publicado. Acesse Motorista para enviar uma proposta.",
    );
  }
  const active = state.requests.filter((request) =>
    ["open", "booked", "transit"].includes(request.status),
  );
  const completed = state.requests.filter(
    (request) => request.status === "completed",
  );
  const selected = modal?.id
    ? state.requests.find((request) => request.id === modal.id)
    : null;
  const pending = state.drivers.filter((driver) => driver.status === "pending");
  const driver = state.drivers[0];
  const totalProposals = active.reduce(
    (sum, request) => sum + request.proposals.length,
    0,
  );
  let requests = state.requests;
  if (page === "historico")
    requests = state.requests.filter((request) =>
      ["completed", "cancelled"].includes(request.status),
    );
  else if (area === "motorista")
    requests =
      page === "propostas"
        ? state.requests.filter((request) =>
            request.proposals.some(
              (proposal) => proposal.driverId === "marcos",
            ),
          )
        : state.requests.filter(
            (request) =>
              request.status === "open" ||
              (request.proposals.find(
                (proposal) => proposal.id === request.selectedId,
              )?.driverId === "marcos" &&
                ["booked", "transit"].includes(request.status)),
          );
  else if (page === "inicio") requests = active;
  if (filter !== "all")
    requests = requests.filter((request) => request.status === filter);

  function requestCard(request) {
    return (
      <article className="freight-card" key={request.id}>
        <div className="card-top">
          <div className="package-icon">
            <Package size={22} />
          </div>
          <span className={`status ${request.status}`}>
            {statusLabels[request.status]}
          </span>
        </div>
        <h3>{request.title}</h3>
        <small className="muted">
          {request.id} · {request.vehicle}
        </small>
        <Route request={request} />
        <div className="card-meta">
          <span>
            <Clock3 size={15} />
            {request.date
              ? new Date(`${request.date}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "short" },
                )
              : "Exemplo"}{" "}
            · {request.time}
          </span>
          <span>{request.helper ? "Com ajudante" : "Sem ajudante"}</span>
        </div>
        <button
          className="card-link"
          onClick={() => setModal({ type: "detail", id: request.id })}
        >
          {request.status === "open"
            ? area === "motorista"
              ? "Ver pedido e enviar proposta"
              : `${request.proposals.length} propostas recebidas`
            : "Ver detalhes"}
          <ArrowRight size={18} />
        </button>
      </article>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="/cliente"
          onClick={(event) => {
            event.preventDefault();
            changeArea("cliente");
          }}
          className="brand"
        >
          <img src="/assets/logo.png" alt="FreteOn" />
        </a>
        <div className="location">
          <MapPin size={16} />
          Porto Velho, RO
        </div>
        <div className="sidebar-label">
          ÁREA DO{" "}
          {area === "master" ? "ADMINISTRADOR" : areas[area].toUpperCase()}
        </div>
        <nav>
          {navigation[area].map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "selected" : ""}
              onClick={() => {
                setPage(key);
                setFilter("all");
              }}
            >
              <Icon size={20} />
              {label}
              {area === "master" &&
                key === "motoristas" &&
                pending.length > 0 && (
                  <span className="count">{pending.length}</span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={23} />
          <strong>Seu frete, sua escolha.</strong>
          <p>
            Conectando quem precisa transportar a quem está pronto para ajudar.
          </p>
          <button onClick={() => setModal({ type: "help" })}>
            <CircleHelp size={18} />
            Como funciona
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-logo">
            <img src="/assets/logo.png" alt="FreteOn" />
          </div>
          <div className="breadcrumb">
            FreteOn <ChevronRight size={14} />
            {areas[area]}
          </div>
          <div className="top-actions">
            {install && (
              <button
                className="install"
                onClick={async () => {
                  await install.prompt();
                  setInstall(null);
                }}
              >
                <Download size={17} />
                Instalar
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Notificações"
              onClick={() => setModal({ type: "notifications" })}
            >
              <Bell size={20} />
              {totalProposals > 0 && <span className="notification-dot" />}
            </button>
            <span className="avatar">
              {area === "cliente" ? "JC" : area === "motorista" ? "ML" : "AD"}
            </span>
          </div>
        </header>
        <div className="demo-bar">
          <span>
            <span className="demo-dot" />
            Demonstração · dados fictícios
          </span>
          <label>
            <span className="sr-only">Visualizar área</span>
            <select
              value={area}
              onChange={(event) => changeArea(event.target.value)}
            >
              {Object.entries(areas).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <main>
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {area === "cliente"
                  ? "VAMOS COLOCAR SEUS PLANOS EM MOVIMENTO"
                  : area === "motorista"
                    ? "SEU PRÓXIMO FRETE COMEÇA AQUI"
                    : "ADMINISTRAÇÃO FRETEON"}
              </p>
              <h1>
                {page === "inicio"
                  ? area === "cliente"
                    ? "Olá, João."
                    : area === "motorista"
                      ? "Olá, Marcos."
                      : "Visão geral"
                  : navigation[area].find((item) => item[0] === page)?.[1]}
              </h1>
              <p className="subtitle">
                {area === "cliente"
                  ? "Encontre o motorista certo para o seu frete."
                  : area === "motorista"
                    ? "Escolha os pedidos e envie o seu melhor preço."
                    : "Acompanhe a operação em Porto Velho."}
              </p>
            </div>
            {area === "cliente" && (
              <button
                className="primary"
                onClick={() => setModal({ type: "create" })}
              >
                <Plus size={19} />
                Solicitar frete
              </button>
            )}
            {area === "motorista" && (
              <button
                className={`availability ${state.available ? "online" : ""}`}
                onClick={() =>
                  setState({ ...state, available: !state.available })
                }
              >
                <span />
                {state.available ? "Disponível para fretes" : "Indisponível"}
              </button>
            )}
          </div>
          {page === "inicio" && area === "cliente" && (
            <section className="hero">
              <div>
                <span className="hero-kicker">FRETES EM PORTO VELHO</span>
                <h2>
                  Precisa levar?
                  <br />A gente conecta.
                </h2>
                <p>
                  Conte o que vai transportar, receba propostas
                  <br className="desktop-only" /> e escolha quem vai com você.
                </p>
                <button onClick={() => setModal({ type: "create" })}>
                  Pedir meu frete
                  <ArrowRight size={19} />
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="road" />
                <div className="art-pin">
                  <MapPin size={27} />
                </div>
                <Truck size={125} strokeWidth={1.3} />
                <div className="art-package">
                  <Package size={35} />
                </div>
                <span>Do seu ponto A ao ponto B.</span>
              </div>
            </section>
          )}
          {page === "inicio" && (
            <div className="stats">
              <div>
                <span className="stat-icon">
                  <Package />
                </span>
                <p>
                  {area === "master"
                    ? "Fretes ativos"
                    : area === "motorista"
                      ? "Pedidos abertos"
                      : "Em andamento"}
                  <strong>
                    {area === "motorista"
                      ? state.requests.filter(
                          (request) => request.status === "open",
                        ).length
                      : active.length}
                  </strong>
                </p>
              </div>
              <div>
                <span className="stat-icon orange">
                  <FileCheck2 />
                </span>
                <p>
                  {area === "master"
                    ? "Aguardando aprovação"
                    : area === "motorista"
                      ? "Propostas enviadas"
                      : "Propostas recebidas"}
                  <strong>
                    {area === "master"
                      ? pending.length
                      : area === "motorista"
                        ? state.requests.filter((request) =>
                            request.proposals.some(
                              (proposal) => proposal.driverId === "marcos",
                            ),
                          ).length
                        : totalProposals}
                  </strong>
                </p>
              </div>
              <div>
                <span className="stat-icon green">
                  <CheckCircle2 />
                </span>
                <p>
                  Fretes concluídos<strong>{completed.length}</strong>
                </p>
              </div>
            </div>
          )}
          {area === "master" && ["inicio", "motoristas"].includes(page) ? (
            <section>
              <div className="section-heading">
                <h2>
                  {page === "inicio"
                    ? "Motoristas aguardando aprovação"
                    : "Motoristas cadastrados"}
                </h2>
                <span className="muted">{pending.length} pendente(s)</span>
              </div>
              <div className="panel">
                {(page === "inicio" ? pending : state.drivers).map((person) => (
                  <div className="person-row" key={person.id}>
                    <span className="avatar">{person.initials}</span>
                    <div>
                      <strong>{person.name}</strong>
                      <p>{person.vehicle}</p>
                    </div>
                    <span
                      className={`status ${person.status === "approved" ? "completed" : "open"}`}
                    >
                      {person.status === "approved"
                        ? "Aprovado"
                        : person.status === "rejected"
                          ? "Reprovado"
                          : "Em análise"}
                    </span>
                    <button
                      className="secondary"
                      onClick={() =>
                        setModal({ type: "driver", driverId: person.id })
                      }
                    >
                      Analisar
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ))}
                {page === "inicio" && !pending.length && (
                  <Empty title="Análises em dia">
                    Todos os cadastros de exemplo foram analisados.
                  </Empty>
                )}
              </div>
              {page === "inicio" && (
                <div className="section-heading">
                  <h2>Atividade dos fretes</h2>
                  <button
                    className="text-button"
                    onClick={() => setPage("fretes")}
                  >
                    Ver todos
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              {page === "inicio" && (
                <div className="cards">{active.map(requestCard)}</div>
              )}
            </section>
          ) : page === "perfil" ? (
            <section className="panel profile">
              <span className="avatar large">
                {area === "cliente" ? "JC" : "ML"}
              </span>
              <h2>{area === "cliente" ? "João Cliente" : "Marcos Lima"}</h2>
              <p>Perfil de demonstração · Porto Velho, RO</p>
              {area === "motorista" && (
                <>
                  <div className="profile-item">
                    <Truck />
                    <div>
                      <strong>Meu veículo</strong>
                      <p>{driver.vehicle}</p>
                    </div>
                  </div>
                  <div className="profile-item">
                    <ShieldCheck />
                    <div>
                      <strong>Documentação aprovada — exemplo</strong>
                      <p>
                        Cadastro e documentos serão enviados na etapa de
                        operação real.
                      </p>
                    </div>
                  </div>
                </>
              )}
              <button
                className="secondary"
                onClick={() => setModal({ type: "reset" })}
              >
                Restaurar demonstração
              </button>
            </section>
          ) : page === "usuarios" ? (
            <section className="panel">
              <h2>Usuários de demonstração</h2>
              {[
                { name: "João Cliente", initials: "JC", vehicle: "Cliente" },
                ...state.drivers,
              ].map((person) => (
                <div key={person.name} className="person-row">
                  <span className="avatar">{person.initials}</span>
                  <div>
                    <strong>{person.name}</strong>
                    <p>{person.vehicle}</p>
                  </div>
                </div>
              ))}
            </section>
          ) : page === "denuncias" ? (
            <section className="panel">
              <Empty title="Nenhuma denúncia">
                As denúncias recebidas aparecerão aqui para análise.
              </Empty>
            </section>
          ) : (
            <section>
              <div className="section-heading">
                <h2>
                  {page === "historico"
                    ? "Seus fretes anteriores"
                    : area === "motorista"
                      ? "Encontre seu próximo frete"
                      : page === "inicio"
                        ? "Acompanhe seus fretes"
                        : "Todos os fretes"}
                </h2>
                {page === "inicio" && area === "cliente" && (
                  <button
                    className="text-button"
                    onClick={() => setPage("fretes")}
                  >
                    Ver todos
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              {page === "fretes" && (
                <div className="filters">
                  {[
                    ["all", "Todos"],
                    ["open", "Propostas"],
                    ["booked", "Contratados"],
                    ["transit", "Em transporte"],
                    ["completed", "Concluídos"],
                    ["cancelled", "Cancelados"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {area === "motorista" && !state.available && (
                <p className="info">
                  Você está indisponível. Ative sua disponibilidade para enviar
                  propostas.
                </p>
              )}
              <div className="cards">{requests.map(requestCard)}</div>
              {!requests.length && (
                <Empty title="Nenhum frete por aqui">
                  Novos pedidos e atualizações aparecerão nesta área.
                </Empty>
              )}
            </section>
          )}
          <footer>
            <span>FreteOn · Porto Velho, RO</span>
            <button onClick={() => setModal({ type: "help" })}>
              Precisa de ajuda?
            </button>
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Navegação principal">
          {navigation[area].map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "selected" : ""}
              onClick={() => {
                setPage(key);
                setFilter("all");
              }}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      {modal?.type === "create" && (
        <RequestForm onCreate={createRequest} onClose={() => setModal(null)} />
      )}
      {modal?.type === "detail" && selected && (
        <Modal title={selected.title} onClose={() => setModal(null)}>
          <span className={`status ${selected.status}`}>
            {statusLabels[selected.status]}
          </span>
          <Route request={selected} />
          <p>{selected.description}</p>
          <p className="muted">
            {selected.vehicle} ·{" "}
            {selected.helper ? "Com ajudante" : "Sem ajudante"} ·{" "}
            {selected.time}
          </p>
          <div className="photos">
            {selected.photos.map((photo, i) => (
              <img key={i} src={photo} alt={`Foto ${i + 1} da carga`} />
            ))}
          </div>
          {area === "motorista" && selected.status === "open" ? (
            <ProposalForm
              key={selected.id}
              request={selected}
              available={state.available}
              onSubmit={(proposal) => {
                const own = selected.proposals.find(
                  (item) => item.driverId === "marcos",
                );
                updateRequest(selected.id, {
                  proposals: [
                    ...selected.proposals.filter(
                      (item) => item.driverId !== "marcos",
                    ),
                    {
                      ...proposal,
                      id: own?.id || crypto.randomUUID(),
                      driverId: "marcos",
                    },
                  ],
                });
                setNotice(
                  "Proposta de teste enviada. Veja o resultado na área Cliente.",
                );
                setModal(null);
              }}
            />
          ) : (
            <>
              <h3>
                {selected.status === "open"
                  ? "Compare as propostas"
                  : "Proposta escolhida"}
              </h3>
              {selected.proposals
                .filter(
                  (proposal) =>
                    selected.status === "open" ||
                    proposal.id === selected.selectedId,
                )
                .map((proposal) => {
                  const person = state.drivers.find(
                    (item) => item.id === proposal.driverId,
                  );
                  return (
                    <div className="proposal" key={proposal.id}>
                      <div className="proposal-heading">
                        <span className="avatar">{person.initials}</span>
                        <div>
                          <strong>{person.name}</strong>
                          <small>
                            <Star size={13} />
                            {person.rating} · {person.trips} fretes
                          </small>
                        </div>
                        <strong className="price">
                          {money(proposal.price)}
                        </strong>
                      </div>
                      <p>
                        {person.vehicle} · Retirada às {proposal.time}
                      </p>
                      <p className="muted">{proposal.note}</p>
                      {selected.status === "open" && area === "cliente" && (
                        <button
                          className="primary full"
                          onClick={() =>
                            setModal({
                              type: "confirm",
                              id: selected.id,
                              proposalId: proposal.id,
                            })
                          }
                        >
                          Escolher motorista
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              {!selected.proposals.length && (
                <p className="info">
                  Aguardando propostas. Na demonstração, acesse Motorista para
                  enviar uma oferta.
                </p>
              )}
            </>
          )}
          {area === "motorista" &&
            selected.proposals.find(
              (proposal) => proposal.id === selected.selectedId,
            )?.driverId === "marcos" &&
            ["booked", "transit"].includes(selected.status) && (
              <button
                className="primary full"
                onClick={() =>
                  updateRequest(selected.id, {
                    status:
                      selected.status === "booked" ? "transit" : "completed",
                  })
                }
              >
                {selected.status === "booked"
                  ? "Iniciar transporte de teste"
                  : "Concluir frete de teste"}
              </button>
            )}
          {area === "cliente" && selected.status === "completed" && (
            <div className="rating">
              <h3>
                {selected.rating
                  ? `Sua avaliação: ${selected.rating} de 5`
                  : "Como foi seu frete?"}
              </h3>
              {!selected.rating &&
                [1, 2, 3, 4, 5].map((score) => (
                  <button
                    aria-label={`Avaliar com ${score} estrelas`}
                    key={score}
                    onClick={() =>
                      updateRequest(selected.id, { rating: score })
                    }
                  >
                    {score}
                    <Star size={20} />
                  </button>
                ))}
            </div>
          )}
          {area === "cliente" &&
            ["open", "booked"].includes(selected.status) && (
              <button
                className="danger-link"
                onClick={() => setModal({ type: "cancel", id: selected.id })}
              >
                Cancelar pedido
              </button>
            )}
        </Modal>
      )}
      {modal?.type === "confirm" && selected && (
        <Modal
          title="Confirmar motorista"
          onClose={() => setModal({ type: "detail", id: selected.id })}
        >
          <p>
            Você está escolhendo{" "}
            <strong>
              {
                state.drivers.find(
                  (person) =>
                    person.id ===
                    selected.proposals.find((p) => p.id === modal.proposalId)
                      .driverId,
                ).name
              }
            </strong>{" "}
            por{" "}
            <strong>
              {money(
                selected.proposals.find((p) => p.id === modal.proposalId).price,
              )}
            </strong>
            .
          </p>
          <p className="info">
            Esta contratação é uma simulação. Nenhum pagamento será realizado.
          </p>
          <button
            className="primary full"
            onClick={() => {
              updateRequest(selected.id, {
                status: "booked",
                selectedId: modal.proposalId,
              });
              setModal({ type: "detail", id: selected.id });
            }}
          >
            Confirmar contratação de teste
            <Check size={18} />
          </button>
        </Modal>
      )}
      {modal?.type === "cancel" && selected && (
        <Modal
          title="Cancelar pedido?"
          onClose={() => setModal({ type: "detail", id: selected.id })}
        >
          <p>O pedido será encerrado e deixará de receber propostas.</p>
          <button
            className="primary full"
            onClick={() => {
              updateRequest(selected.id, { status: "cancelled" });
              setModal(null);
            }}
          >
            Confirmar cancelamento
          </button>
        </Modal>
      )}
      {modal?.type === "driver" && (
        <Modal title="Análise de motorista" onClose={() => setModal(null)}>
          <h3>
            {state.drivers.find((person) => person.id === modal.driverId).name}
          </h3>
          <p>
            {
              state.drivers.find((person) => person.id === modal.driverId)
                .vehicle
            }
          </p>
          <div className="review">
            <FileCheck2 />
            <h3>Documentos de demonstração</h3>
            <p>
              Esta tela demonstra a análise do cadastro. Documentos reais serão
              recebidos na próxima etapa.
            </p>
          </div>
          <div className="form-actions">
            <button
              className="secondary"
              onClick={() => {
                setState({
                  ...state,
                  drivers: state.drivers.map((person) =>
                    person.id === modal.driverId
                      ? { ...person, status: "rejected" }
                      : person,
                  ),
                });
                setModal(null);
              }}
            >
              Reprovar exemplo
            </button>
            <button
              className="primary"
              onClick={() => {
                setState({
                  ...state,
                  drivers: state.drivers.map((person) =>
                    person.id === modal.driverId
                      ? { ...person, status: "approved" }
                      : person,
                  ),
                });
                setModal(null);
              }}
            >
              Aprovar exemplo
              <Check size={18} />
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "notifications" && (
        <Modal title="Notificações de exemplo" onClose={() => setModal(null)}>
          {active
            .filter((request) => request.proposals.length)
            .map((request) => (
              <button
                className="notification-row"
                key={request.id}
                onClick={() => setModal({ type: "detail", id: request.id })}
              >
                <Bell size={20} />
                <span>
                  <strong>{request.title}</strong>
                  <small>
                    {request.proposals.length} proposta(s) recebida(s)
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          {!totalProposals && <p>Sem novas propostas.</p>}
        </Modal>
      )}
      {modal?.type === "help" && (
        <Modal title="Como funciona o FreteOn" onClose={() => setModal(null)}>
          <div className="help-step">
            <MapPin />
            <div>
              <h3>Conte o que precisa levar</h3>
              <p>Informe retirada, entrega, carga e horário.</p>
            </div>
          </div>
          <div className="help-step">
            <FileCheck2 />
            <div>
              <h3>Compare as propostas</h3>
              <p>Veja preço, veículo e informações do motorista.</p>
            </div>
          </div>
          <div className="help-step">
            <Truck />
            <div>
              <h3>Escolha e acompanhe</h3>
              <p>Confirme o motorista e avalie após a entrega.</p>
            </div>
          </div>
          <p className="info">
            Prévia para aprovação. Os dados ficam neste navegador. Cadastro,
            documentos, denúncias e notificações reais serão integrados na
            próxima etapa.
          </p>
        </Modal>
      )}
      {modal?.type === "reset" && (
        <Modal title="Restaurar demonstração?" onClose={() => setModal(null)}>
          <p>
            Os pedidos de teste deste navegador serão substituídos pelos
            exemplos iniciais.
          </p>
          <button
            className="primary full"
            onClick={() => {
              setState(structuredClone(initialState));
              setModal(null);
              setNotice("Demonstração restaurada.");
            }}
          >
            Restaurar exemplos
          </button>
        </Modal>
      )}
    </div>
  );
}

function ProposalForm({ request, available, onSubmit }) {
  const previous = request.proposals.find(
    (proposal) => proposal.driverId === "marcos",
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({
          price: Number(data.get("price")),
          time: data.get("time"),
          note: data.get("note").trim(),
        });
      }}
    >
      <h3>{previous ? "Atualizar minha proposta" : "Enviar proposta"}</h3>
      <div className="form-grid">
        <label>
          Seu preço (R$)
          <input
            type="number"
            name="price"
            required
            min="1"
            max="100000"
            step="0.01"
            defaultValue={previous?.price}
            placeholder="0,00"
          />
        </label>
        <label>
          Horário de retirada
          <input
            type="time"
            name="time"
            required
            defaultValue={previous?.time || request.time}
          />
        </label>
      </div>
      <label>
        O que está incluído?
        <textarea
          name="note"
          required
          maxLength={400}
          defaultValue={previous?.note}
          placeholder="Ajudante, proteção da carga e outras informações"
        />
      </label>
      <button className="primary full" disabled={!available}>
        {available ? "Enviar proposta de teste" : "Ative sua disponibilidade"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
