import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// --- DESIGN SYSTEM (CSS In-JS para facilitar) ---
const theme = {
  primary: '#2563EB', // Azul Profissional
  secondary: '#1E293B', // Cinza Escuro
  accent: '#F59E0B', // Amarelo para destaques
  bg: '#F3F4F6',
  white: '#FFFFFF',
  text: '#1F2937',
  danger: '#EF4444'
};

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  container: { width: '100%', maxWidth: '480px', background: theme.white, borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden' },
  header: { padding: '20px', background: theme.primary, color: theme.white, textAlign: 'center' },
  headerTitle: { margin: 0, fontSize: '24px', fontWeight: '700' },
  content: { padding: '24px' },
  inputGroup: { marginBottom: '16px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: theme.text },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '16px', transition: 'border 0.2s' },
  select: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '16px', background: '#fff' },
  btnPrimary: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: theme.primary, color: theme.white, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  btnSecondary: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: theme.secondary, color: theme.white, fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  btnOutline: { width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${theme.primary}`, background: 'transparent', color: theme.primary, fontWeight: '600', cursor: 'pointer', marginTop: '10px' },
  card: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginBottom: '16px' },
  statusBadge: { padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' },
  mapPlaceholder: { width: '100%', height: '150px', background: '#e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', marginBottom: '15px', overflow: 'hidden' }
};

// --- COMPONENTE DE MAPA VISUAL (IFRAME) ---
const MapView = () => (
  <div style={styles.mapPlaceholder}>
    <iframe 
      width="100%" 
      height="100%" 
      frameBorder="0" 
      scrolling="no" 
      marginHeight="0" 
      marginWidth="0" 
      src="https://www.openstreetmap.org/export/embed.html?bbox=-63.95,-8.8,-63.85,-8.7&amp;layer=mapnik" 
      style={{ border: 0 }}
    ></iframe>
  </div>
);

// --- TELA DE AUTENTICAÇÃO (LOGIN/CADASTRO) ---
function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'CLIENT' });

  const handleSubmit = async () => {
    // Simulação de autenticação (backend simplificado)
    const endpoint = isLogin ? '/api/login' : '/api/register'; 
    try {
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
        alert(data.error || 'Erro na autenticação');
      }
    } catch (error) {
      alert('Erro de conexão com o servidor.');
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>FretePVH</h1>
          <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>O app de fretes da cidade</p>
        </div>
        <div style={styles.content}>
          {!isLogin && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nome Completo</label>
              <input 
                style={styles.input} 
                placeholder="Seu nome" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
          )}
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>E-mail</label>
            <input 
              style={styles.input} 
              type="email" 
              placeholder="exemplo@email.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Senha</label>
            <input 
              style={styles.input} 
              type="password" 
              placeholder="******" 
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          {!isLogin && (
             <div style={styles.inputGroup}>
               <label style={styles.label}>Eu quero:</label>
               <select 
                 style={styles.select} 
                 value={formData.role}
                 onChange={e => setFormData({...formData, role: e.target.value})}
               >
                 <option value="CLIENT">📦 Enviar Fretes (Cliente)</option>
                 <option value="DRIVER">🚚 Fazer Fretes (Motorista)</option>
               </select>
             </div>
          )}

          <button style={styles.btnPrimary} onClick={handleSubmit}>
            {isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
          </button>
          
          <button style={styles.btnOutline} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tenho conta. Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ÁREA DO CLIENTE ---
function ClientDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [order, setOrder] = useState({
    from: '',
    to: '',
    description: '',
    price: '',
    paymentMethod: 'PIX'
  });

  async function createOrder() {
    if (!order.from || !order.to || !order.price) return alert("Preencha todos os campos!");
    
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...order, clientName: user.name })
    });
    alert('Pedido criado! Aguardando motoristas...');
    setOrder({ from: '', to: '', description: '', price: '', paymentMethod: 'PIX' });
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Novo Frete</h2>
          <small>Olá, {user.name || 'Cliente'}</small>
        </div>
        
        <div style={styles.content}>
          <MapView />

          <div style={styles.inputGroup}>
            <label style={styles.label}>📍 Retirar em (Origem)</label>
            <input style={styles.input} placeholder="Rua, Número, Bairro" value={order.from} onChange={e => setOrder({...order, from: e.target.value})} />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>🚩 Levar para (Destino)</label>
            <input style={styles.input} placeholder="Rua, Número, Bairro" value={order.to} onChange={e => setOrder({...order, to: e.target.value})} />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ ...styles.inputGroup, flex: 1 }}>
              <label style={styles.label}>💰 Valor (R$)</label>
              <input type="number" style={styles.input} placeholder="50.00" value={order.price} onChange={e => setOrder({...order, price: e.target.value})} />
            </div>
            <div style={{ ...styles.inputGroup, flex: 1 }}>
              <label style={styles.label}>💳 Pagamento</label>
              <select style={styles.select} value={order.paymentMethod} onChange={e => setOrder({...order, paymentMethod: e.target.value})}>
                <option>PIX</option>
                <option>Dinheiro</option>
                <option>Cartão</option>
              </select>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>📦 O que vamos levar?</label>
            <textarea style={{ ...styles.input, height: '80px' }} placeholder="Ex: Geladeira, Sofá, Caixas..." value={order.description} onChange={e => setOrder({...order, description: e.target.value})} />
          </div>

          <button style={styles.btnPrimary} onClick={createOrder}>CHAMAR MOTORISTA</button>
          <button style={styles.btnOutline} onClick={() => navigate('/')}>Sair</button>
        </div>
      </div>
    </div>
  );
}

// --- ÁREA DO MOTORISTA ---
function DriverDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = () => fetch('/api/orders?status=PENDENTE').then(r => r.json()).then(setOrders);
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  async function acceptOrder(id) {
    await fetch(`/api/orders/${id}/accept`, { method: 'POST', body: JSON.stringify({ driverName: user.name }), headers: { 'Content-Type': 'application/json' } });
    alert('Corrida aceita! Vá até o cliente.');
    window.location.reload();
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={{ ...styles.header, background: theme.secondary }}>
          <h2 style={styles.headerTitle}>Painel do Motorista</h2>
          <small>Bem-vindo, {user.name}</small>
        </div>
        
        <div style={styles.content}>
          <h3 style={{ marginTop: 0 }}>Fretes Disponíveis</h3>
          
          {orders.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Procurando novos fretes na região...</p>
          ) : (
            orders.map(o => (
              <div key={o.id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: theme.primary }}>R$ {o.price}</span>
                  <span style={{ ...styles.statusBadge, background: '#FEF3C7', color: '#D97706' }}>{o.paymentMethod}</span>
                </div>
                <div style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px' }}><strong>📍 De:</strong> {o.from}</div>
                <div style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px' }}><strong>🚩 Para:</strong> {o.to}</div>
                <div style={{ background: '#F3F4F6', padding: '8px', borderRadius: '4px', fontSize: '13px', margin: '10px 0' }}>
                  📦 {o.description}
                </div>
                <button style={styles.btnPrimary} onClick={() => acceptOrder(o.id)}>ACEITAR CORRIDA</button>
              </div>
            ))
          )}
          
          <button style={styles.btnOutline} onClick={() => navigate('/')}>Sair</button>
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
        <Route path="/cliente" element={<ClientDashboard />} />
        <Route path="/motorista" element={<DriverDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
