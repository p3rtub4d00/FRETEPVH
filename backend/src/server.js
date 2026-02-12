import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'frete-dev-secret-change-me';

const isEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const sanitizePhone = (phone = '') => phone.replace(/\D/g, '');
const isStrongPassword = (password = '') => password.length >= 6;

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const checkPassword = (password, storedHash = '') => {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (hashBuffer.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, keyBuffer);
};

const encodeToken = (payload) => {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
};

const decodeToken = (token) => {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url');
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (Date.now() > payload.exp) return null;
  return payload;
};

const safeUser = (user) => {
  const { passwordHash, ...data } = user;
  return data;
};

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = decodeToken(token);

  if (!payload) return res.status(401).json({ error: 'Token inválido ou expirado' });
  req.user = payload;
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão para esta ação' });
  next();
};

const loginAttempts = new Map();
const authLimiter = (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const data = loginAttempts.get(key) || { count: 0, start: now };

  if (now - data.start > 15 * 60 * 1000) {
    loginAttempts.set(key, { count: 1, start: now });
    return next();
  }

  if (data.count >= 25) {
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
  }

  data.count += 1;
  loginAttempts.set(key, data);
  next();
};

let users = [];
let rides = [];

const seedUsers = () => {
  users = [
    { id: 1, name: 'Carlos Silva', email: 'motorista@teste.com', passwordHash: hashPassword('123456'), role: 'DRIVER', phone: '69999999999', vehicleType: 'CARRO', carModel: 'Fiorino Branca 2020', rating: 4.9, totalRatings: 1, trips: 154, isAvailable: true, isVerified: true, plan: 'VIP', photo: 'https://randomuser.me/api/portraits/men/32.jpg' },
    { id: 2, name: 'Ana Pereira', email: 'ana@teste.com', passwordHash: hashPassword('123456'), role: 'DRIVER', phone: '69988888888', vehicleType: 'CAMINHAO', carModel: 'Caminhão 3/4 Baú', rating: 5, totalRatings: 1, trips: 42, isAvailable: true, isVerified: false, plan: 'FREE', photo: 'https://randomuser.me/api/portraits/women/44.jpg' },
    { id: 3, name: 'João Cliente', email: 'cliente@teste.com', passwordHash: hashPassword('123456'), role: 'CLIENT', phone: '69911111111' }
  ];
};

app.use(cors());
app.use(express.json());

app.post('/api/register', authLimiter, (req, res) => {
  const { name, email, password, role, phone, carModel, vehicleType } = req.body;
  if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Nome deve ter no mínimo 3 caracteres' });
  if (!isEmail(email)) return res.status(400).json({ error: 'E-mail inválido' });
  if (!isStrongPassword(password)) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });

  const cleanPhone = sanitizePhone(phone);
  if (cleanPhone.length < 10 || cleanPhone.length > 11) return res.status(400).json({ error: 'Telefone inválido' });
  if (!['CLIENT', 'DRIVER'].includes(role)) return res.status(400).json({ error: 'Perfil inválido' });
  if (role === 'DRIVER' && (!carModel || !vehicleType)) return res.status(400).json({ error: 'Motorista deve informar veículo' });
  if (users.find((u) => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(400).json({ error: 'Email já cadastrado' });

  const newUser = {
    id: Date.now(),
    name: name.trim(),
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role,
    phone: cleanPhone,
    carModel: role === 'DRIVER' ? carModel : null,
    vehicleType: role === 'DRIVER' ? vehicleType : null,
    rating: 5,
    totalRatings: 0,
    trips: 0,
    isAvailable: role === 'DRIVER',
    isVerified: false,
    plan: 'FREE',
    photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=fff`
  };

  users.push(newUser);
  return res.status(201).json({ token: encodeToken({ id: newUser.id, role: newUser.role, email: newUser.email }), user: safeUser(newUser) });
});

app.post('/api/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user || !checkPassword(password || '', user.passwordHash)) return res.status(401).json({ error: 'Dados incorretos' });

  return res.json({ token: encodeToken({ id: user.id, role: user.role, email: user.email }), user: safeUser(user) });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(safeUser(user));
});

app.get('/api/drivers', authMiddleware, (req, res) => {
  const vehicleType = req.query.vehicleType;
  let drivers = users.filter((u) => u.role === 'DRIVER' && u.isAvailable);
  if (vehicleType) drivers = drivers.filter((d) => d.vehicleType === vehicleType);

  drivers.sort((a, b) => {
    if (a.plan === 'VIP' && b.plan !== 'VIP') return -1;
    if (a.plan !== 'VIP' && b.plan === 'VIP') return 1;
    return b.rating - a.rating;
  });

  return res.json(drivers.map(safeUser));
});

app.post('/api/rides', authMiddleware, requireRole('CLIENT'), (req, res) => {
  const { from, to, distance, selectedItems, needHelper, vehicleType, estimate, preferredDriverId } = req.body;
  if (!from || !to || !vehicleType) return res.status(400).json({ error: 'Preencha origem, destino e tipo de veículo' });

  const ride = { id: Date.now(), clientId: req.user.id, driverId: preferredDriverId || null, from, to, distance, selectedItems: selectedItems || [], needHelper: Boolean(needHelper), vehicleType, estimate, status: preferredDriverId ? 'ACCEPTED' : 'OPEN', createdAt: new Date().toISOString(), receiptCode: null, clientRating: null, driverRating: null };
  rides.unshift(ride);
  return res.status(201).json(ride);
});

app.get('/api/rides/open', authMiddleware, requireRole('DRIVER'), (req, res) => {
  const openRides = rides.filter((r) => r.status === 'OPEN').map((ride) => ({ ...ride, client: safeUser(users.find((u) => u.id === ride.clientId) || {}) }));
  return res.json(openRides);
});

app.get('/api/rides/my', authMiddleware, (req, res) => {
  const myRides = rides.filter((r) => (req.user.role === 'CLIENT' ? r.clientId === req.user.id : r.driverId === req.user.id)).map((ride) => ({ ...ride, client: safeUser(users.find((u) => u.id === ride.clientId) || {}), driver: safeUser(users.find((u) => u.id === ride.driverId) || {}) }));
  return res.json(myRides);
});

app.post('/api/rides/:id/claim', authMiddleware, requireRole('DRIVER'), (req, res) => {
  const ride = rides.find((r) => r.id === Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Frete não encontrado' });
  if (ride.status !== 'OPEN') return res.status(400).json({ error: 'Frete já em andamento' });

  ride.driverId = req.user.id;
  ride.status = 'ACCEPTED';
  return res.json(ride);
});

app.patch('/api/rides/:id/status', authMiddleware, requireRole('DRIVER'), (req, res) => {
  const { status } = req.body;
  const ride = rides.find((r) => r.id === Number(req.params.id));
  if (!ride) return res.status(404).json({ error: 'Frete não encontrado' });
  if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Frete pertence a outro motorista' });

  const allowed = ['ON_ROUTE', 'COMPLETED', 'CANCELED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  ride.status = status;
  if (status === 'COMPLETED') {
    ride.receiptCode = `REC-${ride.id}-${new Date().getFullYear()}`;
    const driver = users.find((u) => u.id === req.user.id);
    if (driver) driver.trips += 1;
  }

  return res.json(ride);
});

app.post('/api/rides/:id/rate', authMiddleware, (req, res) => {
  const { score } = req.body;
  const ride = rides.find((r) => r.id === Number(req.params.id));

  if (!ride) return res.status(404).json({ error: 'Frete não encontrado' });
  if (ride.status !== 'COMPLETED') return res.status(400).json({ error: 'Só é possível avaliar frete concluído' });
  if (score < 1 || score > 5) return res.status(400).json({ error: 'Nota deve ser entre 1 e 5' });

  if (req.user.role === 'CLIENT') {
    if (ride.clientId !== req.user.id) return res.status(403).json({ error: 'Sem permissão para avaliar' });
    ride.clientRating = score;
    const driver = users.find((u) => u.id === ride.driverId);
    if (driver) {
      const total = driver.rating * driver.totalRatings + score;
      driver.totalRatings += 1;
      driver.rating = Number((total / driver.totalRatings).toFixed(2));
    }
  }

  if (req.user.role === 'DRIVER') {
    if (ride.driverId !== req.user.id) return res.status(403).json({ error: 'Sem permissão para avaliar' });
    ride.driverRating = score;
  }

  return res.json(ride);
});

app.post('/api/driver/status', authMiddleware, requireRole('DRIVER'), (req, res) => {
  const { isAvailable } = req.body;
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  user.isAvailable = Boolean(isAvailable);
  return res.json(safeUser(user));
});

const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

seedUsers();
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
