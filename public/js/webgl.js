/* ITSA V3 — interactive deforming particle sphere.
   Keeps the existing initITSAHead() integration and transparent canvas layer. */
(() => {
  'use strict';

  function makeSphereGeometry(THREE, mobile = false) {
    const count = mobile ? 7600 : 12400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    // Fibonacci sampling gives an even, lightweight particle shell with a clear interior.
    for (let i = 0; i < count; i++) {
      const y = 1 - 2 * ((i + 0.5) / count);
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * goldenAngle;
      const nx = Math.cos(phi) * ring;
      const ny = y;
      const nz = Math.sin(phi) * ring;
      const radius = 0.98 + (Math.random() - 0.5) * 0.018;
      const j = i * 3;

      normals[j] = nx;
      normals[j + 1] = ny;
      normals[j + 2] = nz;
      positions[j] = nx * radius;
      positions[j + 1] = ny * radius;
      positions[j + 2] = nz * radius;

      // Neutral white / light-grey variation only. No blue colour cast.
      const light = 0.70 + Math.random() * 0.30;
      colors[j] = light;
      colors[j + 1] = light;
      colors[j + 2] = light;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return { geometry, normals, count };
  }

  // A smooth, deterministic multi-frequency field. It is intentionally low-amplitude
  // so the sphere breathes organically instead of turning into a noisy blob.
  function organicNoise(x, y, z, time) {
    const a = Math.sin(x * 2.7 + time * 0.34) * Math.cos(y * 2.35 - time * 0.27);
    const b = Math.sin(z * 2.55 + time * 0.24 + x * 0.7) * Math.cos(y * 1.8 + z * 0.55);
    const c = Math.sin((x + z) * 4.15 - time * 0.19) * Math.cos((y - z) * 3.7 + time * 0.16);
    return a * 0.48 + b * 0.36 + c * 0.16;
  }

  function makeAmbientGeometry(THREE, mobile = false) {
    const count = mobile ? 70 : 130;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.25 + Math.random() * 0.78;
      const j = i * 3;
      positions[j] = Math.cos(angle) * radius;
      positions[j + 1] = (Math.random() - 0.5) * 2.4;
      positions[j + 2] = Math.sin(angle) * radius;
      const grey = 0.18 + Math.random() * 0.20;
      colors[j] = grey;
      colors[j + 1] = grey;
      colors[j + 2] = grey;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }

  window.initITSAHead = function initITSAHead() {
    const canvas = document.getElementById('bg');
    if (!canvas || !window.THREE) return false;
    const THREE = window.THREE;
    let renderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (error) {
      console.warn('ITSA WebGL unavailable; using the canvas fallback.', error);
      return false;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(
      window.devicePixelRatio || 1,
      window.matchMedia('(max-width: 700px)').matches ? 1.1 : 1.35
    ));
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60);
    camera.position.set(0, 0, 4.25);
    camera.lookAt(0, 0, 0);

    const mobile = window.matchMedia('(max-width: 700px)').matches;
    const sphere = new THREE.Group();
    scene.add(sphere);

    const { geometry, normals, count } = makeSphereGeometry(THREE, mobile);
    const basePositions = geometry.getAttribute('position').array.slice();
    const offsets = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) phases[i] = Math.random() * Math.PI * 2;

    const glowMaterial = new THREE.PointsMaterial({
      size: mobile ? 0.014 : 0.016,
      color: 0xffffff,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });
    const particleMaterial = new THREE.PointsMaterial({
      size: mobile ? 0.006 : 0.007,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });
    sphere.add(new THREE.Points(geometry, glowMaterial));
    sphere.add(new THREE.Points(geometry, particleMaterial));

    const ambientGeometry = makeAmbientGeometry(THREE, mobile);
    const ambient = new THREE.Points(ambientGeometry, new THREE.PointsMaterial({
      size: 0.0045,
      vertexColors: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    }));
    scene.add(ambient);

    const pointer = {
      x: 0, y: 0, tx: 0, ty: 0,
      active: false, vx: 0, vy: 0,
      lastX: 0, lastY: 0, speed: 0
    };
    const pointerNdc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const pointerPlane = new THREE.Plane();
    const planeNormal = new THREE.Vector3();
    const sphereWorldPosition = new THREE.Vector3();
    const pointerWorldPosition = new THREE.Vector3();
    const pointerLocalPosition = new THREE.Vector3();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    // Cursor influence is intentionally broad enough to visibly break the shell.
    // A tighter local influence so the cursor opens a focused patch of the sphere.
    const INTERACTION_RADIUS = mobile ? 0.62 : 0.72;
    let raf = 0;
    let disposed = false;

    function resize() {
      const parent = canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : { height: window.innerHeight };
      const width = Math.max(320, window.innerWidth);
      const height = Math.max(window.innerHeight, rect.height || 0);
      renderer.setSize(width, height, false);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.position.z = width < 700 ? 5.15 : 4.25;
      sphere.scale.setScalar(width < 700 ? 0.88 : 1.08);
      camera.updateProjectionMatrix();
    }

    function readPointer(event) {
      const rect = canvas.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) {
        pointer.active = false;
        pointer.speed *= 0.65;
        return;
      }
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = 1 - ((event.clientY - rect.top) / rect.height) * 2;
      pointer.vx = nx - pointer.lastX;
      pointer.vy = ny - pointer.lastY;
      pointer.speed = Math.min(1, Math.hypot(pointer.vx, pointer.vy) * 7);
      pointer.lastX = nx;
      pointer.lastY = ny;
      pointer.tx = nx;
      pointer.ty = ny;
      pointer.active = true;
    }

    function onBlur() {
      pointer.active = false;
      pointer.speed = 0;
    }

    window.addEventListener('pointermove', readPointer, { passive: true });
    window.addEventListener('pointerdown', readPointer, { passive: true });
    window.addEventListener('blur', onBlur, { passive: true });

    function getLocalPointer() {
      if (!pointer.active) return false;
      pointerNdc.set(pointer.x, pointer.y);
      raycaster.setFromCamera(pointerNdc, camera);
      camera.getWorldDirection(planeNormal);
      sphere.getWorldPosition(sphereWorldPosition);
      pointerPlane.setFromNormalAndCoplanarPoint(planeNormal, sphereWorldPosition);
      if (!raycaster.ray.intersectPlane(pointerPlane, pointerWorldPosition)) return false;
      pointerLocalPosition.copy(pointerWorldPosition);
      sphere.worldToLocal(pointerLocalPosition);
      return true;
    }

    function render() {
      if (disposed) return;
      const time = clock.getElapsedTime();
      const idle = reduceMotion ? 0 : 1;
      pointer.x += (pointer.tx - pointer.x) * 0.22;
      pointer.y += (pointer.ty - pointer.y) * 0.22;
      pointer.vx *= 0.82;
      pointer.vy *= 0.82;
      pointer.speed *= 0.88;

      sphere.rotation.y = time * 0.075 * idle + pointer.x * 0.035;
      sphere.rotation.x = Math.sin(time * 0.19) * 0.045 * idle - pointer.y * 0.025;
      sphere.rotation.z = Math.sin(time * 0.13) * 0.018 * idle;
      sphere.position.y = Math.sin(time * 0.28) * 0.012 * idle;
      sphere.updateMatrixWorld(true);

      const hasPointer = getLocalPointer();
      const positions = geometry.getAttribute('position').array;
      const radiusSq = INTERACTION_RADIUS * INTERACTION_RADIUS;
      const cursorX = pointerLocalPosition.x;
      const cursorY = pointerLocalPosition.y;

      for (let i = 0; i < count; i++) {
        const j = i * 3;
        const nx = normals[j];
        const ny = normals[j + 1];
        const nz = normals[j + 2];
        const bx = basePositions[j];
        const by = basePositions[j + 1];
        const bz = basePositions[j + 2];
        const phase = phases[i];

        // Noise changes the baseline itself, so particles always return to a
        // living surface instead of snapping back to a perfectly static sphere.
        const n = organicNoise(bx, by, bz, time);
        const radialWave = 0.052 * n + 0.009 * Math.sin(time * 0.46 + phase);
        const baselineX = bx + nx * radialWave;
        const baselineY = by + ny * radialWave;
        const baselineZ = bz + nz * radialWave;

        let targetX = 0;
        let targetY = 0;
        let targetZ = 0;

        if (hasPointer) {
          // Screen-space proximity keeps the visible front surface responsive;
          // only the small region around the cursor receives a force.
          const dx = baselineX - cursorX;
          const dy = baselineY - cursorY;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq < radiusSq) {
            const distance = Math.sqrt(distanceSq) + 0.0001;
            const falloff = 1 - distance / INTERACTION_RADIUS;
            const influence = falloff * falloff * (3 - 2 * falloff);
            const awayX = dx / distance;
            const awayY = dy / distance;

            // Strong screen-space repulsion creates a visible opening in the
            // particle shell instead of merely inflating the sphere slightly.
            // Movement adds a short directional wake so particles scatter
            // along the cursor's travel rather than staying locked to a shape.
            const motionLength = Math.hypot(pointer.vx, pointer.vy);
            const travelX = motionLength > 0.0001 ? pointer.vx / motionLength : 0;
            const travelY = motionLength > 0.0001 ? pointer.vy / motionLength : 0;

            const push = influence * (0.88 + pointer.speed * 1.05);
            const normalPush = influence * (0.34 + pointer.speed * 0.42);
            const wake = influence * pointer.speed * 0.58;

            targetX = awayX * push + nx * normalPush + travelX * wake;
            targetY = awayY * push + ny * normalPush + travelY * wake;

            // Separate the front and back of the shell in depth as well, so
            // the cursor leaves a genuine 3D cavity rather than a flat dent.
            const depthSide = bz >= 0 ? 1 : -1;
            targetZ = nz * normalPush + depthSide * influence * (0.22 + pointer.speed * 0.38);
          }
        }

        // Soft spring and 0.91 damping: local disturbances settle smoothly.
        for (let axis = 0; axis < 3; axis++) {
          const k = j + axis;
          const target = axis === 0 ? targetX : axis === 1 ? targetY : targetZ;
          let velocity = velocities[k] + (target - offsets[k]) * 0.22;
          velocity *= 0.91;
          velocities[k] = velocity;
          offsets[k] += velocity;
        }

        positions[j] = baselineX + offsets[j];
        positions[j + 1] = baselineY + offsets[j + 1];
        positions[j + 2] = baselineZ + offsets[j + 2];
      }

      geometry.getAttribute('position').needsUpdate = true;
      glowMaterial.opacity = hasPointer ? 0.075 : 0.055;
      ambient.rotation.y = -time * 0.012 * idle;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    render();

    // Provide a small teardown hook for page transitions / hot reloads.
    window.destroyITSAHead = function destroyITSAHead() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', readPointer);
      window.removeEventListener('pointerdown', readPointer);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
      geometry.dispose();
      ambientGeometry.dispose();
      glowMaterial.dispose();
      particleMaterial.dispose();
      ambient.material.dispose();
      renderer.dispose();
    };

    return true;
  };
})();
