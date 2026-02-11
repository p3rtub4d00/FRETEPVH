import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

// --- ESTILOS RÁPIDOS (CSS-IN-JS) ---
const styles = {
  container: { padding: 20, maxWidth: 500, margin: '0 auto', fontFamily: 'Arial, sans-serif' },
  btn: { width: '100%', padding: 15, margin: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 16 },
  card: { border: '1px solid #ddd', padding: 15, borderRadius: 8, marginBottom: 10, background: '#fff' },
  input: { width: '100%', padding: 12, marginBottom: 10, borderRadius: 6, border: '1px solid #ccc' }
};

// --- PÁGINA DE LOGIN ---
function Login() {
  const navigate = useNavigate();
  
  async function login(role) {
    const email = role === 'DRIVER' ? 'motorista@teste.com' : 'cliente@teste.com';
    // Em produção, usa o caminho relativo /api
    try {
        const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
        });
        if (res.ok) {
            const user = await res.json();
            localStorage.setItem('user', JSON.stringify(user));
            navigate(role === 'DRIVER' ? '/motorista' : '/cliente');
        } else {
            alert("Erro no login");
        }
    } catch (error) {
        console.error("Erro de conexão:", error);
        alert("Erro ao conectar com o servidor.");
    }
  } 

  return (
    <div style={{ ...styles.container, textAlign: 'center', marginTop: 50 }}>
      <h1 style={{ color: '#FFD600', fontSize: 40 }}>99Frete</h1>
      <button style={{ ...styles.btn, background: '#222', color: '#fff' }} onClick={() => login('DRIVER')}>
        🚗 SOU MOTORISTA
      </button>
      <button style={{ ...styles.btn, background: '#FFD600', color: '#222' }} onClick={() => login('CLIENT')}>
        📦 SOU CLIENTE
      </button>
    </div>
  );
}

// --- ÁREA DO CLIENTE ---
function ClientArea() {
  const [desc, setDesc] = useState('');
  const navigate = useNavigate();

  async function pedir() {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, price: 50 })
    });
    alert('Pedido Feito!');
    setDesc('');
  }

  return (
    <div style={styles.container}>
      <h2>O que vamos transportar?</h2>
      <textarea 
        style={{ ...styles.input, height: 100 }} 
        placeholder="Ex: Geladeira e Fogão"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />
      <button style={{ ...styles.btn, background: '#FFD600' }} onClick={pedir}>CHAMAR AGORA</button>
      <button style={{ ...styles.btn, background: '#eee' }} onClick={() => navigate('/')}>Sair</button>
    </div>
  );
}

// --- ÁREA DO MOTORISTA ---
function DriverArea() {
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => fetch('/api/orders?status=PENDENTE').then(r => r.json()).then(setOrders);
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  async function aceitar(id) {
    await fetch(`/api/orders/${id}/accept`, { method: 'POST' });
    alert('Corrida Aceita!');
    // Recarregar lista após aceitar
    fetch('/api/orders?status=PENDENTE').then(r => r.json()).then(setOrders);
  }

  return (
    <div style={styles.container}>
      <h2>Pedidos Disponíveis</h2>
      {orders.length === 0 && <p>Procurando...</p>}
      {orders.map(o => (
        <div key={o.id} style={styles.card}>
          <h3>R$ {o.price},00</h3>
          <p>{o.description}</p>
          <button style={{ ...styles.btn, background: '#222', color: '#fff' }} onClick={() => aceitar(o.id)}>
            ACEITAR
          </button>
        </div>
      ))}
      <button style={{ ...styles.btn, background: '#eee' }} onClick={() => navigate('/')}>Sair</button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cliente" element={<ClientArea />} />
        <Route path="/motorista" element={<DriverArea />} />
      </Routes>
    </BrowserRouter>
  );
}
