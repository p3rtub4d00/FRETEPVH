import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// --- DESIGN SYSTEM ---
const theme = {
  primary: '#111827',
  accent: '#FACC15',
  bg: '#F3F4F6',
  white: '#FFFFFF',
  green: '#22C55E',
  blue: '#3B82F6',
  danger: '#EF4444'
};

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: theme.bg, fontFamily: "'Inter', sans-serif" },
  container: { width: '100%', maxWidth: '500px', background: theme.white, minHeight: '100vh', boxShadow: '0 0 20px rgba(0,0,0,0.05)', paddingBottom: '80px' },
  header: { padding: '20px', background: theme.primary, color: theme.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: '20px' },
  input: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '16px', marginBottom: '15px', background: '#F9FAFB' },
  select: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '16px', marginBottom: '15px', background: '#fff' },
  btnPrimary: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: theme.primary, color: theme.accent, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' },
  btnTag: { padding: '8px 16px', borderRadius: '20px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '14px', marginRight: '8px', marginBottom: '8px' },
  btnTagActive: { padding: '8px 16px', borderRadius: '20px', border: `1px solid ${theme.primary}`, background: theme.primary, color: 'white', cursor: 'pointer', fontSize: '14px', marginRight: '8px', marginBottom: '8px' },
  card: { background: 'white', border: '1px solid #F3F4F6', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', position: 'relative' },
  vipCard: { border: `2px solid ${theme.accent}`, background: '#FFFBEB' },
  filterContainer: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px' }
};

// --- COMPONENTES VISUAIS ---
const RankBadge = ({ trips }) => {
  let label = "🥉"; if (trips > 50) label = "🥈"; if (trips > 100) label = "🥇";
  return <span style={{ marginRight: '5px' }}>{label}</span>;
};

const VerifiedBadge = () => <span style={{ color: theme.blue, marginLeft: '5px' }}>☑️</span>;

// --- TELA LOGIN/CADASTRO ---
function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', carModel: '', vehicleType: 'PICKUP', role: 'CLIENT' });

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
              <input style={styles.input} placeholder="WhatsApp" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <select style={styles.select} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="CLIENT">Sou Cliente</option>
                <option value="DRIVER">Sou Motorista</option>
              </select>
              {formData.role === 'DRIVER' && (
                <>
                  <select style={styles.select} value={formData.vehicleType} onChange={e => setFormData({...formData, vehicleType: e.target.value})}>
                    <option value="MOTO">Moto (Pequenos Volumes)</option>
                    <option value="PICKUP">Pick-up / Utilitário</option>
                    <option value="CAMINHAO">Caminhão (Mudança)</option>
                  </select>
                  <input style={styles.input} placeholder="Modelo (Ex: Fiorino)" value={formData.carModel} onChange={e => setFormData({...formData, carModel: e.target.value})} />
                </>
              )}
            </>
          )}

          <button style={styles.btnPrimary} onClick={handleSubmit}>{isLogin ? 'ENTRAR' : 'CADASTRAR'}</button>
          <p style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setIsLogin(!isLogin)}>
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
  
  // Novos Estados
  const [filterType, setFilterType] = useState('TODOS');
  const [needHelper, setNeedHelper] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const commonItems = ['Geladeira', 'Sofá', 'Cama', 'Fogão', 'Mesa', 'Caixas', 'Moto'];

  useEffect(() => { fetch('/api/drivers').then(r => r.json()).then(setDrivers); }, []);

  const toggleItem = (item) => {
    if (selectedItems.includes(item)) setSelectedItems(selectedItems.filter(i => i !== item));
    else setSelectedItems([...selectedItems, item]);
  };

  const getWhatsAppLink = (driverPhone) => {
    const itemsText = selectedItems.length > 0 ? selectedItems.join(', ') : 'Vários itens';
    const helperText = needHelper ? 'COM AJUDANTE' : 'Sem ajudante';
    const text = `Olá, vi no 99Frete.\nPreciso levar: ${itemsText}.\n${helperText}.\nDe: ${location.from}\nPara: ${location.to}`;
    return `https://wa.me/55${driverPhone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
  };

  const filteredDrivers = drivers.filter(d => filterType === 'TODOS' || d.vehicleType === filterType);

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Olá, {user.name}</span>
          <button style={{ background: 'none', border: 'none', color: 'white' }} onClick={() => navigate('/')}>Sair</button>
        </div>
        
        <div style={styles.content}>
          <h3>1. O que vamos levar?</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {commonItems.map(item => (
              <button 
                key={item} 
                style={selectedItems.includes(item) ? styles.btnTagActive : styles.btnTag}
                onClick={() => toggleItem(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div style={{ margin: '15px 0', padding: '15px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold', color: '#B45309' }}>👷 Precisa de Ajudante?</span>
            <input 
              type="checkbox" 
              checked={needHelper} 
              onChange={e => setNeedHelper(e.target.checked)} 
              style={{ transform: 'scale(1.5)', cursor: 'pointer' }} 
            />
          </div>

          <h3>2. Onde?</h3>
          <input style={styles.input} placeholder="📍 Retirar em (Bairro/Rua)" value={location.from} onChange={e => setLocation({...location, from: e.target.value})} />
          <input style={styles.input} placeholder="🚩 Entregar em" value={location.to} onChange={e => setLocation({...location, to: e.target.value})} />

          <h3>3. Escolha o Veículo</h3>
          <div style={styles.filterContainer}>
            {['TODOS', 'MOTO', 'PICKUP', 'CAMINHAO'].map(type => (
              <button 
                key={type}
                style={filterType === type ? styles.btnTagActive : styles.btnTag}
                onClick={() => setFilterType(type)}
              >
                {type === 'PICKUP' ? 'PICK-UP' : type === 'CAMINHAO' ? 'CAMINHÃO' : type}
              </button>
            ))}
          </div>
          
          {filteredDrivers.map(d => (
            <div key={d.id} style={{ ...styles.card, ...(d.plan === 'VIP' ? styles.vipCard : {}) }}>
              {d.plan === 'VIP' && <div style={{ position: 'absolute', top: -10, right: 10, background: theme.accent, fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>VIP</div>}
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <img src={d.photo} style={{ width: 60, height: 60, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{d.name} {d.isVerified && <VerifiedBadge />}</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>🚛 {d.vehicleType} • {d.carModel}</div>
                  <div style={{ marginTop: '5px' }}>
                    <RankBadge trips={d.trips} />
                    <span style={{ fontSize: '12px', color: '#666' }}>⭐ {d.rating}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                   if(!location.from || !location.to) return alert('Preencha os endereços primeiro!');
                   window.open(getWhatsAppLink(d.phone), '_blank');
                }}
                style={{ ...styles.btnPrimary, background: theme.green, color: 'white', marginTop: '15px' }}
              >
                📲 NEGOCIAR NO WHATSAPP
              </button>
            </div>
          ))}
          {filteredDrivers.length === 0 && <p style={{ textAlign: 'center', color: '#888' }}>Nenhum motorista desse tipo disponível.</p>}
        </div>
      </div>
    </div>
  );
}

// --- MOTORISTA (MANTIDO IGUAL, APENAS IMPORTANTO ESTILOS) ---
function DriverHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));

  const toggleStatus = async () => {
    const newState = !user.isAvailable;
    await fetch(`/api/users/${user.email}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAvailable: newState }) });
    const u = { ...user, isAvailable: newState };
    setUser(u); localStorage.setItem('user', JSON.stringify(u));
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Painel Motorista</span>
          <span onClick={() => navigate('/')}>Sair</span>
        </div>
        <div style={styles.content}>
           <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img src={user.photo} style={{ width: 80, height: 80, borderRadius: '50%' }} />
            <h2>{user.name}</h2>
            <p>{user.vehicleType} - {user.carModel}</p>
          </div>
          <button onClick={toggleStatus} style={{ ...styles.btnPrimary, background: user.isAvailable ? theme.green : '#ccc', color: 'white' }}>
            {user.isAvailable ? '🟢 ESTOU ONLINE' : '🔴 ESTOU OFFLINE'}
          </button>
          <div style={{ padding: '20px', background: '#F9FAFB', borderRadius: '10px', marginTop: '20px', fontSize: '14px', color: '#555' }}>
            <p><strong>Dica:</strong> Fique online para aparecer na lista dos clientes. Eles entrarão em contato direto pelo seu WhatsApp.</p>
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
        <Route path="/" element={<Auth />} />
        <Route path="/cliente" element={<ClientHome />} />
        <Route path="/motorista" element={<DriverHome />} />
      </Routes>
    </BrowserRouter>
  );
}
