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
import { money, statusLabels } from "./format.js";
import { api } from "./api.js";

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
function Modal({ title, onClose, children, error, busy }) {
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Salvando…</p>}
      <fieldset disabled={busy}>{children}</fieldset>
    </dialog>
  );
}

function RequestForm({ onCreate, onClose, requestError }) {
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
  async function submit(event) {
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
    setLoading(true);
    try {
      await onCreate(data);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal title="Solicitar frete" onClose={onClose} error={requestError}>
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
            {step === 2 ? "Publicar pedido" : "Continuar"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function App({ user, onLogout, onExpired }) {
  const area = user.role;
  const [state, setState] = useState({
    requests: [],
    drivers: [],
    users: [],
    available: false,
    user,
  });
  const [page, setPage] = useState("inicio");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [install, setInstall] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  function showError(error) {
    if (error.status === 401) onExpired();
    else setNotice(error.message);
  }
  async function refresh() {
    const data = await api("/state");
    if (mounted.current) {
      setState(data);
      setLoaded(true);
    }
  }
  useEffect(() => {
    mounted.current = true;
    refresh().catch(showError);
    const interval = setInterval(() => {
      if (!document.hidden && !inFlight.current) refresh().catch(showError);
    }, 15000);
    const handler = (event) => {
      event.preventDefault();
      setInstall(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);
  async function mutate(path, method, body, after) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    try {
      await api(path, { method, body });
      await refresh();
      after?.();
      return true;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function updateRequest(id, patch) {
    return mutate(`/requests/${id}`, "PATCH", patch);
  }
  async function createRequest(data) {
    return mutate("/requests", "POST", data, () => {
      setModal(null);
      setPage("fretes");
      setNotice("Pedido publicado. Aguarde as propostas dos motoristas.");
    });
  }
  function reviewDriver(status) {
    return mutate(`/drivers/${modal.driverId}`, "PATCH", { status }, () =>
      setModal(null),
    );
  }
  async function logout() {
    try {
      await onLogout();
    } catch (error) {
      showError(error);
    }
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
  const driver =
    state.drivers.find((person) => person.id === user.id) || state.user;
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
            request.proposals.some((proposal) => proposal.driverId === user.id),
          )
        : state.requests.filter(
            (request) =>
              request.status === "open" ||
              (request.proposals.find(
                (proposal) => proposal.id === request.selectedId,
              )?.driverId === user.id &&
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
              : "Sem data"}{" "}
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
      {busy && (
        <div className="operation-status" role="status">
          Salvando…
        </div>
      )}

      <aside className="sidebar">
        <a href="/" className="brand">
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
            <span className="avatar">{state.user.initials}</span>
          </div>
        </header>
        <div className="account-bar">
          <span>
            {state.user.name} · {areas[area]}
          </span>
          <button onClick={logout}>Sair da conta</button>
        </div>
        <main>
          {!loaded && <p role="status">Carregando seus dados…</p>}
          {area === "motorista" && state.user.status !== "approved" && (
            <p className="info" role="status">
              {state.user.status === "rejected"
                ? "Seu cadastro foi reprovado. Procure a administração."
                : "Cadastro recebido! Aguarde a aprovação do administrador para receber pedidos e enviar propostas."}
            </p>
          )}

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
                    ? `Olá, ${state.user.name.split(" ")[0]}.`
                    : area === "motorista"
                      ? `Olá, ${state.user.name.split(" ")[0]}.`
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
                  mutate("/availability", "PATCH", {
                    available: !state.available,
                  })
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
                              (proposal) => proposal.driverId === user.id,
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
                      <p>
                        {person.vehicle || areas[person.role]}{" "}
                        {area === "master" && person.phone
                          ? `· ${person.phone}`
                          : ""}
                      </p>
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
                    Todos os cadastros foram analisados.
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
              <span className="avatar large">{state.user.initials}</span>
              <h2>{state.user.name}</h2>
              <p>{state.user.phone} · Porto Velho, RO</p>
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
                      <strong>Situação do cadastro</strong>
                      <p>
                        {driver.status === "approved"
                          ? "Cadastro aprovado."
                          : driver.status === "rejected"
                            ? "Cadastro reprovado. Entre em contato com a administração."
                            : "Aguardando aprovação do administrador."}{" "}
                        A verificação documental será adicionada em uma próxima
                        etapa.
                      </p>
                    </div>
                  </div>
                </>
              )}
              <button className="secondary" onClick={logout}>
                Sair da conta
              </button>
            </section>
          ) : page === "usuarios" ? (
            <section className="panel">
              <h2>Usuários cadastrados</h2>
              {state.users.map((person) => (
                <div key={person.id} className="person-row">
                  <span className="avatar">{person.initials}</span>
                  <div>
                    <strong>{person.name}</strong>
                    <p>
                      {person.vehicle || areas[person.role]}{" "}
                      {area === "master" && person.phone
                        ? `· ${person.phone}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          ) : page === "denuncias" ? (
            <section className="panel">
              <Empty title="Nenhuma denúncia">
                O envio de denúncias estará disponível em uma próxima etapa.
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
        <RequestForm
          requestError={notice}
          onCreate={createRequest}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "detail" && selected && (
        <Modal
          error={notice}
          busy={busy}
          title={selected.title}
          onClose={() => setModal(null)}
        >
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
              available={
                state.available && state.user.status === "approved" && !busy
              }
              driverId={user.id}
              onSubmit={(proposal) =>
                mutate(
                  `/requests/${selected.id}/proposals`,
                  "POST",
                  proposal,
                  () => {
                    setModal(null);
                    setNotice("Proposta enviada ao cliente.");
                  },
                )
              }
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
                            {person?.rating || "Novo"} · {person?.trips || 0}{" "}
                            fretes
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
                  Aguardando propostas dos motoristas disponíveis.
                </p>
              )}
            </>
          )}
          {area === "motorista" &&
            selected.proposals.find(
              (proposal) => proposal.id === selected.selectedId,
            )?.driverId === user.id &&
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
                  ? "Iniciar transporte"
                  : "Concluir frete"}
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
          error={notice}
          busy={busy}
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
            Combine o pagamento diretamente com o motorista. O FreteOn registra
            sua contratação.
          </p>
          <button
            className="primary full"
            onClick={async () => {
              if (
                await updateRequest(selected.id, {
                  status: "booked",
                  selectedId: modal.proposalId,
                })
              )
                setModal({ type: "detail", id: selected.id });
            }}
          >
            Confirmar contratação
            <Check size={18} />
          </button>
        </Modal>
      )}
      {modal?.type === "cancel" && selected && (
        <Modal
          error={notice}
          busy={busy}
          title="Cancelar pedido?"
          onClose={() => setModal({ type: "detail", id: selected.id })}
        >
          <p>O pedido será encerrado e deixará de receber propostas.</p>
          <button
            className="primary full"
            onClick={async () => {
              if (await updateRequest(selected.id, { status: "cancelled" }))
                setModal(null);
            }}
          >
            Confirmar cancelamento
          </button>
        </Modal>
      )}
      {modal?.type === "driver" && (
        <Modal
          error={notice}
          busy={busy}
          title="Análise de motorista"
          onClose={() => setModal(null)}
        >
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
            <h3>Análise do cadastro</h3>
            <p>
              Celular:{" "}
              {
                state.drivers.find((person) => person.id === modal.driverId)
                  .phone
              }
            </p>
            <p>
              Confira o nome, o telefone e o veículo do motorista antes de
              aprovar. O envio de documentos será adicionado em uma próxima
              etapa.
            </p>
          </div>
          <div className="form-actions">
            <button
              className="secondary"
              onClick={() => reviewDriver("rejected")}
            >
              Reprovar cadastro
            </button>
            <button
              className="primary"
              onClick={() => reviewDriver("approved")}
            >
              Aprovar cadastro
              <Check size={18} />
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "notifications" && (
        <Modal
          error={notice}
          busy={busy}
          title="Atualizações dos fretes"
          onClose={() => setModal(null)}
        >
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
        <Modal
          error={notice}
          busy={busy}
          title="Como funciona o FreteOn"
          onClose={() => setModal(null)}
        >
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
            Pedidos e propostas ficam salvos na sua conta. O painel verifica
            atualizações a cada 15 segundos. O pagamento é combinado diretamente
            entre cliente e motorista.
          </p>
        </Modal>
      )}
    </div>
  );
}

function ProposalForm({ request, available, driverId, onSubmit }) {
  const previous = request.proposals.find(
    (proposal) => proposal.driverId === driverId,
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
        {available ? "Enviar proposta" : "Ative sua disponibilidade"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
