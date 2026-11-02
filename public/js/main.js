(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safeLink = (value, fallback = '#') => {
    const v = String(value || '').trim();
    if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
    return fallback;
  };
  const dateLabel = value => {
    if (!value) return 'DATE TO BE ANNOUNCED';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).toUpperCase();
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  };
  let siteData = null;
  let selectedCategory = 'All';
  let selectedTeam = 'All';
  let selectedHeroCategory = 'All';

  function setText(selector, value) { const el = $(selector); if (el && value !== undefined && value !== null) el.textContent = value; }
  function renderSettings(settings) {
    $$('.brand strong').forEach(el => { el.textContent = settings.clubName || 'ITSA'; });
    $$('.brand small').forEach(el => { el.textContent = settings.collegeName || 'PCCOER · Student Association'; });
    setText('#heroEyebrow', settings.heroEyebrow);
    const title = $('#heroTitle');
    if (title) {
      const raw = String(settings.heroTitle || "Build what's next.");
      const split = raw.lastIndexOf(' ');
      title.replaceChildren();
      if (split > 0) {
        title.append(document.createTextNode(`${raw.slice(0, split)}\n`));
        const em = document.createElement('em'); em.textContent = raw.slice(split + 1); title.append(em);
      } else title.textContent = raw;
    }
    setText('#heroDescription', settings.heroDescription);
    setText('#aboutText', settings.about);
    setText('#aimsText', settings.aims);
    const email = settings.email || 'pccoer.itsa@gmail.com';
    setText('#heroAimsText', settings.aims);
    setText('#heroInfoText', settings.info || 'Studies and events are published as they are built. Some content may be updated as the club grows.');
    const heroExploring = $('#heroExploring');
    if (heroExploring) { heroExploring.replaceChildren(); (settings.focusAreas || []).forEach(item => { const li = document.createElement('li'); li.textContent = item; heroExploring.append(li); }); }
    const heroEmail = $('#heroEmail'); if (heroEmail) { heroEmail.href = `mailto:${email}`; heroEmail.textContent = `MAIL → ${email.toUpperCase()}`; }
    const heroInstagram = $('#heroInstagram'); if (heroInstagram) { heroInstagram.href = safeLink(settings.instagram, '#'); heroInstagram.textContent = `INSTAGRAM → ${(settings.instagram || '@ITSA_PCCOER').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/$/, '').toUpperCase()}`; }
    const heroLinkedin = $('#heroLinkedin'); if (heroLinkedin) heroLinkedin.href = safeLink(settings.linkedin, '#');
    const stats = settings.stats || {};
    for (const [key, value] of Object.entries(stats)) {
      const el = $(`[data-stat="${key}"]`);
      if (el) { el.textContent = Number(value).toLocaleString('en-IN'); const plus = document.createElement('span'); plus.textContent = '+'; el.append(plus); }
    }
    const focus = $('#focusAreas');
    if (focus) {
      focus.replaceChildren();
      (settings.focusAreas || []).forEach(item => { const span = document.createElement('span'); span.textContent = item; focus.append(span); });
    }
    const contact = $('#contactEmail'); if (contact) { contact.href = `mailto:${email}`; contact.firstChild.textContent = email.toUpperCase() + ' '; }
    const sponsorContact = $('#sponsorContact'); if (sponsorContact) sponsorContact.href = `mailto:${email}`;
    const ig = $('#footerInstagram'); if (ig) ig.href = safeLink(settings.instagram, '#');
    const li = $('#footerLinkedin'); if (li) li.href = safeLink(settings.linkedin, '#');
    setText('#year', new Date().getFullYear());
  }

  function renderFeatured(events) {
    const feature = events.find(e => e.featured) || events.find(e => e.status === 'upcoming');
    if (!feature) {
      const wrap = $('#featuredEvent');
      if (wrap) wrap.innerHTML = '<div class="featured-content featured-no-event"><div class="event-kicker">ITSA / EVENTS</div><h3>Something is<br>in the works.</h3><p>New events will be announced here. Check back soon.</p><a class="button button-outline" href="mailto:pccoer.itsa@gmail.com">Contact ITSA <span>↗</span></a></div>';
      return;
    }
    setText('#featuredStatus', feature.status === 'upcoming' ? 'UPCOMING EVENT' : 'FROM THE ARCHIVE');
    setText('#featuredCategory', `${feature.category || 'EVENT'}${feature.duration ? ` · ${feature.duration}` : ''}`.toUpperCase());
    setText('#featuredTitle', feature.title);
    setText('#featuredDescription', feature.description || feature.subtitle || 'More details coming soon.');
    setText('#featuredDate', dateLabel(feature.date));
    setText('#featuredLocation', (feature.location || 'PCCOER').toUpperCase());
    const image = $('#featuredImage');
    if (image) {
      const old = $('img', image); if (old) old.remove();
      if (feature.coverImage) { const img = document.createElement('img'); img.src = feature.coverImage; img.alt = feature.title; image.append(img); }
    }
    const link = $('#featuredLink');
    if (link) {
      const href = safeLink(feature.registrationUrl, `mailto:${siteData?.settings?.email || 'pccoer.itsa@gmail.com'}`);
      link.href = href; link.target = href.startsWith('http') ? '_blank' : '_self'; link.rel = 'noopener';
      link.innerHTML = 'View event details <span>↗</span>';
    }
  }

  function renderEvents(events) {
    const list = $('#eventList'); if (!list) return;
    const visible = events.filter(e => selectedCategory === 'All' || e.category === selectedCategory);
    setText('#eventCount', `${visible.length.toString().padStart(2, '0')} EVENTS`);
    list.replaceChildren();
    if (!visible.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No events in this category yet.'; list.append(empty); return; }
    visible.forEach((event, index) => {
      const row = document.createElement('article'); row.className = 'event-row'; row.dataset.eventId = event.id;
      const num = document.createElement('span'); num.className = 'event-row-num'; num.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('div'); const title = document.createElement('h4'); title.textContent = event.title;
      const meta = document.createElement('p'); meta.textContent = `${event.category || 'EVENT'}${event.duration ? ` · ${event.duration}` : ''}`;
      info.append(title, meta);
      const date = document.createElement('time'); date.textContent = event.date ? dateLabel(event.date) : (event.status === 'upcoming' ? 'COMING SOON' : 'ITSA');
      row.append(num, info, date); list.append(row);
    });
  }

  function renderHeroEvents(events) {
    const list = $('#heroProjectList');
    if (!list) return;
    const visible = events.filter(event => selectedHeroCategory === 'All' || event.category === selectedHeroCategory);
    setText('#heroCounter', String(events.length).padStart(2, '0'));
    list.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement('div'); empty.className = 'hero-project-empty';
      empty.textContent = 'NO EVENTS IN THIS CATEGORY YET.'; list.append(empty); return;
    }
    visible.slice(0, 8).forEach((event, index) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = `hero-project-card${index === 0 ? ' active' : ''}`;
      card.setAttribute('aria-label', `View ${event.title} details`);
      const thumb = document.createElement('div'); thumb.className = 'hero-project-thumb';
      const videoUrl = safeLink(event.previewVideoUrl, '');
      if (videoUrl && /^https:\/\//i.test(videoUrl)) {
        const video = document.createElement('video'); video.src = videoUrl; video.autoplay = true; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'metadata'; video.setAttribute('aria-hidden', 'true');
        video.addEventListener('error', () => { video.remove(); if (event.coverImage) { const img=document.createElement('img'); img.src=event.coverImage; img.alt=''; thumb.prepend(img); } else { const fallback=document.createElement('span'); fallback.className='hero-thumb-fallback'; fallback.innerHTML='<i></i><b>ITSA</b><small>EVENT PREVIEW</small>'; thumb.prepend(fallback); } });
        thumb.append(video);
      } else if (event.coverImage) {
        const img = document.createElement('img'); img.src = event.coverImage; img.alt = ''; img.loading = 'lazy'; thumb.append(img);
      } else {
        const fallback = document.createElement('span'); fallback.className = 'hero-thumb-fallback';
        fallback.innerHTML = '<i></i><b>ITSA</b><small>EVENT PREVIEW</small>'; thumb.append(fallback);
      }
      const play = document.createElement('span'); play.className = 'hero-project-play'; play.textContent = '▶'; thumb.append(play);
      const meta = document.createElement('span'); meta.className = 'hero-project-meta';
      const left = document.createElement('span');
      const title = document.createElement('strong'); title.className = 'hero-project-name'; title.textContent = event.title || 'ITSA EVENT';
      const subtitle = document.createElement('small'); subtitle.className = 'hero-project-sub'; subtitle.textContent = event.subtitle || event.description || 'ITSA / PCCOER';
      left.append(title, subtitle);
      const right = document.createElement('span'); right.className = 'hero-project-side';
      right.textContent = `${event.category || 'EVENT'}${event.duration ? `\n${event.duration}` : ''}`;
      meta.append(left, right); card.append(thumb, meta);
      card.addEventListener('mouseenter', () => { $$('.hero-project-card', list).forEach(x => x.classList.toggle('active', x === card)); });
      card.addEventListener('focus', () => { $$('.hero-project-card', list).forEach(x => x.classList.toggle('active', x === card)); });
      card.addEventListener('click', () => {
        selectedCategory = 'All';
        $$('.filter').forEach(x => x.classList.toggle('active', x.dataset.filter === 'All'));
        renderEvents(siteData?.events || []);
        const eventSection = $('#events'); eventSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => {
          const rows = $$('.event-row');
          const match = rows.find(row => row.dataset.eventId === event.id);
          if (match) { match.classList.add('event-row-highlight'); match.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }, 450);
      });
      list.append(card);
    });
  }

  function renderGallery(items) {
    const grid = $('#galleryGrid'); if (!grid) return;
    grid.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div'); empty.className = 'gallery-empty';
      const cross = document.createElement('span'); cross.className = 'empty-cross'; cross.textContent = '+';
      const p = document.createElement('p'); p.textContent = 'THE NEXT MEMORY STARTS HERE.';
      const small = document.createElement('small'); small.textContent = 'Photos from ITSA events will appear here.';
      empty.append(cross, p, small); grid.append(empty); return;
    }
    items.forEach(item => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'gallery-item'; card.setAttribute('aria-label', `Open ${item.title || 'gallery image'}`);
      const img = document.createElement('img'); img.src = item.image; img.alt = item.title || 'ITSA event'; img.loading = 'lazy';
      const overlay = document.createElement('span'); overlay.className = 'gallery-overlay';
      const strong = document.createElement('strong'); strong.textContent = item.title || 'ITSA moment';
      const small = document.createElement('small'); small.textContent = item.category || 'EVENT';
      overlay.append(strong, small); card.append(img, overlay);
      card.addEventListener('click', () => openLightbox(item.image, item.caption || item.title || 'ITSA event'));
      grid.append(card);
    });
  }

  function renderTeam(items) {
    const grid = $('#teamGrid'); if (!grid) return;
    const visible = items.filter(person => selectedTeam === 'All' || person.department === selectedTeam);
    setText('#teamCount', `TEAM / ${visible.length.toString().padStart(2, '0')}`);
    grid.replaceChildren();
    if (!visible.length) { const empty = document.createElement('div'); empty.className = 'team-empty'; empty.style.gridColumn = '1/-1'; empty.textContent = items.length ? 'No members in this team yet.' : 'The team directory is being updated.'; grid.append(empty); return; }
    visible.forEach(person => {
      const card = document.createElement('article'); card.className = 'team-card';
      const photo = document.createElement('div'); photo.className = 'team-photo';
      if (person.photo) { const img = document.createElement('img'); img.src = person.photo; img.alt = person.name; img.loading = 'lazy'; photo.append(img); }
      else { const initials = document.createElement('span'); initials.className = 'team-initial'; initials.textContent = String(person.name || 'IT').split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase(); photo.append(initials); }
      const info = document.createElement('div'); info.className = 'team-info';
      const name = document.createElement('h3'); name.textContent = person.name;
      const role = document.createElement('p'); role.textContent = person.role;
      info.append(name, role);
      if (person.bio) { const bio = document.createElement('small'); bio.textContent = person.bio; info.append(bio); }
      const links = document.createElement('div'); links.className = 'team-card-links';
      for (const [label, href] of [['LINKEDIN', person.linkedin], ['INSTAGRAM', person.instagram]]) {
        const safe = safeLink(href, ''); if (safe) { const a = document.createElement('a'); a.href = safe; a.target = '_blank'; a.rel = 'noopener'; a.textContent = `${label} ↗`; links.append(a); }
      }
      if (links.childNodes.length) info.append(links);
      card.append(photo, info); grid.append(card);
    });
  }

  function renderSponsors(items) {
    const wrap = $('#sponsorGroups'); if (!wrap) return;
    wrap.replaceChildren();
    const tiers = ['Title', 'Gold', 'Silver'];
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'sponsor-empty'; empty.textContent = 'Partner logos and details will appear here.'; wrap.append(empty); return; }
    tiers.forEach(tier => {
      const groupItems = items.filter(x => x.tier === tier); if (!groupItems.length) return;
      const group = document.createElement('div'); group.className = 'sponsor-group';
      const label = document.createElement('div'); label.className = 'sponsor-tier-label'; label.textContent = `${tier.toUpperCase()} PARTNERS`;
      const logos = document.createElement('div'); logos.className = 'sponsor-logos';
      groupItems.forEach(item => {
        const card = document.createElement(item.website ? 'a' : 'div'); card.className = 'sponsor-card';
        if (item.website) { card.href = safeLink(item.website, '#'); card.target = '_blank'; card.rel = 'noopener'; }
        if (item.logo) { const img = document.createElement('img'); img.src = item.logo; img.alt = `${item.name} logo`; card.append(img); }
        const text = document.createElement('div'); const name = document.createElement('strong'); name.textContent = item.name; text.append(name);
        if (item.description) { const desc = document.createElement('small'); desc.textContent = item.description; text.append(desc); }
        card.append(text); logos.append(card);
      });
      group.append(label, logos); wrap.append(group);
    });
  }

  function openLightbox(src, caption) {
    const box = $('#lightbox'); if (!box) return;
    $('#lightboxImage').src = src; $('#lightboxCaption').textContent = caption;
    box.classList.add('open'); box.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  }
  function closeLightbox() { const box = $('#lightbox'); if (!box) return; box.classList.remove('open'); box.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  $('#lightboxClose')?.addEventListener('click', closeLightbox);
  $('#lightbox')?.addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  $('#heroFilters')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-hero-filter]'); if (!btn) return;
    selectedHeroCategory = btn.dataset.heroFilter;
    $$('.hero-chip').forEach(x => x.classList.toggle('active', x === btn));
    renderHeroEvents(siteData?.events || []);
  });

  $('#eventFilters')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]'); if (!btn) return;
    selectedCategory = btn.dataset.filter;
    $$('.filter').forEach(x => x.classList.toggle('active', x === btn));
    renderEvents(siteData?.events || []);
  });
  $('#teamTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-team]'); if (!btn) return;
    selectedTeam = btn.dataset.team;
    $$('.team-tab').forEach(x => x.classList.toggle('active', x === btn));
    renderTeam(siteData?.team || []);
  });
  const toggle = $('#menuToggle'); const mobile = $('#mobileNav');
  toggle?.addEventListener('click', () => { const open = mobile.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); mobile.setAttribute('aria-hidden', String(!open)); });
  mobile?.addEventListener('click', e => { if (e.target.closest('a')) { mobile.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); mobile.setAttribute('aria-hidden', 'true'); } });

  function initReveal() {
    const elements = $$('.reveal');
    if (!('IntersectionObserver' in window)) { elements.forEach(el => el.classList.add('visible')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold: .12 });
    elements.forEach(el => observer.observe(el));
  }
  function initParticles() {
    if (typeof window.initITSAHead === 'function' && window.initITSAHead()) return;
    // 2D fallback: the same cursor-repulsion and spring-return feel when WebGL is unavailable.
    let canvas = $('#bg'); const hero = $('#home');
    if (!canvas || !hero) return;
    let ctx = canvas.getContext('2d');
    if (!ctx) {
      const replacement = document.createElement('canvas');
      replacement.id = 'bg'; replacement.setAttribute('aria-hidden', 'true');
      canvas.replaceWith(replacement); canvas = replacement; ctx = canvas.getContext('2d');
    }
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false, speed: 0, lastX: 0, lastY: 0 };
    let w = 0, h = 0, dpr = 1, dots = [], raf = 0, tick = 0;

    function resize() {
      w = window.innerWidth;
      h = Math.max(window.innerHeight, hero.scrollHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 1.3);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 700 ? 5200 : 13000;
      dots = Array.from({ length: count }, () => {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
        const y = Math.cos(a) * r, side = Math.sin(a) * r;
        const face = Math.max(0, side);
        const nose = Math.exp(-Math.pow((y + .12) / .14, 2)) * .16;
        const lips = Math.exp(-Math.pow((y + .38) / .11, 2)) * .055;
        const x = side * .78 + (Math.pow(face, 7) * (nose + lips));
        return {
          x, y, z: Math.random(), p: Math.random() * 6.28,
          r: .35 + Math.random() * 1.05, c: Math.random(),
          ox: 0, oy: 0, vx: 0, vy: 0
        };
      });
    }

    function readPointer(event) {
      const rect = hero.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) { pointer.active = false; return; }
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.speed = Math.min(1, Math.hypot(x - pointer.lastX, y - pointer.lastY) / 90);
      pointer.lastX = x; pointer.lastY = y;
      pointer.tx = x; pointer.ty = y; pointer.active = true;
    }
    window.addEventListener('pointermove', readPointer, { passive: true });
    window.addEventListener('pointerdown', readPointer, { passive: true });
    window.addEventListener('blur', () => { pointer.active = false; }, { passive: true });

    function draw() {
      if (!reduced) tick += .008;
      pointer.x += (pointer.tx - pointer.x) * .22;
      pointer.y += (pointer.ty - pointer.y) * .22;
      pointer.speed *= .88;
      ctx.clearRect(0, 0, w, h);
      const mobile = w < 700;
      const scale = Math.min(h * (mobile ? .36 : .43), 390);
      const cx = w * .52;
      const cy = h * .49 + (reduced ? 0 : Math.sin(tick * .4) * 5);
      const influenceRadius = mobile ? 145 : 180;

      for (const d of dots) {
        const breathing = reduced ? 0 : Math.sin(tick + d.p) * .004;
        const baseX = cx + (d.x + breathing) * scale;
        const baseY = cy + d.y * scale * 1.12;
        let targetX = 0, targetY = 0;
        if (pointer.active) {
          const dx = baseX - pointer.x;
          const dy = baseY - pointer.y;
          const distance = Math.hypot(dx, dy) + .001;
          if (distance < influenceRadius) {
            const falloff = 1 - distance / influenceRadius;
            const influence = falloff * falloff * (3 - 2 * falloff);
            const nx = dx / distance, ny = dy / distance;
            const push = influence * (19 + pointer.speed * 12);
            const swirl = influence * (6 + pointer.speed * 13);
            targetX = nx * push - ny * swirl;
            targetY = ny * push + nx * swirl;
          }
        }
        d.vx = (d.vx + (targetX - d.ox) * .24) * .72;
        d.vy = (d.vy + (targetY - d.oy) * .24) * .72;
        d.ox += d.vx; d.oy += d.vy;
        const x = baseX + d.ox, y = baseY + d.oy;
        const twinkle = .55 + Math.sin(d.p + tick * (1 + d.z)) * .45;
        ctx.globalAlpha = (.24 + d.z * .64) * twinkle;
        ctx.fillStyle = d.c > .78 ? '#ffffff' : d.c > .4 ? '#cce9ed' : '#72c9d0';
        ctx.beginPath(); ctx.arc(x, y, d.r * (.7 + d.z * .55), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Keep rendering while the cursor can interact, even with Reduce Motion on.
      raf = requestAnimationFrame(draw);
    }

    resize(); draw();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); draw(); }, { passive: true });
  }

  async function load() {
    try {
      const response = await fetch('/api/public', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Could not load site data.');
      siteData = await response.json();
      renderSettings(siteData.settings || {});
      renderFeatured(siteData.events || []);
      renderHeroEvents(siteData.events || []);
      renderEvents(siteData.events || []);
      renderGallery(siteData.gallery || []);
      renderTeam(siteData.team || []);
      renderSponsors(siteData.sponsors || []);
    } catch (error) {
      console.error(error);
      const list = $('#eventList'); if (list) list.innerHTML = '<div class="empty-state">Could not connect to the ITSA server. Please refresh in a moment.</div>';
    }
    initReveal(); initParticles();
  }
  load();
})();
