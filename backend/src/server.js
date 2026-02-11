import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- BANCO DE DADOS VOLÁTIL (Na memória) ---
let users = [
  { email: "motorista@teste.com", password: "123", role: "DRIVER", name: "Carlos Motorista" },
  { email: "cliente@teste.com", password: "123", role: "CLIENT", name: "Ana Cliente" }
];
let orders = [];

app.use(cors());
app.use(express.json());

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password); // Senha simples para teste
  if (!user) return res.status(401).json({ error: "Email ou senha incorretos" });
  return res.json(user);
});

app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "Email já cadastrado" });
  }
  const newUser = { name, email, password, role };
  users.push(newUser);
  res.json(newUser);
});

// --- ROTAS DE PEDIDOS ---
app.post('/api/orders', (req, res) => {
  // Agora recebemos origem, destino e forma de pagamento
  const order = { 
    id: Date.now(), 
    ...req.body, 
    status: 'PENDENTE',
    createdAt: new Date()
  };
  orders.push(order);
  res.json(order);
});

app.get('/api/orders', (req, res) => {
  const status = req.query.status;
  if (status) return res.json(orders.filter(o => o.status === status));
  res.json(orders);
});

app.post('/api/orders/:id/accept', (req, res) => {
  const { id } = req.params;
  const { driverName } = req.body;
  const order = orders.find(o => o.id == id);
  if (order) {
    order.status = 'ACEITO';
    order.driverName = driverName;
    res.json(order);
  } else {
    res.status(404).json({ error: "Pedido não existe" });
  }
});

// --- ENTREGA DO FRONTEND ---
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
