import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// --- DESIGN SYSTEM AVANÇADO ---
const theme = {
  primary: '#111827', // Preto Premium
  accent: '#FACC15', // Ouro VIP
  secondary: '#374151',
  bg: '#F3F4F6',
  white: '#FFFFFF',
  text: '#1F2937',
  green: '#22C55E', // WhatsApp/Sucesso
  blue: '#3B82F6', // Verificado
  danger: '#EF4444' // Pânico
};

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: theme.bg, fontFamily: "'Inter', sans-serif" },
  container: { width: '100%', maxWidth: '500px', background: theme.white, minHeight: '100vh', boxShadow: '0 0 20px rgba(0,0,0,0.05)', paddingBottom: '80px' },
  header: { padding: '20px', background: theme.primary, color: theme.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: '20px' },
  input: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '16px', marginBottom: '15px', background: '#F9FAFB' },
  btnPrimary: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: theme.primary, color: theme.accent, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' },
  btnVip: { width: '100%', padding: '12px', borderRadius: '8px', border: `2px solid ${theme.accent}`, background: '#FEFCE8', color: '#B45309', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '15px' },
  btnPanic: { width: '100%', padding: '15px', borderRadius: '50px', border: 'none', background: theme.danger, color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)', marginTop: '20px' },
  card: { background: 'white', border: '1px solid #F3F4F6', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', position: 'relative' },
  vipCard: { border: `2px solid ${theme.accent}`, background: '#FFFBEB' },
  badge: { padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', display: 'inline-block', marginRight: '5px' },
};

// --- COMPONENTES AUXILIARES ---

// Medalha de Gamificação
const RankBadge = ({ trips }) => {
  let label = "🥉 BRONZE";
  let color = "#B45309";
  let bg = "#FEF3C7";

  if (trips > 50) { label = "🥈 PRATA"; color = "#374151"; bg = "#F3F4F6"; }
  if (trips > 100) { label = "🥇 OURO"; color = "#B45309"; bg = "#FDE68A"; }

  return <span style={{ ...styles.badge, background: bg, color: color }}>{label}</span>;
};

// Selo de Verificado
const VerifiedBadge = () => (
  <span style={{ color: theme.blue, marginLeft: '5px', fontSize: '14px' }} title="Motorista Verificado">
    Verified ☑️
  </span>
);

// --- TELA LOGIN/CADASTRO ---
function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', carModel: '', role: 'CLIENT' });

  const handleSubmit = async () => {
    const endpoint = isLogin ? '/api/login' : '/api/register';
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('user', JSON.stringify(data));
      navigate(data.role === 'DRIVER' ? '/motorista' : '/cliente');
    } else alert(data.error);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={{ ...styles.header, justifyContent: 'center', padding: '50px 20px' }}>
          <h1 style={{ color: theme.accent, margin: 0 }}>99Frete PRO</h1>
        </div>
        <div style={styles.content}>
          {!isLogin && <input style={styles.input} placeholder="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
          <input style={styles.input} placeholder="E-mail" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <input style={styles.input} type="password" placeholder="Senha" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          
          {!isLogin && (
            <>
              <input style={styles.input} placeholder="WhatsApp (69) 9..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <select style={styles.input} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="CLIENT">Cliente</option>
                <option value="DRIVER">Motorista</option>
              </select>
              {formData.role === 'DRIVER' && <input style={styles.input} placeholder="Modelo do Carro" value={formData.carModel} onChange={e => setFormData({...formData, carModel: e.target.value})} />}
            </>
          )}

          <button style={styles.btnPrimary} onClick={handleSubmit}>{isLogin ? 'ENTRAR' : 'CADASTRAR'}</button>
          <p style={{ textAlign: 'center', cursor: 'pointer', color: '#666' }} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Criar conta' : 'Já tenho conta'}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- CLIENTE ---
function ClientHome() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [drivers, setDrivers] = useState([]);
  const [location, setLocation] = useState({ from: '', to: '' });

  useEffect(() => { fetch('/api/drivers').then(r => r.json()).then(setDrivers); }, []);

  const copyPix = (pix) => {
    navigator.clipboard.writeText(pix);
    alert('Chave PIX copiada: ' + pix);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Olá, {user.name}</span>
          <button style={{ background: 'none', border: 'none', color: 'white' }} onClick={() => navigate('/')}>Sair</button>
        </div>
        
        <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-63.95,-8.8,-63.85,-8.7&layer=mapnik" style={{ width: '100%', height: '200px', border: 0 }} />

        <div style={styles.content}>
          <h3>Encontre seu Frete</h3>
          <input style={styles.input} placeholder="📍 Origem" value={location.from} onChange={e => setLocation({...location, from: e.target.value})} />
          <input style={styles.input} placeholder="🚩 Destino" value={location.to} onChange={e => setLocation({...location, to: e.target.value})} />
          
          {drivers.map(d => (
            <div key={d.id} style={{ ...styles.card, ...(d.plan === 'VIP' ? styles.vipCard : {}) }}>
              {d.plan === 'VIP' && <div style={{ position: 'absolute', top: -10, right: 10, background: theme.accent, fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>DESTAQUE VIP</div>}
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <img src={d.photo} style={{ width: 60, height: 60, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    {d.name} {d.isVerified && <VerifiedBadge />}
                  </div>
                  <div style={{ color: '#666', fontSize: '14px' }}>{d.carModel}</div>
                  <div style={{ marginTop: '5px' }}>
                    <RankBadge trips={d.trips} />
                    <span style={{ fontSize: '12px', color: '#666' }}>⭐ {d.rating}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button 
                  onClick={() => window.open(`https://wa.me/55${d.phone.replace(/\D/g,'')}?text=Olá, vi no 99Frete. Frete de ${location.from} para ${location.to}?`, '_blank')}
                  style={{ ...styles.btnPrimary, flex: 1, margin: 0, background: theme.green, color: 'white' }}
                >
                  WhatsApp
                </button>
                <button onClick={() => copyPix(d.pixKey)} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #ddd', background: '#fff' }}>
                  🔑 Pix
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- MOTORISTA ---
function DriverHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [emergencyContact, setEmergencyContact] = useState(user.emergencyPhone || '');
  const [pixKey, setPixKey] = useState(user.pixKey || '');

  const toggleStatus = async () => {
    const newState = !user.isAvailable;
    await fetch(`/api/users/${user.email}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAvailable: newState }) });
    const u = { ...user, isAvailable: newState };
    setUser(u); localStorage.setItem('user', JSON.stringify(u));
  };

  const buyVip = async () => {
    if(confirm("Deseja ativar o Plano VIP por R$ 49,90/mês? (Simulação)")) {
      await fetch(`/api/users/${user.email}/upgrade`, { method: 'POST' });
      const u = { ...user, plan: 'VIP' };
      setUser(u); localStorage.setItem('user', JSON.stringify(u));
      alert("Parabéns! Você agora é VIP e aparecerá no topo.");
    }
  };

  const saveSettings = async () => {
    await fetch(`/api/users/${user.email}/update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emergencyPhone: emergencyContact, pixKey: pixKey })
    });
    const u = { ...user, emergencyPhone: emergencyContact, pixKey };
    setUser(u); localStorage.setItem('user', JSON.stringify(u));
    alert("Dados salvos!");
  };

  const panic = () => {
    if(!user.emergencyPhone) return alert("Configure um contato de emergência abaixo primeiro!");
    window.open(`https://wa.me/55${user.emergencyPhone.replace(/\D/g,'')}?text=SOCORRO! Preciso de ajuda urgente. Minha localização: https://maps.google.com/?q=-8.7619,-63.9039`, '_blank');
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Painel {user.plan === 'VIP' ? '💎 VIP' : ''}</span>
          <span onClick={() => navigate('/')}>Sair</span>
        </div>

        <div style={styles.content}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src={user.photo} style={{ width: 80, height: 80, borderRadius: '50%', border: user.plan === 'VIP' ? `3px solid ${theme.accent}` : 'none' }} />
            <h2>{user.name} {user.isVerified && <VerifiedBadge />}</h2>
            <RankBadge trips={user.trips} />
          </div>

          {user.plan !== 'VIP' && (
            <button style={styles.btnVip} onClick={buyVip}>
              🚀 SEJA VIP - Aumente suas corridas
            </button>
          )}

          <button onClick={toggleStatus} style={{ ...styles.btnPrimary, background: user.isAvailable ? theme.green : '#ccc', color: 'white' }}>
            {user.isAvailable ? '🟢 ONLINE (Recebendo Pedidos)' : '🔴 OFFLINE'}
          </button>

          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

          <h3>Configurações de Segurança</h3>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Sua Chave PIX</label>
          <input style={styles.input} value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="CPF, Email ou Telefone" />
          
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Contato de Emergência (Pânico)</label>
          <input style={styles.input} value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Whatsapp de alguém de confiança" />
          
          <button style={{ ...styles.btnPrimary, background: '#333', color: 'white', padding: '10px' }} onClick={saveSettings}>Salvar Configurações</button>

          <button style={styles.btnPanic} onClick={panic}>
            🚨 BOTÃO DE PÂNICO
          </button>
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#888' }}>Envia sua localização para seu contato de emergência.</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/cliente" element={<ClientHome />} />
        <Route path="/motorista" element={<DriverHome />} />
      </Routes>
    </BrowserRouter>
  );
}
