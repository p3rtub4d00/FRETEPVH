import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  Package,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import Dashboard from "./App.jsx";
import { api } from "./api.js";
import RoleSwitcher from "./RoleSwitcher.jsx";
import InstallInvitation from "./InstallInvitation.jsx";
import LegalPage, { LEGAL_VERSION } from "./LegalPage.jsx";
import LegalAcceptanceGate from "./LegalAcceptanceGate.jsx";

const titles = {
  cliente: "Cliente",
  motorista: "Motorista",
  master: "Administrador Master",
};
export default function Entry() {
  const [path, setPath] = useState(location.pathname);
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState("");
  function navigate(next) {
    history.pushState({}, "", next);
    setPath(next);
    setError("");
    window.scrollTo?.({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const pop = () => {
      setPath(location.pathname);
      setError("");
    };
    window.addEventListener("popstate", pop);
    api("/auth/sessions")
      .then((data) => setSessions(data.sessions || {}))
      .catch((error) => {
        if (error.status !== 401) setError(error.message);
      })
      .finally(() => setLoading(false));
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    // Captura a oportunidade de instalação desde a primeira visita, inclusive
    // antes do login. Sem instalação automática nem perda de acesso no navegador.
    const capture = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const completed = () => {
      setInstallEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", completed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", completed);
    };
  }, []);
  function authenticated(account) {
    setSessions((previous) => ({ ...previous, [account.role]: account }));
    navigate(`/${account.role}`);
  }
  async function logout() {
    const role = location.pathname.split("/")[1];
    await api("/auth/logout", { method: "POST", body: {} });
    setSessions((previous) => {
      const next = { ...previous };
      delete next[role];
      return next;
    });
    navigate(`/${role}`);
  }
  function switchRole(role) {
    navigate(`/${role}`);
  }
  const area = path.split("/")[1];
  const user = sessions[area] || null;
  const legalAccepted = area === "master" || (user?.termsVersion === LEGAL_VERSION && user?.privacyNoticeVersion === LEGAL_VERSION);
  const invitation = (
    <InstallInvitation
      pathname={path}
      installEvent={installEvent}
      onConsumeInstall={() => setInstallEvent(null)}
      installed={installed}
    />
  );
  if (loading)
    return (
      <div className="auth-loading" role="status">
        Carregando FreteOn…
      </div>
    );
  if (titles[area] && user?.role === area && !path.includes("/cadastro") &&
      !legalAccepted) {
    return (
      <LegalAcceptanceGate
        account={user}
        onAccepted={account => setSessions(previous => ({ ...previous, [account.role]: account }))}
        onLogout={logout}
      />
    );
  }
  if (titles[area] && user?.role === area && !path.includes("/cadastro"))
    return (
      <>
      <Dashboard
        key={user.id}
        user={user}
        onLogout={logout}
        sessions={sessions}
        onSwitchRole={switchRole}
        onExpired={() => {
          setSessions((previous) => {
            const next = { ...previous };
            delete next[area];
            return next;
          });
          setError("Sua sessão expirou. Entre novamente.");
        }}
      />
      {invitation}
      </>
    );
  return (
    <>
    <div className="public-site">
      <header className="public-header">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <img src="/assets/logo.png" alt="FreteOn — início" />
        </a>
        {Object.keys(sessions).length ? (
          <RoleSwitcher
            activeRole={area}
            sessions={sessions}
            onSwitch={switchRole}
          />
        ) : (
          <span>Porto Velho, RO</span>
        )}
      </header>
      {path === "/termos" || path === "/privacidade" ? (
        <LegalPage kind={path === "/termos" ? "termos" : "privacidade"} navigate={navigate} />
      ) : path === "/" ? (
        <main className="public-home">
          <div className="public-copy">
            <span className="eyebrow">FRETES EM PORTO VELHO</span>
            <h1>
              Seu frete.
              <br />
              <em>Sua escolha.</em>
            </h1>
            <p>
              Receba propostas de motoristas, compare os preços e escolha quem
              vai transportar sua carga.
            </p>
            <div className="entry-cards">
              <a
                href="/cliente"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/cliente");
                }}
              >
                <Package />
                <strong>Preciso de um frete</strong>
                <span>Solicite e compare propostas.</span>
                <ArrowRight />
              </a>
              <a
                href="/motorista"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/motorista");
                }}
              >
                <Truck />
                <strong>Sou motorista</strong>
                <span>Encontre pedidos e envie seu preço.</span>
                <ArrowRight />
              </a>
            </div>
          </div>
          <aside className="public-promise">
            <Truck size={100} strokeWidth={1.2} />
            <h2>
              Do seu ponto A<br />
              ao ponto B.
            </h2>
            <p>Retirada, entrega e propostas organizadas em um só lugar.</p>
            <div>
              <ShieldCheck size={20} />
              Motoristas aprovados pela administração
            </div>
          </aside>
        </main>
      ) : titles[area] ? (
        <AuthForm
          key={path}
          area={area}
          register={path.endsWith("/cadastro") && area !== "master"}
          user={user}
          error={error}
          navigate={navigate}
          authenticated={authenticated}
          logout={logout}
        />
      ) : (
        <main className="public-home">
          <div>
            <h1>Página não encontrada</h1>
            <button className="primary" onClick={() => navigate("/")}>
              Voltar ao início
            </button>
          </div>
        </main>
      )}
      <footer className="public-footer">
        <span>FreteOn · Porto Velho, RO</span>
        <div className="public-legal-links">
          <a href="/termos" onClick={event => { event.preventDefault(); navigate("/termos"); }}>Termos de Uso</a>
          <a href="/privacidade" onClick={event => { event.preventDefault(); navigate("/privacidade"); }}>Política de Privacidade</a>
        </div>
        <span>Intermediação de fretes · Financeiro em simulação</span>
      </footer>
    </div>
    {invitation}
    </>
  );
}

function AuthForm({
  area,
  register,
  user,
  error: initialError,
  navigate,
  authenticated,
  logout,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [visible, setVisible] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (register && fields.password !== fields.confirmPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    if (register && (fields.termsAccepted !== "yes" || fields.privacyAcknowledged !== "yes")) {
      setError("Leia e aceite os Termos de Uso e confirme a ciência da Política de Privacidade.");
      return;
    }
    fields.termsAccepted = fields.termsAccepted === "yes";
    fields.privacyAcknowledged = fields.privacyAcknowledged === "yes";
    setBusy(true);
    try {
      const result = await api(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: { ...fields, role: area },
      });
      authenticated(result.user);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <button className="text-button" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          Voltar ao início
        </button>
        <span className="auth-icon">
          {area === "motorista" ? (
            <Truck />
          ) : area === "master" ? (
            <ShieldCheck />
          ) : (
            <Package />
          )}
        </span>
        <p className="eyebrow">{titles[area]}</p>
        <h1>{register ? "Crie sua conta" : "Bem-vindo de volta"}</h1>
        <p className="muted">
          {register
            ? "Cadastre-se com seu nome, celular e senha."
            : "Entre com seu celular e sua senha."}
        </p>
        {user ? (
          <>
            <p className="info">
              Você está conectado como {titles[user.role]}. Acesse seu painel ou
              saia para entrar em outra conta.
            </p>
            <button
              className="primary full"
              onClick={() => navigate(`/${user.role}`)}
            >
              Ir para meu painel
            </button>
            <button
              className="secondary full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await logout();
                } catch (error) {
                  setError(error.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sair desta conta
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {register && (
                <label>
                  Nome completo
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    minLength={3}
                    maxLength={100}
                    placeholder="Seu nome completo"
                  />
                </label>
              )}
              <label>
                Celular com DDD
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  maxLength={20}
                  placeholder="(69) 99999-9999"
                />
              </label>
              {register && area === "motorista" && (
                <label>
                  Veículo
                  <input
                    name="vehicle"
                    required
                    minLength={3}
                    maxLength={100}
                    placeholder="Ex. Fiat Strada, picape, ano 2020"
                  />
                </label>
              )}
              <label>
                Senha
                <div className="password-field">
                  <input
                    name="password"
                    type={visible ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    placeholder="Pelo menos 8 caracteres"
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>
              {register && (
                <label>
                  Confirme sua senha
                  <input
                    name="confirmPassword"
                    type={visible ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              )}
              {register && area === "motorista" && (
                <p className="info">
                  Após o cadastro, aguarde a aprovação do administrador para
                  receber pedidos e enviar propostas.
                </p>
              )}
              {register && (
                <div className="legal-register-checks">
                  <label className="legal-check">
                    <input type="checkbox" name="termsAccepted" value="yes" required/>
                    <span>Li e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a>, incluindo regras de transporte, pagamento e comissão.</span>
                  </label>
                  <label className="legal-check">
                    <input type="checkbox" name="privacyAcknowledged" value="yes" required/>
                    <span>Li e tomei ciência da <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</span>
                  </label>
                  <small>O registro dessas declarações não representa consentimento genérico para todo tratamento de dados.</small>
                </div>
              )}
              <button className="primary full" type="submit">
                {busy ? "Aguarde…" : register ? "Criar minha conta" : "Entrar"}
                <ArrowRight size={18} />
              </button>
            </fieldset>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!user && area !== "master" && (
          <p className="auth-alternative">
            {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <a
              href={register ? `/${area}` : `/${area}/cadastro`}
              onClick={(event) => {
                event.preventDefault();
                navigate(register ? `/${area}` : `/${area}/cadastro`);
              }}
            >
              {register ? "Entrar" : "Cadastre-se"}
            </a>
          </p>
        )}
        <p className="auth-legal-links">
          <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
          {" · "}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
        </p>
        {area === "master" && (
          <p className="auth-alternative">Acesso exclusivo à administração.</p>
        )}
      </section>
    </main>
  );
}
