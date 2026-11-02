(() => {
  'use strict';

  // Fixed full-viewport monochrome starfield. Because the canvas is position:fixed,
  // it remains behind every page section while the user scrolls.
  const canvas = document.getElementById('starfield');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let raf = 0;
  let previousTime = 0;
  let elapsed = 0;
  let meteor = null;
  let nextMeteorAt = 6;

  const random = (min, max) => min + Math.random() * (max - min);

  function createStar(layer) {
    // layer 0 = distant dust, 1 = mid-field stars, 2 = occasional near stars
    const settings = [
      { radius: [0.20, 0.48], alpha: [0.10, 0.26], speed: [0.025, 0.10], twinkle: [0.12, 0.38], parallax: 0.25 },
      { radius: [0.36, 0.78], alpha: [0.18, 0.42], speed: [0.07, 0.19], twinkle: [0.22, 0.62], parallax: 0.62 },
      { radius: [0.65, 1.35], alpha: [0.28, 0.68], speed: [0.13, 0.32], twinkle: [0.35, 0.95], parallax: 1.0 }
    ][layer];

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: random(...settings.radius),
      alpha: random(...settings.alpha),
      speed: random(...settings.speed),
      phase: random(0, Math.PI * 2),
      twinkle: random(...settings.twinkle),
      parallax: settings.parallax,
      layer,
      glow: layer === 2 && Math.random() > 0.72
    };
  }

  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mobile = width < 720;
    // Approximately 2.5–4x the earlier density, capped for performance.
    const total = mobile
      ? Math.max(850, Math.min(1600, Math.round((width * height) / 390)))
      : Math.max(2200, Math.min(4600, Math.round((width * height) / 540)));

    const distant = Math.round(total * 0.66);
    const mid = Math.round(total * 0.28);
    const near = total - distant - mid;

    stars = [
      ...Array.from({ length: distant }, () => createStar(0)),
      ...Array.from({ length: mid }, () => createStar(1)),
      ...Array.from({ length: near }, () => createStar(2))
    ];

    draw(0, true);
  }

  function drawStar(star, t, staticFrame = false) {
    const shimmer = staticFrame || reducedMotion
      ? 1
      : 0.68 + (0.32 * (0.5 + 0.5 * Math.sin(t * star.twinkle + star.phase)));

    const alpha = star.alpha * shimmer;
    const px = star.x + pointer.x * star.parallax * 5.5;
    const py = star.y + pointer.y * star.parallax * 3.5;

    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.arc(px, py, star.radius, 0, Math.PI * 2);
    ctx.fill();

    if (star.glow && alpha > 0.34) {
      const glowRadius = star.radius * 5.5;
      const glow = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
      glow.addColorStop(0, `rgba(255,255,255,${alpha * 0.17})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMeteor() {
    if (!meteor) return;
    const progress = meteor.life / meteor.duration;
    const alpha = Math.sin(Math.PI * progress) * 0.72;
    const tail = 105 * meteor.depth;

    const gradient = ctx.createLinearGradient(
      meteor.x - tail, meteor.y - tail * 0.34, meteor.x, meteor.y
    );
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.72, `rgba(255,255,255,${alpha * 0.24})`);
    gradient.addColorStop(1, `rgba(255,255,255,${alpha})`);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.7 + meteor.depth * 0.7;
    ctx.beginPath();
    ctx.moveTo(meteor.x - tail, meteor.y - tail * 0.34);
    ctx.lineTo(meteor.x, meteor.y);
    ctx.stroke();

    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.75})`;
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, 0.8 + meteor.depth * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(deltaMs, staticFrame = false) {
    ctx.clearRect(0, 0, width, height);

    const t = elapsed * 0.001;
    for (const star of stars) {
      drawStar(star, t, staticFrame);

      if (!staticFrame && !reducedMotion) {
        const seconds = deltaMs * 0.001;
        // A soft diagonal drift at three apparent depths.
        star.y += star.speed * (0.45 + star.layer * 0.46) * deltaMs * 0.055;
        star.x += Math.sin(t * 0.14 + star.phase) * star.speed * deltaMs * 0.008;

        if (star.y > height + 3) {
          star.y = -3;
          star.x = Math.random() * width;
        }
        if (star.x < -3) star.x = width + 3;
        if (star.x > width + 3) star.x = -3;
      }
    }

    if (!staticFrame && !reducedMotion) {
      if (!meteor && t >= nextMeteorAt) {
        meteor = {
          x: random(width * 0.15, width * 0.92),
          y: random(height * 0.04, height * 0.52),
          vx: random(420, 620),
          vy: random(140, 230),
          life: 0,
          duration: random(620, 980),
          depth: random(0.65, 1.0)
        };
        nextMeteorAt = t + random(8, 15);
      }

      if (meteor) {
        const seconds = deltaMs * 0.001;
        meteor.x -= meteor.vx * seconds;
        meteor.y -= meteor.vy * seconds;
        meteor.life += deltaMs;
        drawMeteor();
        if (meteor.life >= meteor.duration) meteor = null;
      }
    }
  }

  function animate(time) {
    if (document.hidden) {
      raf = 0;
      previousTime = 0;
      return;
    }

    if (!previousTime) previousTime = time;
    const delta = Math.min(34, time - previousTime);
    previousTime = time;
    elapsed += delta;

    pointer.x += (pointer.targetX - pointer.x) * 0.035;
    pointer.y += (pointer.targetY - pointer.y) * 0.035;

    draw(delta);
    raf = requestAnimationFrame(animate);
  }

  function onPointerMove(event) {
    pointer.targetX = (event.clientX / width - 0.5) * 2;
    pointer.targetY = (event.clientY / height - 0.5) * 2;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      previousTime = 0;
    } else if (!reducedMotion && !raf) {
      raf = requestAnimationFrame(animate);
    }
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  resize();
  if (!reducedMotion) raf = requestAnimationFrame(animate);
})();
