import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURAÇÃO DE CAMINHOS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- DADOS EM MEMÓRIA (SIMPLIFICADO) ---
let users = [
  { email: "motorista@teste.com", role: "DRIVER", name: "Sr. Motorista" },
  { email: "cliente@teste.com", role: "CLIENT", name: "João Cliente" }
];
let orders = [];

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- ROTAS DA API ---

// 1. Login Simples
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  return res.json(user);
});

// 2. Criar Pedido
app.post('/api/orders', (req, res) => {
  const order = { id: Date.now(), ...req.body, status: 'PENDENTE' };
  orders.push(order);
  res.json(order);
});

// 3. Listar Pedidos
app.get('/api/orders', (req, res) => {
  const status = req.query.status;
  if (status) return res.json(orders.filter(o => o.status === status));
  res.json(orders);
});

// 4. Aceitar Pedido
app.post('/api/orders/:id/accept', (req, res) => {
  const { id } = req.params;
  const order = orders.find(o => o.id == id);
  if (order) {
    order.status = 'ACEITO';
    res.json(order);
  } else {
    res.status(404).json({ error: "Pedido não existe" });
  }
});

// --- ENTREGA DO FRONTEND ---
// O servidor busca a pasta 'dist' que foi gerada dentro de 'frontend'
// Atenção: Certifique-se de que o comando de build rodou antes de iniciar o servidor
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
