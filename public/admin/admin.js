(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { data: null, page: 'dashboard', editing: null };
  const labels = { events: 'Events', gallery: 'Gallery', team: 'Team directory', sponsors: 'Sponsors', settings: 'Site settings', dashboard: 'Dashboard' };

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
      headers.set('Content-Type', 'application/json'); options.body = JSON.stringify(options.body);
    }
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }
  function message(selector, text, error = false) { const el = $(selector); if (!el) return; el.textContent = text || ''; el.classList.toggle('error', error); }
  let toastTimer;
  function toast(text) { const el = $('#toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2700); }
  const dateText = value => { if (!value) return 'DATE TBA'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase(); };

  async function init() {
    try {
      const session = await api('/api/auth/session');
      if (session.authenticated) { showAdmin(session.email); return; }
      const setup = await api('/api/setup/status');
      showAuth(setup.needsSetup);
    } catch (error) { showAuth(false); message('#loginMessage', error.message, true); }
  }
  function showAuth(needsSetup) {
    $('#authShell').hidden = false; $('#adminShell').hidden = true;
    $('#loginView').hidden = needsSetup; $('#setupView').hidden = !needsSetup;
  }
  async function showAdmin(email) {
    $('#authShell').hidden = true; $('#adminShell').hidden = false; setText('#signedInEmail', email);
    await loadData(); showPage('dashboard');
  }
  function setText(selector, value) { const el = $(selector); if (el) el.textContent = value ?? ''; }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); message('#loginMessage', '');
    const form = new FormData(e.currentTarget);
    try { const result = await api('/api/auth/login', { method: 'POST', body: { email: form.get('email'), password: form.get('password') } }); await showAdmin(result.email); }
    catch (error) { message('#loginMessage', error.message, true); }
  });
  $('#setupForm').addEventListener('submit', async e => {
    e.preventDefault(); message('#setupMessage', '');
    const form = new FormData(e.currentTarget);
    try { const result = await api('/api/setup', { method: 'POST', body: { setupKey: form.get('setupKey'), email: form.get('email'), password: form.get('password') } }); toast('Admin account created.'); await showAdmin(result.email); }
    catch (error) { message('#setupMessage', error.message, true); }
  });
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); location.reload(); }
    catch (error) { toast(error.message); }
  });

  async function loadData() {
    state.data = await api('/api/admin/data');
    renderAll(); fillSettings();
  }
  function renderAll() {
    const d = state.data; if (!d) return;
    setText('#metricEvents', d.events.length); setText('#metricGallery', d.gallery.length); setText('#metricTeam', d.team.length);
    setText('#metricUpcoming', d.events.filter(x => x.status === 'upcoming' && x.published).length);
    setText('#navEvents', d.events.length); setText('#navGallery', d.gallery.length); setText('#navTeam', d.team.length); setText('#navSponsors', d.sponsors.length);
    renderRecent(); renderEvents(); renderGallery(); renderTeam(); renderSponsors();
  }
  function renderRecent() {
    const wrap = $('#recentEvents'); wrap.replaceChildren();
    const items = [...state.data.events].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,5);
    if (!items.length) { wrap.innerHTML = '<div class="loading-line">No events added yet.</div>'; return; }
    items.forEach(item => {
      const row = document.createElement('div'); row.className = 'recent-row';
      const text = document.createElement('div'); const title = document.createElement('strong'); title.textContent = item.title;
      const meta = document.createElement('small'); meta.textContent = `${item.category || 'EVENT'} · ${dateText(item.date)}`; text.append(title, meta);
      const status = document.createElement('span'); status.className = `status-pill ${item.status}`; status.textContent = item.published ? item.status : 'hidden';
      row.append(text, status); wrap.append(row);
    });
  }
  function card(type, item, config = {}) {
    const article = document.createElement('article'); article.className = 'content-card';
    const thumb = document.createElement('div'); thumb.className = 'content-thumb';
    const image = item.coverImage || item.image || item.photo || item.logo;
    if (image) { const img = document.createElement('img'); img.src = image; img.alt = ''; thumb.append(img); }
    else { const initials = document.createElement('span'); initials.textContent = (item.name || item.title || 'IT').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); thumb.append(initials); }
    const body = document.createElement('div'); body.className = 'content-body';
    const title = document.createElement('h3'); title.textContent = item.title || item.name || 'Untitled'; body.append(title);
    const desc = document.createElement('p');
    if (type === 'events') desc.textContent = `${item.subtitle || item.category || 'Event'} · ${dateText(item.date)}`;
    else if (type === 'team') desc.textContent = `${item.role || ''} · ${item.department || ''}`;
    else if (type === 'sponsors') desc.textContent = `${item.tier || 'Silver'} tier · ${item.website || 'No website link'}`;
    else desc.textContent = `${item.category || 'Event'} · ${item.caption || 'No caption'}`;
    body.append(desc);
    const meta = document.createElement('div'); meta.className = 'content-meta';
    const visibility = item.published ? 'PUBLISHED' : 'HIDDEN';
    meta.textContent = `${visibility}${type === 'events' ? ` · ${String(item.status || 'draft').toUpperCase()}${item.featured ? ' · FEATURED' : ''}` : ''}`;
    body.append(meta);
    const actions = document.createElement('div'); actions.className = 'content-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'EDIT'; edit.dataset.edit = type; edit.dataset.id = item.id;
    const del = document.createElement('button'); del.type = 'button'; del.textContent = 'DELETE'; del.className = 'delete-btn'; del.dataset.delete = type; del.dataset.id = item.id;
    actions.append(edit, del); body.append(actions); article.append(thumb, body); return article;
  }
  function renderCollection(selector, type, items, emptyText) {
    const wrap = $(selector); wrap.replaceChildren();
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'team-empty'; empty.style.gridColumn = '1/-1'; empty.textContent = emptyText; wrap.append(empty); return; }
    items.forEach(item => wrap.append(card(type, item)));
  }
  function renderEvents() {
    const filter = $('#eventStatusFilter')?.value || 'all';
    const items = state.data.events.filter(item => filter === 'all' || item.status === filter);
    setText('#eventsCount', `${items.length} EVENTS`); renderCollection('#eventsCollection', 'events', items, 'No events yet. Add your first event.');
  }
  function renderGallery() { renderCollection('#galleryCollection', 'gallery', state.data.gallery, 'No gallery images yet. Upload your first event photo.'); }
  function renderTeam() { renderCollection('#teamCollection', 'team', state.data.team, 'No team members yet. Add the ITSA committee.'); }
  function renderSponsors() { renderCollection('#sponsorsCollection', 'sponsors', state.data.sponsors, 'No sponsors listed yet. Add a partner when you have one.'); }
  $('#eventStatusFilter').addEventListener('change', renderEvents);

  function showPage(page) {
    if (!labels[page]) return;
    state.page = page; $$('.page').forEach(x => x.classList.toggle('active', x.id === `page-${page}`));
    $$('.side-link').forEach(x => x.classList.toggle('active', x.dataset.page === page));
    setText('#pageTitle', labels[page]); $('#sidebar').classList.remove('open');
  }
  $$('.side-link').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]'); if (go) showPage(go.dataset.go);
    const action = e.target.closest('[data-action]'); if (action) openEditor(action.dataset.action);
    const edit = e.target.closest('[data-edit]'); if (edit) { const type = edit.dataset.edit; const item = state.data[type].find(x => x.id === edit.dataset.id); const editorType = ({ events: 'event', gallery: 'gallery', team: 'team', sponsors: 'sponsor' })[type]; if (item && editorType) openEditor(editorType, item); }
    const del = e.target.closest('[data-delete]'); if (del) deleteItem(del.dataset.delete, del.dataset.id);
  });
  $('#quickAddEvent').addEventListener('click', () => openEditor('event'));
  $('#sidebarToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  const options = (items, selected) => items.map(x => `<option value="${esc(x)}" ${x === selected ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const field = (label, name, value = '', type = 'text', full = false, attrs = '') => `<label class="${full ? 'full' : ''}">${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
  const textarea = (label, name, value = '', full = false, rows = 3) => `<label class="${full ? 'full' : ''}">${esc(label)}<textarea name="${esc(name)}" rows="${rows}">${esc(value)}</textarea></label>`;
  const selectField = (label, name, items, selected, full = false) => `<label class="${full ? 'full' : ''}">${esc(label)}<select name="${esc(name)}">${options(items, selected)}</select></label>`;
  const checkbox = (label, name, checked) => `<div class="check-row"><label><input name="${esc(name)}" type="checkbox" ${checked ? 'checked' : ''}> ${esc(label)}</label></div>`;
  function editorMarkup(type, item = {}) {
    const edit = Boolean(item.id); let fields = '';
    if (type === 'event') {
      fields = field('Event title *','title',item.title || '', 'text',true,'required maxlength="100"') +
        field('Subtitle','subtitle',item.subtitle || '', 'text',false,'maxlength="140"') +
        selectField('Category','category',['Hackathon','Workshop','Seminar','Cultural','Sports','AI / ML','Web Dev','Contest','Other'],item.category || 'Hackathon') +
        field('Duration / format','duration',item.duration || '') + field('Event date','date',item.date ? item.date.slice(0,10) : '', 'date') + field('Location','location',item.location || 'PCCOER, Ravet') +
        field('Registration URL','registrationUrl',item.registrationUrl || '', 'url',true,'placeholder="https://... or mailto:..."') +
        `<label class="full">Hero preview video URL (direct MP4 / WebM)<input name="previewVideoUrl" type="url" value="${esc(item.previewVideoUrl || '')}" placeholder="https://your-domain.com/event-preview.mp4"><small class="file-help">Optional. Use a direct HTTPS MP4/WebM link. It will autoplay muted and loop in the animated homepage event list.</small></label>` +
        textarea('Description','description',item.description || '',true,4) +
        selectField('Status','status',['upcoming','past','draft'],item.status || 'upcoming') +
        `<label class="full">Cover image <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"><small class="file-help">Optional. JPG, PNG, WEBP, GIF or AVIF · max 8 MB.${item.coverImage ? ' Existing image will be kept unless you choose a new one.' : ''}</small></label>` +
        (item.coverImage ? checkbox('Remove current cover image','removeImage',false) : '') +
        checkbox('Feature this event on the homepage','featured',Boolean(item.featured)) + checkbox('Visible on public website','published',item.published !== false);
    } else if (type === 'gallery') {
      fields = field('Image title *','title',item.title || '', 'text',true,'required maxlength="120"') +
        selectField('Category','category',['Event','Hackathon','Workshop','Seminar','Cultural','Sports','Team','Other'],item.category || 'Event') +
        textarea('Caption','caption',item.caption || '',true,3) +
        `<label class="full">${edit ? 'Replace image (optional)' : 'Choose image *'}<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" ${edit ? '' : 'required'}><small class="file-help">JPG, PNG, WEBP, GIF or AVIF · max 8 MB.${item.image ? ' Existing image will be kept unless you choose a new one.' : ''}</small></label>` +
        checkbox('Visible in public gallery','published',item.published !== false);
    } else if (type === 'team') {
      fields = field('Full name *','name',item.name || '', 'text',true,'required maxlength="100"') + field('Role / designation *','role',item.role || '', 'text',false,'required maxlength="100"') +
        selectField('Team / department','department',['Core Committee','Technical','Events','Creative'],item.department || 'Core Committee') + field('Display order','order',item.order ?? 0,'number',false,'min="0"') +
        textarea('Short bio','bio',item.bio || '',true,3) + field('LinkedIn URL','linkedin',item.linkedin || '', 'url') + field('Instagram URL','instagram',item.instagram || '', 'url') +
        `<label class="full">Profile photo (optional)<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"><small class="file-help">JPG, PNG, WEBP, GIF or AVIF · max 8 MB.</small></label>` +
        (item.photo ? checkbox('Remove current profile photo','removeImage',false) : '') +
        checkbox('Show on public website','published',item.published !== false);
    } else if (type === 'sponsor') {
      fields = field('Sponsor / partner name *','name',item.name || '', 'text',true,'required maxlength="120"') + selectField('Sponsor tier','tier',['Title','Gold','Silver'],item.tier || 'Silver') +
        field('Website URL','website',item.website || '', 'url',true) + textarea('Short description','description',item.description || '',true,2) +
        `<label class="full">Logo (optional)<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"><small class="file-help">JPG, PNG, WEBP, GIF or AVIF · max 8 MB.</small></label>` +
        (item.logo ? checkbox('Remove current logo','removeImage',false) : '') +
        checkbox('Show on public website','published',item.published !== false);
    }
    return fields;
  }
  function openEditor(type, item = null) {
    if (!['event','gallery','team','sponsor'].includes(type)) return;
    state.editing = { type, id: item?.id || null };
    const title = item ? `Edit ${type === 'team' ? 'team member' : type === 'gallery' ? 'gallery image' : type}` : `Add ${type === 'team' ? 'team member' : type === 'gallery' ? 'gallery image' : type}`;
    setText('#modalTitle', title); setText('#modalEyebrow', `CONTENT EDITOR / ${type.toUpperCase()}`);
    $('#editorFields').innerHTML = editorMarkup(type, item || {}); message('#editorMessage','');
    $('#modalSave').textContent = item ? 'Save changes ↗' : 'Create item ↗';
    $('#modalBackdrop').hidden = false; document.body.style.overflow = 'hidden';
    $('input:not([type=checkbox]),textarea,select', $('#editorFields'))?.focus();
  }
  function closeEditor() { $('#modalBackdrop').hidden = true; document.body.style.overflow = ''; state.editing = null; $('#editorForm').reset(); }
  $('#modalClose').addEventListener('click', closeEditor); $('#modalCancel').addEventListener('click', closeEditor);
  $('#modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeEditor(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modalBackdrop').hidden) closeEditor(); });

  $('#editorForm').addEventListener('submit', async e => {
    e.preventDefault(); if (!state.editing) return;
    const { type, id } = state.editing; const form = new FormData(e.currentTarget);
    const published = $('input[name="published"]', e.currentTarget);
    const featured = $('input[name="featured"]', e.currentTarget);
    const removeImage = $('input[name="removeImage"]', e.currentTarget);
    if (published) form.set('published', published.checked ? 'true' : 'false');
    if (featured) form.set('featured', featured.checked ? 'true' : 'false');
    if (removeImage) form.set('removeImage', removeImage.checked ? 'true' : 'false');
    const endpoints = { event: 'events', gallery: 'gallery', team: 'team', sponsor: 'sponsors' };
    const url = `/api/admin/${endpoints[type]}${id ? `/${encodeURIComponent(id)}` : ''}`;
    message('#editorMessage','Saving…'); $('#modalSave').disabled = true;
    try {
      await api(url, { method: id ? 'PUT' : 'POST', body: form });
      await loadData(); closeEditor(); toast(id ? 'Changes saved.' : 'Item created.');
      if (type === 'gallery') showPage('gallery'); else if (type === 'team') showPage('team'); else if (type === 'sponsor') showPage('sponsors'); else showPage('events');
    } catch (error) { message('#editorMessage', error.message, true); }
    finally { $('#modalSave').disabled = false; }
  });

  async function deleteItem(type, id) {
    const names = { events: 'this event', gallery: 'this gallery image', team: 'this team member', sponsors: 'this sponsor' };
    if (!window.confirm(`Delete ${names[type]}? This also removes its uploaded image where applicable.`)) return;
    try { await api(`/api/admin/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadData(); toast('Item deleted.'); }
    catch (error) { toast(error.message); }
  }

  function fillSettings() {
    if (!state.data) return; const s = state.data.settings || {}; const form = $('#settingsForm');
    for (const key of ['clubName','collegeName','heroEyebrow','heroTitle','heroDescription','about','aims','info','email','instagram','linkedin']) {
      const input = form.elements.namedItem(key); if (input) input.value = s[key] || '';
    }
    form.elements.namedItem('focusAreas').value = (s.focusAreas || []).join('\n');
    for (const key of ['eventsHosted','studentsEngaged','yearsActive','industrySpeakers']) form.elements.namedItem(key).value = s.stats?.[key] ?? 0;
  }
  $('#settingsForm').addEventListener('submit', async e => {
    e.preventDefault(); message('#settingsMessage','Saving…'); const f = new FormData(e.currentTarget);
    const body = {};
    for (const key of ['clubName','collegeName','heroEyebrow','heroTitle','heroDescription','about','aims','info','email','instagram','linkedin']) body[key] = f.get(key);
    body.focusAreas = String(f.get('focusAreas') || '').split('\n').map(x => x.trim()).filter(Boolean);
    body.stats = {}; for (const key of ['eventsHosted','studentsEngaged','yearsActive','industrySpeakers']) body.stats[key] = Number(f.get(key));
    try { await api('/api/admin/settings', { method: 'PUT', body }); await loadData(); message('#settingsMessage','Settings saved successfully.'); toast('Homepage settings updated.'); }
    catch (error) { message('#settingsMessage', error.message, true); }
  });
  $('#passwordForm').addEventListener('submit', async e => {
    e.preventDefault(); message('#passwordMessage','Updating…'); const f = new FormData(e.currentTarget);
    try { await api('/api/admin/password', { method: 'PUT', body: { currentPassword: f.get('currentPassword'), newPassword: f.get('newPassword') } }); e.currentTarget.reset(); message('#passwordMessage','Password updated successfully.'); toast('Password changed.'); }
    catch (error) { message('#passwordMessage', error.message, true); }
  });

  init().catch(error => { console.error(error); showAuth(false); message('#loginMessage', error.message, true); });
})();
