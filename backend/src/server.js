import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// --- DADOS ---
let users = [
  { id: 1, name: "Carlos Silva", email: "motorista@teste.com", password: "123", role: "DRIVER", phone: "69999999999", vehicleType: "CARRO", carModel: "Fiorino Branca 2020", rating: 4.9, trips: 154, isAvailable: true, isVerified: true, plan: "VIP", photo: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: 2, name: "Ana Pereira", email: "ana@teste.com", password: "123", role: "DRIVER", phone: "69988888888", vehicleType: "CAMINHAO", carModel: "Caminhão 3/4 Baú", rating: 5.0, trips: 42, isAvailable: true, isVerified: false, plan: "FREE", photo: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: 3, name: "João Cliente", email: "cliente@teste.com", password: "123", role: "CLIENT", phone: "69911111111" }
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
  const { name, email, password, role, phone, carModel, vehicleType } = req.body;
  if (users.find(u => u.email === email)) return res.status(400).json({ error: "Email já cadastrado" });
  
  const newUser = { id: Date.now(), name, email, password, role, phone, carModel: role === 'DRIVER' ? carModel : null, vehicleType: role === 'DRIVER' ? (vehicleType || 'CARRO') : null, rating: 5.0, trips: 0, isAvailable: role === 'DRIVER', isVerified: false, plan: 'FREE', photo: `https://ui-avatars.com/api/?name=${name}&background=random` };
  users.push(newUser);
  res.json(newUser);
});

app.get('/api/drivers', (req, res) => {
  let drivers = users.filter(u => u.role === 'DRIVER' && u.isAvailable);
  drivers.sort((a, b) => {
    if (a.plan === 'VIP' && b.plan !== 'VIP') return -1;
    if (a.plan !== 'VIP' && b.plan === 'VIP') return 1;
    return b.rating - a.rating;
  });
  res.json(drivers);
});

app.post('/api/users/:email/status', (req, res) => {
  const { isAvailable } = req.body;
  const user = users.find(u => u.email === req.params.email);
  if (user) { user.isAvailable = isAvailable; res.json(user); } 
  else res.status(404).json({ error: "User not found" });
});

const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
