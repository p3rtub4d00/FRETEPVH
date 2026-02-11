import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// --- CORES E ESTILO (DESIGN SYSTEM) ---
const theme = {
  primary: '#000000', // Preto Uber/99
  accent: '#FACC15', // Amarelo Taxi
  bg: '#F3F4F6',
  white: '#FFFFFF',
  text: '#1F2937',
  green: '#22C55E' // Cor do WhatsApp
};

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: theme.bg, fontFamily: "'Inter', sans-serif" },
  container: { width: '100%', maxWidth: '500px', background: theme.white, minHeight: '100vh', boxShadow: '0 0 20px rgba(0,0,0,0.05)' },
  header: { padding: '20px', background: theme.primary, color: theme.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { margin: 0, fontSize: '20px', fontWeight: 'bold', color: theme.accent },
  content: { padding: '20px' },
  inputGroup: { marginBottom: '15px' },
  label: { display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600', color: '#4B5563' },
  input: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '16px', outline: 'none', background: '#F9FAFB' },
  select: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '16px', background: '#fff' },
  btnPrimary: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: theme.primary, color: theme.accent, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  btnSuccess: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: theme.green, color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  card: { background: 'white', border: '1px solid #F3F4F6', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  driverHeader: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' },
  avatar: { width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${theme.accent}` },
  stats: { display: 'flex', gap: '15px', fontSize: '12px', color: '#6B7280', marginTop: '5px' },
  badge: { padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', background: '#FEF3C7', color: '#D97706' },
  mapFrame: { width: '100%', height: '180px', borderRadius: '12px', border: 'none', marginBottom: '15px', background: '#eee' }
};

// --- COMPONENTE LOGIN / CADASTRO ---
function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', carModel: '', role: 'CLIENT' });

  const handleSubmit = async () => {
    const endpoint = isLogin ? '/api/login' : '/api/register';
    const res = await fetch(endpoint, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('user', JSON.stringify(data));
      navigate(data.role === 'DRIVER' ? '/motorista' : '/cliente');
    } else {
      alert(data.error);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={{...styles.header, justifyContent: 'center', padding: '40px 20px'}}>
          <div style={{textAlign: 'center'}}>
            <h1 style={{fontSize: '32px', color: theme.accent, margin: 0}}>99Frete</h1>
            <p style={{color: '#9CA3AF', margin: '5px 0'}}>Conectando PVH</p>
          </div>
        </div>
        <div style={styles.content}>
          {!isLogin && (
            <>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Nome Completo</label>
                <input style={styles.input} placeholder="Seu nome" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>WhatsApp / Telefone</label>
                <input style={styles.input} type="tel" placeholder="(69) 99999-9999" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            </>
          )}
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>E-mail</label>
            <input style={styles.input} type="email" placeholder="email@exemplo.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Senha</label>
            <input style={styles.input} type="password" placeholder="******" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>

          {!isLogin && (
             <div style={styles.inputGroup}>
               <label style={styles.label}>Você quer:</label>
               <select style={styles.select} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                 <option value="CLIENT">📦 Contratar Frete</option>
                 <option value="DRIVER">🚚 Ser Motorista</option>
               </select>
             </div>
          )}

          {!isLogin && formData.role === 'DRIVER' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Modelo do Veículo</label>
              <input style={styles.input} placeholder="Ex: Strada 2021 Branca" value={formData.carModel} onChange={e => setFormData({...formData, carModel: e.target.value})} />
            </div>
          )}

          <button style={styles.btnPrimary} onClick={handleSubmit}>{isLogin ? 'ENTRAR' : 'CADASTRAR'}</button>
          <p style={{textAlign: 'center', color: '#6B7280', marginTop: '20px', cursor: 'pointer'}} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Criar nova conta' : 'Já tenho conta'}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- ÁREA DO CLIENTE (BUSCA) ---
function ClientHome() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [drivers, setDrivers] = useState([]);
  const [location, setLocation] = useState({ from: '', to: '' });

  useEffect(() => {
    // Busca motoristas ao carregar
    fetch('/api/drivers').then(r => r.json()).then(setDrivers);
  }, []);

  const openWhatsApp = (driverPhone, driverName) => {
    const text = `Olá ${driverName}, vi seu perfil no 99Frete. Preciso levar algo de ${location.from} para ${location.to}. Qual o valor?`;
    window.open(`https://wa.me/55${driverPhone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const openMaps = () => {
    if(!location.from || !location.to) return alert("Preencha origem e destino");
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(location.from)}&destination=${encodeURIComponent(location.to)}`, '_blank');
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Olá, {user.name}</span>
          <span style={{fontSize: '12px', background: '#333', padding: '5px 10px', borderRadius: '20px'}} onClick={() => navigate('/')}>Sair</span>
        </div>
        
        {/* Mapa Estático Visual */}
        <iframe 
          src="https://www.openstreetmap.org/export/embed.html?bbox=-63.95,-8.8,-63.85,-8.7&amp;layer=mapnik" 
          style={styles.mapFrame}
        ></iframe>

        <div style={styles.content}>
          <h2 style={{marginTop: 0}}>Para onde vamos?</h2>
          
          <div style={styles.inputGroup}>
            <input style={styles.input} placeholder="📍 Retirar em (Origem)" value={location.from} onChange={e => setLocation({...location, from: e.target.value})} />
          </div>
          <div style={styles.inputGroup}>
            <input style={styles.input} placeholder="🏁 Entregar em (Destino)" value={location.to} onChange={e => setLocation({...location, to: e.target.value})} />
          </div>

          {location.from && location.to && (
            <button style={{...styles.btnPrimary, background: '#fff', color: '#000', border: '1px solid #ddd', marginBottom: '20px'}} onClick={openMaps}>
              🗺️ Ver Rota no Maps
            </button>
          )}

          <h3 style={{marginBottom: '15px'}}>Motoristas Disponíveis</h3>
          
          {drivers.map(driver => (
            <div key={driver.id} style={styles.card}>
              <div style={styles.driverHeader}>
                <img src={driver.photo} style={styles.avatar} alt="Driver" />
                <div>
                  <div style={{fontWeight: 'bold', fontSize: '18px'}}>{driver.name}</div>
                  <div style={{color: '#4B5563'}}>{driver.carModel}</div>
                  <div style={styles.stats}>
                    <span>⭐ {driver.rating}</span>
                    <span>🚗 {driver.trips} viagens</span>
                  </div>
                </div>
              </div>
              
              <button style={styles.btnSuccess} onClick={() => openWhatsApp(driver.phone, driver.name)}>
                 📲 NEGOCIAR NO WHATSAPP
              </button>
            </div>
          ))}

          {drivers.length === 0 && <p>Nenhum motorista online agora.</p>}
        </div>
      </div>
    </div>
  );
}

// --- ÁREA DO MOTORISTA ---
function DriverHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [isOnline, setIsOnline] = useState(user.isAvailable);

  const toggleStatus = async () => {
    const newState = !isOnline;
    setIsOnline(newState);
    
    // Atualiza no backend
    await fetch(`/api/users/${user.email}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: newState })
    });
    
    // Atualiza local
    const updatedUser = { ...user, isAvailable: newState };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Painel Motorista</span>
          <span onClick={() => navigate('/')}>Sair</span>
        </div>
        
        <div style={{padding: '30px', textAlign: 'center'}}>
          <img src={user.photo} style={{width: '100px', height: '100px', borderRadius: '50%', marginBottom: '10px'}} />
          <h2>{user.name}</h2>
          <p style={{color: '#666'}}>{user.carModel}</p>
          
          <div style={{display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px'}}>
            <div style={{background: '#F3F4F6', padding: '15px', borderRadius: '10px', width: '100px'}}>
              <div style={{fontSize: '24px', fontWeight: 'bold'}}>⭐ {user.rating}</div>
              <div style={{fontSize: '12px'}}>Avaliação</div>
            </div>
            <div style={{background: '#F3F4F6', padding: '15px', borderRadius: '10px', width: '100px'}}>
              <div style={{fontSize: '24px', fontWeight: 'bold'}}>{user.trips}</div>
              <div style={{fontSize: '12px'}}>Viagens</div>
            </div>
          </div>

          <button 
            onClick={toggleStatus}
            style={{
              ...styles.btnPrimary, 
              background: isOnline ? theme.green : '#EF4444', 
              color: 'white',
              fontSize: '20px',
              padding: '20px'
            }}
          >
            {isOnline ? 'VOCÊ ESTÁ ONLINE 🟢' : 'VOCÊ ESTÁ OFFLINE 🔴'}
          </button>
          
          <p style={{marginTop: '20px', color: '#6B7280'}}>
            {isOnline 
              ? "Clientes podem ver seu perfil e chamar no WhatsApp." 
              : "Fique online para receber chamados."}
          </p>
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
