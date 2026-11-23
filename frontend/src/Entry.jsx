import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  Package,
  ShieldCheck,
  Eye,
  EyeOff,
  MapPin,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import Dashboard from "./App.jsx";
import { RecoveryRequest, RecoveryReset } from "./PasswordRecovery.jsx";
import { api } from "./api.js";
import InstallInvitation from "./InstallInvitation.jsx";
import LegalPage, { LEGAL_VERSION } from "./LegalPage.jsx";
import LegalAcceptanceGate from "./LegalAcceptanceGate.jsx";
import StaffPasswordChange from "./StaffPasswordChange.jsx";

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
    // Revoga apenas este dispositivo no banco, preservando os avisos
    // dos outros celulares. A inscrição Web Push local pode ser reutilizada
    // quando o usuário entrar novamente e habilitar os avisos.
    let pushEndpoint = "";
    if ("serviceWorker" in navigator && "PushManager" in window) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        pushEndpoint = subscription?.endpoint || "";
      } catch { /* ausência de push não bloqueia o logout */ }
    }
    await api("/auth/logout", { method: "POST", body: { pushEndpoint } });
    setSessions((previous) => {
      const next = { ...previous };
      delete next[role];
      return next;
    });
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
  if (area === "master" && user?.role === "master" && user.mustChangePassword) {
    return <StaffPasswordChange account={user} onLogout={logout} onComplete={()=>{
      setSessions(previous=>{const next={...previous};delete next.master;return next;});
      navigate("/master");
    }}/>;
  }
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
        adminSessionAvailable={Boolean(sessions.master)}
        onLogout={logout}
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
        <div className="public-header-actions">
          <span className="public-header-location"><MapPin size={15} aria-hidden="true"/> Porto Velho, RO</span>
          {path === "/" && <>
            <a className="public-header-login" href="/cliente"
              onClick={event => { event.preventDefault(); navigate("/cliente"); }}>
              Acessar <ArrowRight size={16} aria-hidden="true"/>
            </a>
            {sessions.master && <a className="public-header-admin" href="/master" aria-label="Abrir meu painel administrativo"
              onClick={event => { event.preventDefault(); navigate("/master"); }}>
              <ShieldCheck size={19} aria-hidden="true"/>
            </a>}
          </>}
        </div>
      </header>
      {path === "/recuperar-senha" ? <RecoveryReset onBack={() => navigate("/cliente")}/> : (area === "cliente" || area === "motorista") && path.endsWith("/esqueci-senha") ? <RecoveryRequest role={area} onBack={() => navigate(`/${area}`)}/> : path === "/termos" || path === "/privacidade" ? (
        <LegalPage kind={path === "/termos" ? "termos" : "privacidade"} navigate={navigate} />
      ) : path === "/" ? (
        <main className="public-home public-home-refined">
          <div className="public-home-stage">
            <section className="public-copy" aria-labelledby="public-home-title">
              <span className="public-location-chip"><MapPin size={15} aria-hidden="true"/> FRETES EM PORTO VELHO</span>
              <h1 id="public-home-title">Seu frete.<br/><em>Sua escolha.</em></h1>
              <p>Descreva o que precisa transportar, receba propostas e escolha o motorista ideal para você.</p>
              <div className="public-cta-group">
                <a className="public-cta-primary" href="/cliente"
                  onClick={event => { event.preventDefault(); navigate("/cliente"); }}>
                  <Package size={21} aria-hidden="true"/>
                  <span>Solicitar meu frete</span>
                  <ArrowRight size={19} aria-hidden="true"/>
                </a>
                <a className="public-cta-secondary" href="/motorista"
                  onClick={event => { event.preventDefault(); navigate("/motorista"); }}>
                  <Truck size={21} aria-hidden="true"/>
                  <span>Sou motorista</span>
                  <ArrowRight size={18} aria-hidden="true"/>
                </a>
              </div>
              <div className="public-trust-note"><ShieldCheck size={18} aria-hidden="true"/>
                <span>Motoristas passam por verificação documental antes de enviar propostas.</span>
              </div>
            </section>
            <aside className="public-journey-card" aria-label="Como o frete acontece">
              <div className="public-journey-header">
                <span><Truck size={18} aria-hidden="true"/> FreteOn</span>
                <span className="public-journey-state">Simples de usar</span>
              </div>
              <div className="public-journey-illustration" aria-hidden="true">
                <div className="public-journey-route">
                  <span className="public-route-node"><Package size={24}/></span>
                  <span className="public-route-dashes"/>
                  <span className="public-route-node public-route-node-end"><MapPin size={25}/></span>
                </div>
              </div>
              <h2>Da retirada à entrega, tudo mais simples.</h2>
              <p>Você combina o preço com o motorista e acompanha seu pedido em um só lugar.</p>
              <div className="public-journey-footer">
                <span><MessageSquare size={17} aria-hidden="true"/> Propostas em um só lugar</span>
                <span><CheckCircle2 size={17} aria-hidden="true"/> Você decide</span>
              </div>
            </aside>
          </div>
          <section className="public-how" aria-labelledby="public-how-title">
            <div className="public-how-heading">
              <span>SEM COMPLICAÇÃO</span>
              <h2 id="public-how-title">Como funciona</h2>
            </div>
            <div className="public-how-steps">
              <div><span className="public-how-icon"><Package size={23}/></span>
                <strong>1. Solicite</strong>
                <p>Informe a retirada, a entrega e o que será transportado.</p>
              </div>
              <div><span className="public-how-icon"><MessageSquare size={23}/></span>
                <strong>2. Compare</strong>
                <p>Receba propostas dos motoristas e escolha a melhor para você.</p>
              </div>
              <div><span className="public-how-icon"><CheckCircle2 size={23}/></span>
                <strong>3. Contrate</strong>
                <p>Confirme sua escolha e acompanhe a realização do frete.</p>
              </div>
            </div>
          </section>
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
      <footer className="public-footer rubli-footer">
        <div className="rubli-footer-brand">
          <strong>Frete<span>On</span></strong>
          <small>Conectando você ao frete certo.</small>
        </div>
        <nav className="rubli-footer-links" aria-label="Links institucionais">
          <a href="/privacidade" onClick={event => { event.preventDefault(); navigate("/privacidade"); }}>Privacidade</a>
          <a href="/termos" onClick={event => { event.preventDefault(); navigate("/termos"); }}>Termos de Uso</a>
        </nav>
        <p className="rubli-footer-credit">© {new Date().getFullYear()} FreteOn · Uma plataforma do <strong>Grupo Rubli</strong>. O FreteOn atua na intermediação de fretes entre clientes e motoristas parceiros.</p>
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
  const [appealAuth, setAppealAuth] = useState(null);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealError, setAppealError] = useState("");
  const [appealResult, setAppealResult] = useState(null);
  async function submitAppeal(event) {
    event.preventDefault();
    if (!appealAuth || appealBusy || appealText.trim().length < 15) return;
    setAppealBusy(true); setAppealError(""); setAppealMessage("");
    try {
      const data = await api("/auth/blocked-appeal", {
        method: "POST", body: { ...appealAuth, message: appealText.trim() },
      });
      setAppealMessage(data.message);
      setAppealResult({ status: data.status });
      setAppealText(""); setAppealOpen(false);
    } catch (e) { setAppealError(e.message); }
    finally { setAppealBusy(false); }
  }
  async function checkAppeal() {
    if (!appealAuth || appealBusy) return;
    setAppealBusy(true); setAppealError(""); setAppealMessage("");
    try {
      setAppealResult(await api("/auth/blocked-appeal/status", {
        method: "POST", body: appealAuth,
      }));
    } catch (e) { setAppealError(e.message); }
    finally { setAppealBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    setAppealAuth(null); setAppealOpen(false); setAppealError("");
    setAppealMessage(""); setAppealResult(null);
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
      if (!register && ["cliente", "motorista"].includes(area) &&
          error.code === "ACCOUNT_BLOCKED") {
        // Guardar credenciais apenas nesta tela, em memória; não enviar nem salvar
        // a senha junto ao registro administrativo da contestação.
        setAppealAuth({ role: area, phone: fields.phone, password: fields.password });
        setAppealOpen(true);
      }
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
              {!register && area !== "master" && <div style={{textAlign:"right", margin:"-4px 0 12px"}}><button type="button" className="text-button" onClick={() => navigate(`/${area}/esqueci-senha`)}>Esqueci minha senha</button></div>}
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
        {appealAuth && !register && !user && <section className="blocked-account-appeal" aria-label="Solicitar revisão do bloqueio">
          <h2>Fale com a equipe FreteOn</h2>
          <p>Você pode solicitar a revisão do bloqueio sem entrar na conta. Basta explicar o ocorrido. A equipe receberá sua mensagem no painel Master.</p>
          {appealOpen && <form onSubmit={submitAppeal}>
            <label>Conte o que aconteceu
              <textarea value={appealText} required minLength={15} maxLength={500} rows={3}
                placeholder="Explique brevemente por que deseja a revisão..."
                onChange={e => setAppealText(e.target.value)}/>
            </label>
            <button type="submit" className="primary full"
              disabled={appealBusy || appealText.trim().length < 15}>
              {appealBusy ? "Enviando..." : "Enviar pedido de revisão"}
            </button>
          </form>}
          <div className="blocked-account-appeal-actions">
            {!appealOpen && <button type="button" className="secondary"
              onClick={()=>{setAppealOpen(true);setAppealError("");}}>Solicitar nova revisão</button>}
            <button type="button" className="secondary" disabled={appealBusy} onClick={checkAppeal}>
              Consultar resposta da equipe
            </button>
          </div>
          {appealMessage && <p className="info" role="status">{appealMessage}</p>}
          {appealResult?.status === "pending" && <p className="info" role="status">Sua solicitação está aguardando análise pelo Master.</p>}
          {appealResult?.status === "reviewed" && <p className="info" role="status">
            <strong>Resposta da equipe:</strong> {appealResult.reviewNote || "Sua solicitação foi analisada."}
          </p>}
          {appealResult?.status === "none" && <p className="muted">Nenhuma solicitação encontrada para esta conta.</p>}
          {appealError && <p className="error" role="alert">{appealError}</p>}
          <small>Não compartilhe sua senha, códigos, dados bancários ou documentos na mensagem.</small>
        </section>}
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
        {area === "master" && (
          <p className="auth-alternative">Acesso exclusivo à administração.</p>
        )}
      </section>
    </main>
  );
}
