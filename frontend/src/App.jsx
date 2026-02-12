import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

const theme = {
  primary: '#111827',
  accent: '#FACC15',
  bg: '#F3F4F6',
  white: '#FFFFFF',
  green: '#22C55E',
  blue: '#2563EB',
  danger: '#DC2626',
  text: '#111827',
  muted: '#6B7280'
};

const styles = {
  wrapper: { minHeight: '100vh', background: theme.bg, display: 'flex', justifyContent: 'center', fontFamily: 'Inter, sans-serif' },
  container: { width: '100%', maxWidth: '760px', background: theme.white, minHeight: '100vh', boxShadow: '0 10px 35px rgba(0,0,0,0.08)' },
  header: { background: theme.primary, color: theme.white, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: '24px' },
  card: { border: '1px solid #E5E7EB', borderRadius: 14, padding: 16, marginBottom: 14, background: '#FFF' },
  title: { marginTop: 0, marginBottom: 4, color: theme.text },
  input: { width: '100%', boxSizing: 'border-box', marginBottom: 10, border: '1px solid #D1D5DB', borderRadius: 10, padding: '12px 13px', fontSize: 15 },
  select: { width: '100%', boxSizing: 'border-box', marginBottom: 10, border: '1px solid #D1D5DB', borderRadius: 10, padding: '12px 13px', fontSize: 15, background: 'white' },
  btn: { border: 'none', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', fontWeight: 700 },
  btnPrimary: { background: theme.primary, color: theme.accent, width: '100%' },
  btnGreen: { background: theme.green, color: '#fff', width: '100%' },
  btnGhost: { background: '#F3F4F6', color: theme.text },
  err: { color: theme.danger, marginTop: -4, marginBottom: 8, fontSize: 13 },
  info: { color: theme.muted, fontSize: 13 },
  badge: { display: 'inline-block', padding: '3px 8px', fontSize: 12, borderRadius: 999, background: '#EEF2FF', color: '#3730A3', fontWeight: 600 },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap' }
};

const storage = {
  getSession: () => JSON.parse(localStorage.getItem('session') || 'null'),
  setSession: (session) => localStorage.setItem('session', JSON.stringify(session)),
  clearSession: () => localStorage.removeItem('session'),
  setDraft: (payload) => localStorage.setItem('rideDraft', JSON.stringify(payload)),
  getDraft: () => JSON.parse(localStorage.getItem('rideDraft') || 'null'),
  setClientRides: (rides) => localStorage.setItem('clientRidesCache', JSON.stringify(rides)),
  getClientRides: () => JSON.parse(localStorage.getItem('clientRidesCache') || '[]'),
  setDriverRides: (rides) => localStorage.setItem('driverRidesCache', JSON.stringify(rides)),
  getDriverRides: () => JSON.parse(localStorage.getItem('driverRidesCache') || '[]')
};

const request = async (url, { token, method = 'GET', body } = {}) => {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Falha na requisição');
  }

  return data;
};

const calcEstimate = ({ vehicleType, distance, needHelper }) => {
  const baseByType = { MOTO: 18, CARRO: 40, CAMINHAO: 120 };
  const distByType = { PERTO: 1, MEDIO: 1.5, LONGE: 2.5 };
  const base = baseByType[vehicleType] || 40;
  const distanceFactor = distByType[distance] || 1;
  const helper = vehicleType === 'MOTO' ? 0 : (needHelper ? 30 : 0);
  const subtotal = base * distanceFactor;
  const fee = Math.round(subtotal * 0.08);
  const total = subtotal + helper + fee;

  return {
    subtotal: Math.round(subtotal),
    helper,
    fee,
    total: Math.round(total),
    totalRange: `R$ ${Math.round(total)} - R$ ${Math.round(total * 1.2)}`
  };
};

const FieldError = ({ text }) => (text ? <div style={styles.err}>{text}</div> : null);

function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'CLIENT',
    vehicleType: 'CARRO',
    carModel: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const session = storage.getSession();
    if (session?.token && session?.user) {
      navigate(session.user.role === 'DRIVER' ? '/motorista' : '/cliente');
    }
  }, [navigate]);

  const validate = () => {
    const errors = {};

    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Digite um e-mail válido.';
    if (!form.password || form.password.length < 6) errors.password = 'A senha precisa ter pelo menos 6 caracteres.';

    if (!isLogin) {
      if (!form.name || form.name.trim().length < 3) errors.name = 'Informe o nome completo.';
      const cleanPhone = form.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) errors.phone = 'WhatsApp inválido. Use DDD + número.';
      if (form.role === 'DRIVER' && !form.carModel.trim()) errors.carModel = 'Informe o modelo do veículo.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async () => {
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const data = await request(endpoint, { method: 'POST', body: form });
      storage.setSession(data);
      navigate(data.user.role === 'DRIVER' ? '/motorista' : '/cliente');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={{ ...styles.header, flexDirection: 'column', alignItems: 'center', gap: 8, padding: '36px 20px' }}>
          <h1 style={{ margin: 0, color: theme.accent }}>99Frete PVH</h1>
          <span style={{ opacity: 0.9 }}>Frete com segurança e transparência</span>
        </div>
        <div style={styles.content}>
          <h2 style={styles.title}>{isLogin ? 'Entrar na conta' : 'Criar conta'}</h2>
          {!isLogin && (
            <>
              <input style={styles.input} placeholder="Nome completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <FieldError text={fieldErrors.name} />
            </>
          )}

          <input style={styles.input} placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <FieldError text={fieldErrors.email} />

          <input style={styles.input} type="password" placeholder="Senha" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <FieldError text={fieldErrors.password} />

          {!isLogin && (
            <>
              <input style={styles.input} placeholder="WhatsApp com DDD" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <FieldError text={fieldErrors.phone} />

              <select style={styles.select} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="CLIENT">Cliente</option>
                <option value="DRIVER">Motorista</option>
              </select>

              {form.role === 'DRIVER' && (
                <>
                  <select style={styles.select} value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
                    <option value="MOTO">Moto</option>
                    <option value="CARRO">Carro / Pick-up</option>
                    <option value="CAMINHAO">Caminhão</option>
                  </select>
                  <input style={styles.input} placeholder="Modelo do veículo" value={form.carModel} onChange={(e) => setForm({ ...form, carModel: e.target.value })} />
                  <FieldError text={fieldErrors.carModel} />
                </>
              )}
            </>
          )}

          {error && <div style={styles.err}>{error}</div>}

          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={submit} disabled={loading}>
            {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>

          <button style={{ ...styles.btn, ...styles.btnGhost, width: '100%', marginTop: 10 }} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tenho conta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientPage() {
  const navigate = useNavigate();
  const session = storage.getSession();
  const token = session?.token;
  const user = session?.user;

  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState(storage.getClientRides());
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(storage.getDraft() || {
    vehicleType: 'CARRO',
    from: '',
    to: '',
    distance: 'PERTO',
    needHelper: false,
    selectedItems: []
  });

  const estimate = useMemo(() => calcEstimate(filters), [filters]);

  const loadDrivers = async () => {
    setError('');
    setLoadingDrivers(true);
    try {
      const list = await request(`/api/drivers?vehicleType=${filters.vehicleType}`, { token });
      setDrivers(list);
    } catch (e) {
      setError(`${e.message}. Exibindo dados salvos no navegador.`);
      setDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const loadHistory = async () => {
    try {
      const list = await request('/api/rides/my', { token });
      setRides(list);
      storage.setClientRides(list);
    } catch {
      setRides(storage.getClientRides());
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    loadHistory();
  }, [token, user]);

  useEffect(() => {
    storage.setDraft(filters);
  }, [filters]);

  if (!token || !user) return <Navigate to="/" replace />;

  const logout = () => {
    storage.clearSession();
    navigate('/');
  };

  const toggleItem = (item) => {
    setFilters((prev) => ({
      ...prev,
      selectedItems: prev.selectedItems.includes(item)
        ? prev.selectedItems.filter((i) => i !== item)
        : [...prev.selectedItems, item]
    }));
  };

  const createRide = async (driver) => {
    try {
      const ride = await request('/api/rides', {
        method: 'POST',
        token,
        body: { ...filters, estimate: estimate.totalRange, preferredDriverId: driver.id }
      });
      const text = `Olá ${driver.name}, solicitei um frete no 99Frete PVH.%0AOrigem: ${filters.from}%0ADestino: ${filters.to}%0AValor estimado: ${estimate.totalRange}%0ACódigo: ${ride.id}`;
      window.open(`https://wa.me/55${driver.phone}?text=${text}`, '_blank');
      loadHistory();
    } catch (e) {
      setError(e.message);
    }
  };

  const sendRate = async (ride, score) => {
    try {
      await request(`/api/rides/${ride.id}/rate`, { method: 'POST', token, body: { score } });
      loadHistory();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <strong>Cliente · {user.name}</strong>
          <button style={{ ...styles.btn, background: 'transparent', border: '1px solid #4B5563', color: 'white' }} onClick={logout}>Sair</button>
        </div>
        <div style={styles.content}>
          <div style={styles.card}>
            <h3 style={styles.title}>Novo frete</h3>
            <div style={styles.row}>
              {['MOTO', 'CARRO', 'CAMINHAO'].map((type) => (
                <button key={type} style={{ ...styles.btn, ...(filters.vehicleType === type ? { background: theme.primary, color: theme.accent } : styles.btnGhost) }} onClick={() => setFilters({ ...filters, vehicleType: type })}>{type}</button>
              ))}
            </div>
            <input style={{ ...styles.input, marginTop: 10 }} placeholder="Retirar em" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <input style={styles.input} placeholder="Entregar em" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <select style={styles.select} value={filters.distance} onChange={(e) => setFilters({ ...filters, distance: e.target.value })}>
              <option value="PERTO">Perto</option>
              <option value="MEDIO">Médio</option>
              <option value="LONGE">Longe</option>
            </select>

            {filters.vehicleType !== 'MOTO' && (
              <label style={{ display: 'block', marginBottom: 10 }}>
                <input type="checkbox" checked={filters.needHelper} onChange={(e) => setFilters({ ...filters, needHelper: e.target.checked })} /> Precisa de ajudante (+R$30)
              </label>
            )}

            <div style={styles.row}>
              {['Geladeira', 'Sofá', 'Cama', 'Fogão', 'Caixas'].map((item) => (
                <button key={item} style={{ ...styles.btn, ...(filters.selectedItems.includes(item) ? { background: '#DBEAFE', color: '#1D4ED8' } : styles.btnGhost) }} onClick={() => toggleItem(item)}>{item}</button>
              ))}
            </div>

            <div style={{ marginTop: 14, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 12 }}>
              <strong>Preço transparente</strong>
              <div style={styles.info}>Base + distância: R$ {estimate.subtotal}</div>
              <div style={styles.info}>Ajudante: R$ {estimate.helper}</div>
              <div style={styles.info}>Taxa operacional: R$ {estimate.fee}</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>Estimativa: {estimate.totalRange}</div>
            </div>

            <button style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 12 }} onClick={loadDrivers} disabled={loadingDrivers}>
              {loadingDrivers ? 'Buscando...' : 'Buscar motoristas'}
            </button>
          </div>

          {error && <div style={{ ...styles.card, borderColor: '#FCA5A5', color: theme.danger }}>{error}</div>}

          {drivers.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.title}>Motoristas disponíveis</h3>
              {drivers.map((driver) => (
                <div key={driver.id} style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12, marginTop: 12 }}>
                  <div><strong>{driver.name}</strong> {driver.isVerified && <span title="Documento e dados de veículo validados" style={styles.badge}>Verificado</span>}</div>
                  <div style={styles.info}>{driver.vehicleType} · {driver.carModel}</div>
                  <div style={styles.info}>⭐ {driver.rating} · {driver.trips} fretes</div>
                  <button style={{ ...styles.btn, ...styles.btnGreen, marginTop: 8 }} onClick={() => createRide(driver)}>Solicitar e negociar no WhatsApp</button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.card}>
            <h3 style={styles.title}>Histórico e comprovantes</h3>
            {rides.length === 0 ? <div style={styles.info}>Nenhum frete ainda.</div> : rides.map((ride) => (
              <div key={ride.id} style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12, marginTop: 12 }}>
                <div><strong>{ride.from}</strong> → <strong>{ride.to}</strong></div>
                <div style={styles.info}>Status: {ride.status} · Criado em {new Date(ride.createdAt).toLocaleString('pt-BR')}</div>
                <div style={styles.info}>Comprovante: {ride.receiptCode || 'Será gerado ao concluir'}</div>
                {ride.status === 'COMPLETED' && !ride.clientRating && (
                  <div style={{ marginTop: 6 }}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button key={score} style={{ ...styles.btn, ...styles.btnGhost, marginRight: 6 }} onClick={() => sendRate(ride, score)}>{score}★</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DriverPage() {
  const navigate = useNavigate();
  const session = storage.getSession();
  const token = session?.token;
  const user = session?.user;

  const [profile, setProfile] = useState(user);
  const [rides, setRides] = useState(storage.getDriverRides());
  const [error, setError] = useState('');

  const loadRides = async () => {
    try {
      const mine = await request('/api/rides/my', { token });
      setRides(mine);
      storage.setDriverRides(mine);
    } catch {
      setRides(storage.getDriverRides());
    }
  };

  useEffect(() => {
    if (!token || !user) return;
    loadRides();
  }, [token, user]);

  if (!token || !user) return <Navigate to="/" replace />;

  const logout = () => {
    storage.clearSession();
    navigate('/');
  };

  const toggleStatus = async () => {
    try {
      const updated = await request('/api/driver/status', {
        token,
        method: 'POST',
        body: { isAvailable: !profile.isAvailable }
      });
      const nextSession = { ...session, user: updated };
      storage.setSession(nextSession);
      setProfile(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateRideStatus = async (ride, status) => {
    try {
      await request(`/api/rides/${ride.id}/status`, { method: 'PATCH', token, body: { status } });
      loadRides();
    } catch (e) {
      setError(e.message);
    }
  };

  const sendRate = async (ride, score) => {
    try {
      await request(`/api/rides/${ride.id}/rate`, { method: 'POST', token, body: { score } });
      loadRides();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <strong>Motorista · {profile.name}</strong>
          <button style={{ ...styles.btn, background: 'transparent', border: '1px solid #4B5563', color: 'white' }} onClick={logout}>Sair</button>
        </div>
        <div style={styles.content}>
          <div style={styles.card}>
            <h3 style={styles.title}>Status e performance</h3>
            <div style={styles.info}>⭐ {profile.rating} · {profile.trips} fretes concluídos</div>
            <div style={styles.info}>Veículo: {profile.vehicleType} · {profile.carModel}</div>
            <button style={{ ...styles.btn, ...(profile.isAvailable ? styles.btnGreen : styles.btnGhost), width: '100%', marginTop: 10 }} onClick={toggleStatus}>
              {profile.isAvailable ? '🟢 Online para receber corridas' : '⚪ Offline'}
            </button>
          </div>

          {error && <div style={{ ...styles.card, borderColor: '#FCA5A5', color: theme.danger }}>{error}</div>}

          <div style={styles.card}>
            <h3 style={styles.title}>Minhas corridas</h3>
            {rides.length === 0 ? <div style={styles.info}>Nenhuma corrida atribuída.</div> : rides.map((ride) => (
              <div key={ride.id} style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12, marginTop: 12 }}>
                <div><strong>{ride.from}</strong> → <strong>{ride.to}</strong></div>
                <div style={styles.info}>Status: {ride.status} · Estimativa: {ride.estimate}</div>
                {ride.status === 'ACCEPTED' && (
                  <button style={{ ...styles.btn, ...styles.btnGhost, marginTop: 6 }} onClick={() => updateRideStatus(ride, 'ON_ROUTE')}>Iniciar rota</button>
                )}
                {ride.status === 'ON_ROUTE' && (
                  <button style={{ ...styles.btn, ...styles.btnGreen, marginTop: 6 }} onClick={() => updateRideStatus(ride, 'COMPLETED')}>Concluir frete</button>
                )}
                {ride.status === 'COMPLETED' && (
                  <>
                    <div style={styles.info}>Comprovante: {ride.receiptCode}</div>
                    {!ride.driverRating && [1, 2, 3, 4, 5].map((score) => (
                      <button key={score} style={{ ...styles.btn, ...styles.btnGhost, marginRight: 6, marginTop: 6 }} onClick={() => sendRate(ride, score)}>{score}★ cliente</button>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/cliente" element={<ClientPage />} />
        <Route path="/motorista" element={<DriverPage />} />
      </Routes>
    </BrowserRouter>
  );
}
