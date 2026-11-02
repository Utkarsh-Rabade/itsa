require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SETUP_KEY_FILE = path.join(DATA_DIR, 'setup-key.txt');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

for (const dir of [DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET is not set. A temporary secret is being used; set one in .env for stable sessions.');

const now = () => new Date().toISOString();
const makeId = () => crypto.randomUUID();
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const defaults = () => ({
  settings: {
    clubName: 'ITSA', collegeName: 'PCCOER · Student Association',
    email: 'pccoer.itsa@gmail.com', instagram: 'https://instagram.com/itsa_pccoer',
    linkedin: 'https://linkedin.com/company/itsa-pccoer',
    about: 'ITSA — the Information Technology Student Association — is the student community of the IT Department at Pimpri Chinchwad College of Engineering and Research, Pune. We connect classroom learning with real-world technology through hands-on experiences, peer learning, and industry interaction.',
    aims: 'An open community for IT students at PCCOER to build, learn, and lead. From hackathons to industry talks, we create opportunities that turn curiosity into capability.',
    focusAreas: ['Web & App Development', 'AI / Machine Learning', 'Cybersecurity', 'Competitive Programming'],
    stats: { eventsHosted: 12, studentsEngaged: 300, yearsActive: 5, industrySpeakers: 20 },
    heroEyebrow: 'INFORMATION TECHNOLOGY STUDENT ASSOCIATION',
    heroTitle: 'Build what\'s next.',
    heroDescription: 'A community for curious minds, ambitious builders, and the next generation of technology leaders at PCCOER.',
    info: 'Studies and events are published as they are built. Some content may be updated as the club grows.'
  },
  events: [
    { id: makeId(), title: 'TechNova 2026', subtitle: 'Annual Tech Fest', category: 'Hackathon', duration: '24 hrs', description: 'ITSA’s flagship technology festival. Update this event with the confirmed schedule, venue, rules, and registration link before publishing.', date: '', location: 'PCCOER, Ravet', registrationUrl: 'mailto:pccoer.itsa@gmail.com', previewVideoUrl: 'https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/oraciteslArea.mp4', coverImage: '', status: 'upcoming', featured: true, published: true, createdAt: now() },
    { id: makeId(), title: 'ITSA Talks', subtitle: 'Industry Speaker Series', category: 'Seminar', duration: 'Panel', description: 'Conversations with people working across the technology industry.', date: '', location: 'PCCOER, Ravet', registrationUrl: '', previewVideoUrl: 'https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/facet-glass-hero.mp4', coverImage: '', status: 'past', featured: false, published: true, createdAt: now() },
    { id: makeId(), title: 'AI/ML Workshop', subtitle: 'Hands-on Series', category: 'Workshop', duration: '3 days', description: 'A hands-on introduction to building with artificial intelligence and machine learning.', date: '', location: 'PCCOER, Ravet', registrationUrl: '', previewVideoUrl: 'https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/stellarmind-hero.mp4', coverImage: '', status: 'past', featured: false, published: true, createdAt: now() },
    { id: makeId(), title: 'Code Sprint', subtitle: 'Competitive Programming', category: 'Web Dev', duration: '6 hrs', description: 'A timed coding challenge focused on problem-solving and practical programming.', date: '', location: 'PCCOER, Ravet', registrationUrl: '', previewVideoUrl: 'https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/thedropthroughArea.mp4', coverImage: '', status: 'past', featured: false, published: true, createdAt: now() }
  ],
  gallery: [], team: [], sponsors: [], admins: []
});

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = defaults();
      writeDb(initial);
      return initial;
    }
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { ...defaults(), ...parsed };
  } catch (error) {
    console.error('Could not read data/db.json:', error.message);
    throw new Error('The website data file could not be read. Restore data/db.json from a backup or remove a corrupted file to reseed it.');
  }
}
function writeDb(db) {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
let db = readDb();

function ensureSetupKey() {
  if (db.admins.length) return;
  if (!fs.existsSync(SETUP_KEY_FILE)) {
    const key = crypto.randomBytes(24).toString('base64url');
    fs.writeFileSync(SETUP_KEY_FILE, key, { mode: 0o600 });
  }
  const key = fs.readFileSync(SETUP_KEY_FILE, 'utf8');
  console.log('\n====================================================');
  console.log('ITSA FIRST-ADMIN SETUP KEY (keep private):');
  console.log(key);
  console.log('Open /admin and use this key to create your admin.');
  console.log('====================================================\n');
}
ensureSetupKey();

app.disable('x-powered-by');
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'blob:'], mediaSrc: ["'self'", 'blob:', 'https:'], connectSrc: ["'self'"],
  objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: null
} }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(session({
  name: 'itsa.sid', secret: SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '7d', immutable: false }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const imageUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Upload a JPG, PNG, WEBP, GIF, or AVIF image.'));
    cb(null, true);
  }
});

function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'Please sign in again.' });
  const admin = db.admins.find(a => a.id === req.session.adminId);
  if (!admin) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Admin account not found. Please sign in again.' }); }
  req.admin = admin;
  next();
}
function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    const expected = new URL(`${req.protocol}://${req.get('host')}`).origin;
    if (new URL(origin).origin !== expected) return res.status(403).json({ error: 'Cross-origin request blocked.' });
  } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
  next();
}
app.use('/api', sameOrigin);

function safeRecord(record, fields) {
  const result = {};
  for (const [field, limit] of Object.entries(fields)) {
    if (field === 'published' || field === 'featured') result[field] = ['true', 'on', '1', true, 1].includes(record[field]);
    else if (field === 'status') result[field] = ['upcoming', 'past', 'draft'].includes(record[field]) ? record[field] : 'draft';
    else if (field === 'order') result[field] = Math.max(0, Math.min(9999, Number.parseInt(record[field], 10) || 0));
    else result[field] = clean(record[field], limit);
  }
  return result;
}
function removeUploaded(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const filename = path.basename(url);
  const target = path.join(UPLOAD_DIR, filename);
  if (path.dirname(target) === UPLOAD_DIR && fs.existsSync(target)) fs.unlinkSync(target);
}
function publicData() {
  return {
    settings: db.settings,
    events: db.events.filter(x => x.published && x.status !== 'draft').sort((a,b) => Number(b.featured) - Number(a.featured) || String(a.date).localeCompare(String(b.date))),
    gallery: db.gallery.filter(x => x.published).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    team: db.team.filter(x => x.published).sort((a,b) => (a.order || 0) - (b.order || 0)),
    sponsors: db.sponsors.filter(x => x.published).sort((a,b) => ['Title','Gold','Silver'].indexOf(a.tier) - ['Title','Gold','Silver'].indexOf(b.tier))
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ITSA website' }));
app.get('/api/public', (_req, res) => res.json(publicData()));
app.get('/api/setup/status', (_req, res) => res.json({ needsSetup: db.admins.length === 0 && fs.existsSync(SETUP_KEY_FILE) }));
app.post('/api/setup', loginLimiter, async (req, res) => {
  if (db.admins.length) return res.status(409).json({ error: 'Admin setup has already been completed.' });
  const key = clean(req.body.setupKey, 200);
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (!fs.existsSync(SETUP_KEY_FILE) || key !== fs.readFileSync(SETUP_KEY_FILE, 'utf8')) return res.status(403).json({ error: 'The setup key is incorrect.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 12) return res.status(400).json({ error: 'Use a password with at least 12 characters.' });
  const admin = { id: makeId(), email, passwordHash: await bcrypt.hash(password, 12), createdAt: now() };
  db.admins.push(admin); writeDb(db);
  fs.unlinkSync(SETUP_KEY_FILE);
  req.session.adminId = admin.id;
  res.json({ ok: true, email: admin.email });
});
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  const admin = db.admins.find(a => a.email === email);
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start a secure session.' });
    req.session.adminId = admin.id;
    res.json({ ok: true, email: admin.email });
  });
});
app.get('/api/auth/session', (req, res) => {
  const admin = db.admins.find(a => a.id === req.session.adminId);
  if (!admin) return res.json({ authenticated: false });
  res.json({ authenticated: true, email: admin.email });
});
app.post('/api/auth/logout', requireAdmin, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/admin/data', requireAdmin, (_req, res) => res.json({ ...db, admins: db.admins.map(a => ({ id: a.id, email: a.email, createdAt: a.createdAt })) }));

// EVENTS
const eventFields = { title: 100, subtitle: 140, category: 50, duration: 40, description: 1200, date: 40, location: 160, registrationUrl: 500, previewVideoUrl: 600, status: 20, featured: 5, published: 5 };
function eventInputFields(body) {
  const fields = safeRecord(body, eventFields);
  if (fields.previewVideoUrl) {
    try { const parsed = new URL(fields.previewVideoUrl); if (parsed.protocol !== 'https:') fields.previewVideoUrl = ''; }
    catch { fields.previewVideoUrl = ''; }
  }
  return fields;
}
app.post('/api/admin/events', requireAdmin, imageUpload.single('image'), (req, res) => {
  const fields = eventInputFields(req.body);
  if (!fields.title) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Event title is required.' }); }
  const item = { id: makeId(), ...fields, coverImage: req.file ? `/uploads/${req.file.filename}` : '', createdAt: now(), updatedAt: now() };
  if (item.featured) db.events.forEach(e => e.featured = false);
  db.events.unshift(item); writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/events/:id', requireAdmin, imageUpload.single('image'), (req, res) => {
  const item = db.events.find(x => x.id === req.params.id);
  if (!item) { if (req.file) fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Event not found.' }); }
  const oldImage = item.coverImage;
  Object.assign(item, eventInputFields(req.body), { updatedAt: now() });
  if (req.file) item.coverImage = `/uploads/${req.file.filename}`;
  else if (req.body.removeImage === 'true') item.coverImage = '';
  if (item.featured) db.events.forEach(e => { if (e.id !== item.id) e.featured = false; });
  writeDb(db); if (oldImage && oldImage !== item.coverImage) removeUploaded(oldImage); res.json(item);
});
app.delete('/api/admin/events/:id', requireAdmin, (req, res) => {
  const index = db.events.findIndex(x => x.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Event not found.' });
  const [item] = db.events.splice(index, 1); removeUploaded(item.coverImage); writeDb(db); res.json({ ok: true });
});

// GALLERY
app.post('/api/admin/gallery', requireAdmin, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
  const item = { id: makeId(), title: clean(req.body.title, 120) || 'ITSA moment', category: clean(req.body.category, 50) || 'Event', caption: clean(req.body.caption, 300), image: `/uploads/${req.file.filename}`, published: req.body.published !== 'false', createdAt: now() };
  db.gallery.unshift(item); writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/gallery/:id', requireAdmin, imageUpload.single('image'), (req, res) => {
  const item = db.gallery.find(x => x.id === req.params.id);
  if (!item) { if (req.file) fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Gallery image not found.' }); }
  const old = item.image;
  item.title = clean(req.body.title, 120) || item.title;
  item.category = clean(req.body.category, 50) || item.category;
  item.caption = clean(req.body.caption, 300);
  if (req.body.published !== undefined) item.published = req.body.published === 'true';
  if (req.file) item.image = `/uploads/${req.file.filename}`;
  writeDb(db); if (req.file) removeUploaded(old); res.json(item);
});
app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  const i = db.gallery.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Image not found.' });
  const [item] = db.gallery.splice(i, 1); removeUploaded(item.image); writeDb(db); res.json({ ok: true });
});

// TEAM
const teamFields = { name: 100, role: 100, department: 80, bio: 500, linkedin: 500, instagram: 500, order: 10, published: 5 };
app.post('/api/admin/team', requireAdmin, imageUpload.single('image'), (req, res) => {
  const fields = safeRecord(req.body, teamFields);
  if (!fields.name || !fields.role) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Name and role are required.' }); }
  const item = { id: makeId(), ...fields, photo: req.file ? `/uploads/${req.file.filename}` : '', createdAt: now() };
  db.team.push(item); writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/team/:id', requireAdmin, imageUpload.single('image'), (req, res) => {
  const item = db.team.find(x => x.id === req.params.id);
  if (!item) { if (req.file) fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Team member not found.' }); }
  const old = item.photo; Object.assign(item, safeRecord(req.body, teamFields));
  if (req.file) item.photo = `/uploads/${req.file.filename}`;
  else if (req.body.removeImage === 'true') item.photo = '';
  writeDb(db); if (old && old !== item.photo) removeUploaded(old); res.json(item);
});
app.delete('/api/admin/team/:id', requireAdmin, (req, res) => {
  const i = db.team.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Team member not found.' });
  const [item] = db.team.splice(i, 1); removeUploaded(item.photo); writeDb(db); res.json({ ok: true });
});

// SPONSORS
app.post('/api/admin/sponsors', requireAdmin, imageUpload.single('image'), (req, res) => {
  const name = clean(req.body.name, 120); const tier = ['Title','Gold','Silver'].includes(req.body.tier) ? req.body.tier : 'Silver';
  if (!name) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Sponsor name is required.' }); }
  const item = { id: makeId(), name, tier, website: clean(req.body.website, 500), description: clean(req.body.description, 300), logo: req.file ? `/uploads/${req.file.filename}` : '', published: req.body.published !== 'false', createdAt: now() };
  db.sponsors.push(item); writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/sponsors/:id', requireAdmin, imageUpload.single('image'), (req, res) => {
  const item = db.sponsors.find(x => x.id === req.params.id);
  if (!item) { if (req.file) fs.unlinkSync(req.file.path); return res.status(404).json({ error: 'Sponsor not found.' }); }
  const old = item.logo; item.name = clean(req.body.name, 120) || item.name;
  item.tier = ['Title','Gold','Silver'].includes(req.body.tier) ? req.body.tier : item.tier;
  item.website = clean(req.body.website, 500); item.description = clean(req.body.description, 300);
  if (req.body.published !== undefined) item.published = req.body.published === 'true';
  if (req.file) item.logo = `/uploads/${req.file.filename}`;
  else if (req.body.removeImage === 'true') item.logo = '';
  writeDb(db); if (old && old !== item.logo) removeUploaded(old); res.json(item);
});
app.delete('/api/admin/sponsors/:id', requireAdmin, (req, res) => {
  const i = db.sponsors.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Sponsor not found.' });
  const [item] = db.sponsors.splice(i, 1); removeUploaded(item.logo); writeDb(db); res.json({ ok: true });
});

// SETTINGS + PASSWORD
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const input = req.body || {};
  const s = db.settings;
  for (const key of ['clubName','collegeName','email','instagram','linkedin','about','aims','heroEyebrow','heroTitle','heroDescription','info']) {
    if (input[key] !== undefined) s[key] = clean(input[key], key === 'about' || key === 'aims' || key === 'heroDescription' || key === 'info' ? 1600 : 240);
  }
  if (Array.isArray(input.focusAreas)) s.focusAreas = input.focusAreas.slice(0, 12).map(x => clean(x, 80)).filter(Boolean);
  if (input.stats && typeof input.stats === 'object') {
    for (const key of ['eventsHosted','studentsEngaged','yearsActive','industrySpeakers']) {
      if (input.stats[key] !== undefined) s.stats[key] = Math.max(0, Math.min(100000, Number.parseInt(input.stats[key], 10) || 0));
    }
  }
  writeDb(db); res.json(s);
});
app.put('/api/admin/password', requireAdmin, async (req, res) => {
  const current = String(req.body.currentPassword || ''); const next = String(req.body.newPassword || '');
  if (!(await bcrypt.compare(current, req.admin.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (next.length < 12) return res.status(400).json({ error: 'New password must be at least 12 characters.' });
  req.admin.passwordHash = await bcrypt.hash(next, 12); writeDb(db); res.json({ ok: true });
});

app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));
app.get('/admin/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' });
  next();
});
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 8 MB or smaller.' : err.message });
  if (err.message && err.message.startsWith('Upload a ')) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Something went wrong on the server. Check the terminal for details.' });
});

app.listen(PORT, () => console.log(`ITSA website running at http://localhost:${PORT}\nPublic site: http://localhost:${PORT}\nAdmin panel: http://localhost:${PORT}/admin`));
