import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// --- DESIGN SYSTEM ---
const theme = {
  primary: '#111827',
  accent: '#FACC15', // Amarelo Taxi
  bg: '#F3F4F6',
  white: '#FFFFFF',
  green: '#22C55E',
  blue: '#3B82F6',
  danger: '#EF4444',
  textLight: '#6B7280'
};

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: theme.bg, fontFamily: "'Inter', sans-serif" },
  container: { width: '100%', maxWidth: '500px', background: theme.white, minHeight: '100vh', boxShadow: '0 0 20px rgba(0,0,0,0.05)', paddingBottom: '80px' },
  header: { padding: '20px', background: theme.primary, color: theme.white, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  content: { padding: '20px' },
  
  input: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '16px', marginBottom: '15px', background: '#F9FAFB' },
  select: { width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '16px', marginBottom: '15px', background: '#fff' },
  
  btnPrimary: { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: theme.primary, color: theme.accent, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' },
  btnSearch: { width: '100%', padding: '20px', borderRadius: '12px', border: 'none', background: '#FACC15', color: '#000', fontSize: '18px', fontWeight: '900', cursor: 'pointer', marginBottom: '30px', marginTop: '10px', boxShadow: '0 4px 15px rgba(250, 204, 21, 0.5)', textTransform: 'uppercase' },
  
  btnTag: { padding: '8px 12px', borderRadius: '20px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '13px', marginRight: '6px', marginBottom: '8px', color: '#555' },
  btnTagActive: { padding: '8px 12px', borderRadius: '20px', border: `1px solid ${theme.primary}`, background: theme.primary, color: theme.accent, cursor: 'pointer', fontSize: '13px', marginRight: '6px', marginBottom: '8px', fontWeight: 'bold' },
  
  card: { background: 'white', border: '1px solid #F3F4F6', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', position: 'relative' },
  vipCard: { border: `2px solid ${theme.accent}`, background: '#FFFBEB' },
  
  // Nova Caixa de Estimativa
  estimateBox: { background: '#F0FDFA', border: '1px solid #2DD4BF', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' },
  priceText: { fontSize: '28px', fontWeight: 'bold', color: '#0F766E', margin: '5px 0' },
  
  filterContainer: { display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px' },
  helperBox: { margin: '15px 0', padding: '15px', background: '#ECFDF5', borderRadius: '10px', border: '1px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
};

const RankBadge = ({ trips }) => {
  let label = "🥉"; if (trips > 50) label = "🥈"; if (trips > 100) label = "🥇";
  return <span style={{ marginRight: '5px' }}>{label}</span>;
};

const VerifiedBadge = () => <span style={{ color: theme.blue, marginLeft: '5px' }}>☑️</span>;

// --- AUTH ---
function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '', carModel: '', vehicleType: 'CARRO', role: 'CLIENT' });

  const handleSubmit = async () => {
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (res.ok) { localStorage.setItem('user', JSON.stringify(data)); navigate(data.role === 'DRIVER' ? '/motorista' : '/cliente'); } 
      else alert(data.error);
    } catch (e) { alert("Erro ao conectar."); }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={{ ...styles.header, justifyContent: 'center', padding: '50px 20px', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ color: theme.accent, margin: 0 }}>99Frete PVH</h1>
          <span style={{ fontSize: '14px', opacity: 0.8 }}>O App de Fretes da Cidade</span>
        </div>
        <div style={styles.content}>
          {!isLogin && <input style={styles.input} placeholder="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
          <input style={styles.input} placeholder="E-mail" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <input style={styles.input} type="password" placeholder="Senha" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          {!isLogin && (
            <>
              <input style={styles.input} placeholder="WhatsApp (69) 9..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <select style={styles.select} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="CLIENT">Cliente</option>
                <option value="DRIVER">Motorista</option>
              </select>
              {formData.role === 'DRIVER' && (
                <>
                  <select style={styles.select} value={formData.vehicleType} onChange={e => setFormData({...formData, vehicleType: e.target.value})}>
                    <option value="MOTO">Moto</option>
                    <option value="CARRO">Carro / Pick-up</option>
                    <option value="CAMINHAO">Caminhão</option>
                  </select>
                  <input style={styles.input} placeholder="Modelo do Veículo" value={formData.carModel} onChange={e => setFormData({...formData, carModel: e.target.value})} />
                </>
              )}
            </>
          )}
          <button style={styles.btnPrimary} onClick={handleSubmit}>{isLogin ? 'ENTRAR' : 'CADASTRAR'}</button>
          <p style={{ textAlign: 'center', cursor: 'pointer', marginTop: '20px' }} onClick={() => setIsLogin(!isLogin)}>{isLogin ? 'Criar nova conta' : 'Já tenho conta'}</p>
        </div>
      </div>
    </div>
  );
}

// --- CLIENT HOME ---
function ClientHome() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const [location, setLocation] = useState({ from: '', to: '' });
  const [filterType, setFilterType] = useState('CARRO');
  const [needHelper, setNeedHelper] = useState(false);
  const [distance, setDistance] = useState('MEDIO'); // Novo campo para estimativa
  const [selectedItems, setSelectedItems] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => { fetch('/api/drivers').then(r => r.json()).then(setDrivers); }, []);

  const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };
  const toggleItem = (item) => {
    if (selectedItems.includes(item)) setSelectedItems(selectedItems.filter(i => i !== item));
    else setSelectedItems([...selectedItems, item]);
  };

  const handleSearch = () => {
    if (!location.from || !location.to) return alert("Preencha os endereços.");
    setShowResults(true);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
  };

  // Lógica da Calculadora de Preço
  const calculateEstimate = () => {
    let base = 0;
    if (filterType === 'MOTO') base = 15;
    if (filterType === 'CARRO') base = 40;
    if (filterType === 'CAMINHAO') base = 120;

    let distFactor = 1;
    if (distance === 'PERTO') distFactor = 1; // x1
    if (distance === 'MEDIO') distFactor = 1.5; // x1.5
    if (distance === 'LONGE') distFactor = 2.5; // x2.5

    let helperCost = needHelper ? 30 : 0; // Ajudante custa 30
    if (filterType === 'MOTO') helperCost = 0; // Moto não tem ajudante

    const totalMin = (base * distFactor) + helperCost;
    const totalMax = totalMin * 1.3; // Margem de negociação

    return `R$ ${Math.round(totalMin)} - R$ ${Math.round(totalMax)}`;
  };

  const getWhatsAppLink = (driverPhone) => {
    const text = `Olá, vi no 99Frete.\nPreciso de: ${filterType}.\nItens: ${selectedItems.join(', ') || 'Vários'}.\n${needHelper ? 'COM AJUDANTE' : 'Sem ajudante'}.\nDistância: ${distance}.\nDe: ${location.from}\nPara: ${location.to}\n\nO app sugeriu: ${calculateEstimate()}`;
    return `https://wa.me/55${driverPhone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`;
  };

  const filteredDrivers = drivers.filter(d => d.vehicleType === filterType);

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span>Olá, {user.name}</span>
          <button style={{ background: 'none', border: '1px solid #555', padding: '5px 10px', borderRadius: '5px', color: 'white' }} onClick={handleLogout}>Sair</button>
        </div>
        
        <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=-63.95,-8.8,-63.85,-8.7&layer=mapnik" style={{ width: '100%', height: '150px', border: 0 }} />

        <div style={styles.content}>
          <h3 style={{marginTop:0}}>1. Configurar Frete</h3>
          <div style={styles.filterContainer}>
            {[{ id: 'MOTO', label: '🛵 Moto' }, { id: 'CARRO', label: '🛻 Pick-up' }, { id: 'CAMINHAO', label: '🚛 Caminhão' }].map(type => (
              <button key={type.id} style={filterType === type.id ? styles.btnTagActive : styles.btnTag} onClick={() => setFilterType(type.id)}>{type.label}</button>
            ))}
          </div>

          <input style={styles.input} placeholder="📍 Retirar em..." value={location.from} onChange={e => setLocation({...location, from: e.target.value})} />
          <input style={styles.input} placeholder="🏁 Entregar em..." value={location.to} onChange={e => setLocation({...location, to: e.target.value})} />

          <div style={{marginBottom: '15px'}}>
            <label style={{fontSize: '14px', fontWeight: 'bold', color: '#555'}}>Distância Aproximada:</label>
            <div style={{display: 'flex', gap: '5px', marginTop: '5px'}}>
              {[{id: 'PERTO', l: 'Perto (mesmo bairro)'}, {id: 'MEDIO', l: 'Médio'}, {id: 'LONGE', l: 'Longe (outro lado)'}].map(d => (
                 <button key={d.id} style={distance === d.id ? styles.btnTagActive : styles.btnTag} onClick={() => setDistance(d.id)}>{d.l}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '10px' }}>
            {['Geladeira', 'Sofá', 'Cama', 'Fogão', 'Mesa', 'Caixas'].map(item => (
              <button key={item} style={selectedItems.includes(item) ? styles.btnTagActive : styles.btnTag} onClick={() => toggleItem(item)}>{item}</button>
            ))}
          </div>

          {filterType !== 'MOTO' && (
            <div style={styles.helperBox}>
              <div><span style={{ fontWeight: 'bold', color: '#065F46' }}>Precisa de Ajudante?</span><br/><small>(+ R$ 30,00 est.)</small></div>
              <input type="checkbox" checked={needHelper} onChange={e => setNeedHelper(e.target.checked)} style={{ transform: 'scale(1.8)' }} />
            </div>
          )}

          {/* CAIXA DE ESTIMATIVA DE PREÇO */}
          <div style={styles.estimateBox}>
            <small style={{textTransform: 'uppercase', letterSpacing: '1px', color: '#0F766E'}}>Valor Estimado</small>
            <div style={styles.priceText}>{calculateEstimate()}</div>
            <small style={{color: '#666'}}>Valor sugerido. Negocie com o motorista.</small>
          </div>

          <button style={styles.btnSearch} onClick={handleSearch}>🔍 BUSCAR MOTORISTAS</button>

          {showResults && (
            <div>
              <h3 style={{ textAlign: 'center' }}>Motoristas Disponíveis</h3>
              {filteredDrivers.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Nenhum {filterType} encontrado.</p>
              ) : (
                filteredDrivers.map(d => (
                  <div key={d.id} style={{ ...styles.card, ...(d.plan === 'VIP' ? styles.vipCard : {}) }}>
                    {d.plan === 'VIP' && <div style={{ position: 'absolute', top: -10, right: 10, background: theme.accent, fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>VIP</div>}
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <img src={d.photo} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{d.name} {d.isVerified && <VerifiedBadge />}</div>
                        <div style={{ color: '#666', fontSize: '12px' }}>{d.carModel}</div>
                        <div style={{ marginTop: '5px' }}><RankBadge trips={d.trips} /><span style={{ fontSize: '12px', color: '#666' }}>⭐ {d.rating}</span></div>
                      </div>
                    </div>
                    <button onClick={() => window.open(getWhatsAppLink(d.phone), '_blank')} style={{ ...styles.btnPrimary, background: theme.green, color: 'white', marginTop: '15px' }}>📲 NEGOCIAR AGORA</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- MOTORISTA ---
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
        <div style={styles.header}><span>Painel Motorista</span><button style={{ background: 'none', border: '1px solid #555', padding: '5px 10px', borderRadius: '5px', color: 'white' }} onClick={() => { localStorage.removeItem('user'); navigate('/'); }}>Sair</button></div>
        <div style={styles.content}>
           <div style={{ textAlign: 'center', marginBottom: '20px' }}><img src={user.photo} style={{ width: 80, height: 80, borderRadius: '50%' }} /><h2>{user.name}</h2><p>{user.vehicleType} - {user.carModel}</p></div>
          <button onClick={toggleStatus} style={{ ...styles.btnPrimary, background: user.isAvailable ? theme.green : '#ccc', color: 'white' }}>{user.isAvailable ? '🟢 ESTOU ONLINE' : '🔴 ESTOU OFFLINE'}</button>
          <div style={{ padding: '20px', background: '#F9FAFB', borderRadius: '10px', marginTop: '20px', fontSize: '14px', color: '#555' }}><p>Fique online para aparecer na lista dos clientes.</p></div>
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
