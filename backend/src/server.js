import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- DADOS DO BANCO (SIMULADO) ---
let users = [
  { 
    id: 1,
    name: "Carlos Silva", 
    email: "motorista@teste.com", 
    password: "123", 
    role: "DRIVER", 
    phone: "69999999999", 
    carModel: "Fiorino Branca 2020",
    rating: 4.9,
    trips: 154, // Nível Ouro
    isAvailable: true,
    isVerified: true, // Tem selo azul
    plan: "VIP", // Aparece no topo
    pixKey: "carlos@pix.com",
    emergencyPhone: "69900000000",
    photo: "https://randomuser.me/api/portraits/men/32.jpg"
  },
  { 
    id: 2,
    name: "Ana Pereira", 
    email: "ana@teste.com", 
    password: "123", 
    role: "DRIVER", 
    phone: "69988888888", 
    carModel: "Strada Cabine Dupla",
    rating: 5.0,
    trips: 42, // Nível Prata
    isAvailable: true,
    isVerified: false,
    plan: "FREE",
    pixKey: "69988888888",
    emergencyPhone: "69900000000",
    photo: "https://randomuser.me/api/portraits/women/44.jpg"
  },
  { 
    id: 3,
    name: "João Cliente", 
    email: "cliente@teste.com", 
    password: "123", 
    role: "CLIENT", 
    phone: "69977777777" 
  }
];

app.use(cors());
app.use(express.json());

// --- ROTAS ---

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Dados incorretos" });
  return res.json(user);
});

app.post('/api/register', (req, res) => {
  const { name, email, password, role, phone, carModel } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "Email já cadastrado" });
  }
  
  const newUser = { 
    id: Date.now(),
    name, 
    email, 
    password, 
    role, 
    phone,
    carModel: role === 'DRIVER' ? carModel : null,
    rating: 5.0,
    trips: 0,
    isAvailable: role === 'DRIVER',
    isVerified: false, // Começa sem verificação
    plan: 'FREE', // Começa no plano grátis
    pixKey: phone, // Usa o telefone como PIX padrão
    emergencyPhone: '',
    photo: `https://ui-avatars.com/api/?name=${name}&background=random`
  };
  
  users.push(newUser);
  res.json(newUser);
});

// Buscar Motoristas (Com ordenação Inteligente)
app.get('/api/drivers', (req, res) => {
  let drivers = users.filter(u => u.role === 'DRIVER' && u.isAvailable);
  
  // ORDENAÇÃO: 1º VIPs, 2º Maior Avaliação, 3º Mais Viagens
  drivers.sort((a, b) => {
    if (a.plan === 'VIP' && b.plan !== 'VIP') return -1;
    if (a.plan !== 'VIP' && b.plan === 'VIP') return 1;
    return b.rating - a.rating;
  });

  res.json(drivers);
});

// Atualizar Status (Online/Offline)
app.post('/api/users/:email/status', (req, res) => {
  const { isAvailable } = req.body;
  const user = users.find(u => u.email === req.params.email);
  if (user) {
    user.isAvailable = isAvailable;
    res.json(user);
  } else res.status(404).json({ error: "User not found" });
});

// Comprar VIP (Simulação)
app.post('/api/users/:email/upgrade', (req, res) => {
  const user = users.find(u => u.email === req.params.email);
  if (user) {
    user.plan = 'VIP';
    res.json(user);
  } else res.status(404).json({ error: "User not found" });
});

// Atualizar Dados de Segurança (Pânico/Pix)
app.post('/api/users/:email/update', (req, res) => {
  const user = users.find(u => u.email === req.params.email);
  if (user) {
    if (req.body.emergencyPhone) user.emergencyPhone = req.body.emergencyPhone;
    if (req.body.pixKey) user.pixKey = req.body.pixKey;
    res.json(user);
  } else res.status(404).json({ error: "User not found" });
});

// --- SERVIR FRONTEND ---
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
