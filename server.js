require('dotenv').config();
require('express-async-errors');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SESSION_SECRET = process.env.SESSION_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_SETUP_KEY = process.env.ADMIN_SETUP_KEY;

if (!SESSION_SECRET || !SUPABASE_URL || !SUPABASE_SECRET_KEY || !ADMIN_SETUP_KEY) {
  throw new Error('Missing required environment variables: SESSION_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_SETUP_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const STORAGE_BUCKET = 'itsa-uploads';

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

async function readDb() {
  const { data, error } = await supabase
    .from('itsa_site_data')
    .select('data')
    .eq('id', 'main')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const initial = defaults();
    const { error: insertError } = await supabase
      .from('itsa_site_data')
      .insert({ id: 'main', data: initial, updated_at: now() });
    if (insertError && insertError.code !== '23505') throw insertError;
    if (insertError?.code === '23505') return readDb();
    return initial;
  }
  return { ...defaults(), ...data.data };
}

async function writeDb(nextDb) {
  const { error } = await supabase
    .from('itsa_site_data')
    .upsert({ id: 'main', data: nextDb, updated_at: now() }, { onConflict: 'id' });
  if (error) throw error;
}

let db = defaults();

class SupabaseSessionStore extends session.Store {
  get(sid, callback) {
    supabase.from('itsa_sessions').select('data, expires_at').eq('id', sid).maybeSingle()
      .then(({ data, error }) => {
        if (error) return callback(error);
        if (!data) return callback(null, null);
        if (new Date(data.expires_at).getTime() <= Date.now()) {
          this.destroy(sid, () => callback(null, null));
          return;
        }
        callback(null, data.data);
      }).catch(callback);
  }
  set(sid, sess, callback = () => {}) {
    const expires = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
    supabase.from('itsa_sessions').upsert({ id: sid, data: sess, expires_at: expires.toISOString() }, { onConflict: 'id' })
      .then(({ error }) => callback(error || undefined)).catch(callback);
  }
  touch(sid, sess, callback = () => {}) { this.set(sid, sess, callback); }
  destroy(sid, callback = () => {}) {
    supabase.from('itsa_sessions').delete().eq('id', sid)
      .then(({ error }) => callback(error || undefined)).catch(callback);
  }
}

function uploadImageToSupabase(req, res, next) {
  if (!req.file) return next();
  const ext = (path.extname(req.file.originalname || '').toLowerCase() || '.img').replace(/[^.a-z0-9]/g, '');
  const objectPath = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${ext}`;
  supabase.storage.from(STORAGE_BUCKET).upload(objectPath, req.file.buffer, {
    contentType: req.file.mimetype,
    cacheControl: '3600',
    upsert: false
  }).then(({ error }) => {
    if (error) return next(error);
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
    req.file.publicUrl = data.publicUrl;
    req.file.storagePath = objectPath;
    next();
  }).catch(next);
}

async function removeUploaded(url) {
  if (typeof url !== 'string' || !url.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`)) return;
  const objectPath = decodeURIComponent(url.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`)[1].split('?')[0]);
  if (objectPath) {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    if (error) console.error('Could not remove stored image:', error.message);
  }
}

app.disable('x-powered-by');
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'], mediaSrc: ["'self'", 'blob:', 'https:'], connectSrc: ["'self'"],
  objectSrc: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: null
} }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(session({
  name: 'itsa.sid', store: new SupabaseSessionStore(), secret: SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
// Vercel serves files in /public through its CDN. Keep this middleware for local development.
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: 0 }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });
const imageUpload = multer({
  storage: multer.memoryStorage(),
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
app.use('/api', sameOrigin, async (_req, res, next) => {
  try { db = await readDb(); next(); }
  catch (error) { console.error('Supabase database read failed:', error); res.status(500).json({ error: 'Could not load website data.' }); }
});

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
app.get('/api/setup/status', (_req, res) => res.json({ needsSetup: db.admins.length === 0 }));
app.post('/api/setup', loginLimiter, async (req, res) => {
  if (db.admins.length) return res.status(409).json({ error: 'Admin setup has already been completed.' });
  const key = clean(req.body.setupKey, 200);
  const email = clean(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || '');
  if (!ADMIN_SETUP_KEY || key !== ADMIN_SETUP_KEY) return res.status(403).json({ error: 'The setup key is incorrect.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 12) return res.status(400).json({ error: 'Use a password with at least 12 characters.' });
  const admin = { id: makeId(), email, passwordHash: await bcrypt.hash(password, 12), createdAt: now() };
  db.admins.push(admin); await writeDb(db);
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
app.post('/api/admin/events', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  const fields = eventInputFields(req.body);
  if (!fields.title) { if (req.file?.publicUrl) await removeUploaded(req.file.publicUrl); return res.status(400).json({ error: 'Event title is required.' }); }
  const item = { id: makeId(), ...fields, coverImage: req.file ? req.file.publicUrl : '', createdAt: now(), updatedAt: now() };
  if (item.featured) db.events.forEach(e => e.featured = false);
  db.events.unshift(item); await writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/events/:id', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  const item = db.events.find(x => x.id === req.params.id);
  if (!item) { if (req.file?.publicUrl) await removeUploaded(req.file.publicUrl); return res.status(404).json({ error: 'Event not found.' }); }
  const oldImage = item.coverImage;
  Object.assign(item, eventInputFields(req.body), { updatedAt: now() });
  if (req.file) item.coverImage = req.file.publicUrl;
  else if (req.body.removeImage === 'true') item.coverImage = '';
  if (item.featured) db.events.forEach(e => { if (e.id !== item.id) e.featured = false; });
  await writeDb(db); if (oldImage && oldImage !== item.coverImage) await removeUploaded(oldImage); res.json(item);
});
app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
  const index = db.events.findIndex(x => x.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Event not found.' });
  const [item] = db.events.splice(index, 1); await removeUploaded(item.coverImage); await writeDb(db); res.json({ ok: true });
});

// GALLERY
app.post('/api/admin/gallery', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
  const item = { id: makeId(), title: clean(req.body.title, 120) || 'ITSA moment', category: clean(req.body.category, 50) || 'Event', caption: clean(req.body.caption, 300), image: req.file.publicUrl, published: req.body.published !== 'false', createdAt: now() };
  db.gallery.unshift(item); await writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/gallery/:id', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  const item = db.gallery.find(x => x.id === req.params.id);
  if (!item) { if (req.file?.publicUrl) await removeUploaded(req.file.publicUrl); return res.status(404).json({ error: 'Gallery image not found.' }); }
  const old = item.image;
  item.title = clean(req.body.title, 120) || item.title;
  item.category = clean(req.body.category, 50) || item.category;
  item.caption = clean(req.body.caption, 300);
  if (req.body.published !== undefined) item.published = req.body.published === 'true';
  if (req.file) item.image = req.file.publicUrl;
  await writeDb(db); if (req.file) await removeUploaded(old); res.json(item);
});
app.delete('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
  const i = db.gallery.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Image not found.' });
  const [item] = db.gallery.splice(i, 1); await removeUploaded(item.image); await writeDb(db); res.json({ ok: true });
});

// TEAM
const teamFields = { name: 100, role: 100, department: 80, bio: 500, linkedin: 500, instagram: 500, order: 10, published: 5 };
app.post('/api/admin/team', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  const fields = safeRecord(req.body, teamFields);
  if (!fields.name || !fields.role) { if (req.file?.publicUrl) await removeUploaded(req.file.publicUrl); return res.status(400).json({ error: 'Name and role are required.' }); }
  const item = { id: makeId(), ...fields, photo: req.file ? req.file.publicUrl : '', createdAt: now() };
  db.team.push(item); await writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/team/:id', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  const item = db.team.find(x => x.id === req.params.id);
  if (!item) { if (req.file?.publicUrl) await removeUploaded(req.file.publicUrl); return res.status(404).json({ error: 'Team member not found.' }); }
  const old = item.photo; Object.assign(item, safeRecord(req.body, teamFields));
  if (req.file) item.photo = req.file.publicUrl;
  else if (req.body.removeImage === 'true') item.photo = '';
  await writeDb(db); if (old && old !== item.photo) await removeUploaded(old); res.json(item);
});
app.delete('/api/admin/team/:id', requireAdmin, async (req, res) => {
  const i = db.team.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Team member not found.' });
  const [item] = db.team.splice(i, 1); await removeUploaded(item.photo); await writeDb(db); res.json({ ok: true });
});

// SPONSORS
app.post('/api/admin/sponsors', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  const name = clean(req.body.name, 120); const tier = ['Title','Gold','Silver'].includes(req.body.tier) ? req.body.tier : 'Silver';
  if (!name) { if (req.file?.publicUrl) await removeUploaded(req.file.publicUrl); return res.status(400).json({ error: 'Sponsor name is required.' }); }
  const item = { id: makeId(), name, tier, website: clean(req.body.website, 500), description: clean(req.body.description, 300), logo: req.file ? req.file.publicUrl : '', published: req.body.published !== 'false', createdAt: now() };
  db.sponsors.push(item); await writeDb(db); res.status(201).json(item);
});
app.put('/api/admin/sponsors/:id', requireAdmin, imageUpload.single('image'), uploadImageToSupabase, async (req, res) => {
  const item = db.sponsors.find(x => x.id === req.params.id);
  if (!item) { if (req.file?.publicUrl) await removeUploaded(req.file.publicUrl); return res.status(404).json({ error: 'Sponsor not found.' }); }
  const old = item.logo; item.name = clean(req.body.name, 120) || item.name;
  item.tier = ['Title','Gold','Silver'].includes(req.body.tier) ? req.body.tier : item.tier;
  item.website = clean(req.body.website, 500); item.description = clean(req.body.description, 300);
  if (req.body.published !== undefined) item.published = req.body.published === 'true';
  if (req.file) item.logo = req.file.publicUrl;
  else if (req.body.removeImage === 'true') item.logo = '';
  await writeDb(db); if (old && old !== item.logo) await removeUploaded(old); res.json(item);
});
app.delete('/api/admin/sponsors/:id', requireAdmin, async (req, res) => {
  const i = db.sponsors.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Sponsor not found.' });
  const [item] = db.sponsors.splice(i, 1); await removeUploaded(item.logo); await writeDb(db); res.json({ ok: true });
});

// SETTINGS + PASSWORD
app.put('/api/admin/settings', requireAdmin, async (req, res) => {
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
  await writeDb(db); res.json(s);
});
app.put('/api/admin/password', requireAdmin, async (req, res) => {
  const current = String(req.body.currentPassword || ''); const next = String(req.body.newPassword || '');
  if (!(await bcrypt.compare(current, req.admin.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (next.length < 12) return res.status(400).json({ error: 'New password must be at least 12 characters.' });
  req.admin.passwordHash = await bcrypt.hash(next, 12); await writeDb(db); res.json({ ok: true });
});

app.get('/admin', (_req, res) => res.redirect(302, '/admin/index.html'));
app.get('/admin/', (_req, res) => res.redirect(302, '/admin/index.html'));
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

if (require.main === module) app.listen(PORT, () => console.log(`ITSA website running at http://localhost:${PORT}\nPublic site: http://localhost:${PORT}\nAdmin panel: http://localhost:${PORT}/admin`));

module.exports = app;
