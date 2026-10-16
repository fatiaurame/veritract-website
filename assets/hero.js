/* =====================================================================
   HERO — glassmorphism liquid reveal (Three.js)
===================================================================== */
(function(){
  const canvasWrap = document.querySelector('.hero-canvas-wrap');
  const canvasEl = document.getElementById('hero-canvas');
  const hint = document.getElementById('heroHint');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(!window.THREE || !canvasEl || reduceMotion){
    return; // graceful fallback: CSS gradient background stays visible
  }

  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias:true, alpha:true });
  }catch(e){ return; }

  canvasEl.style.display = 'block';
  document.querySelector('.hero-fallback-bg').style.opacity = '0';

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  // ---- Image loading ----
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  let imgBackDesktop, imgFrontDesktop, imgBackMobile, imgFrontMobile;
  let imagesLoaded = false;

  Promise.all([
    loadImage('assets/images/new-back-desktop.webp'),
    loadImage('assets/images/new-front-desktop.webp'),
    loadImage('assets/images/new-back-mobile.webp'),
    loadImage('assets/images/new-front-mobile.webp')
  ]).then(results => {
    imgBackDesktop = results[0];
    imgFrontDesktop = results[1];
    imgBackMobile = results[2];
    imgFrontMobile = results[3];
    imagesLoaded = true;
    sizeAndRebuild();
  }).catch(err => {
    console.error("Failed to load hero images", err);
  });

  function createTexture(img, w, h, contain) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    
    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;
    let drawW = w;
    let drawH = h;
    let offsetX = 0;
    let offsetY = 0;
    
    if (contain) {
      if (imgRatio > canvasRatio) {
        drawW = w;
        drawH = w / imgRatio;
        offsetY = (h - drawH) / 2;
      } else {
        drawH = h;
        drawW = h * imgRatio;
        offsetX = (w - drawW) / 2;
      }
    } else {
      if (imgRatio > canvasRatio) {
        drawW = h * imgRatio;
        offsetX = (w - drawW) / 2;
      } else {
        drawH = w / imgRatio;
        offsetY = (h - drawH) / 2;
      }
    }
    
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  // ---- trail canvas (cursor liquid pool — slower fade than a mouse trail so it reads as viscous, not snappy) ----
  const TRAIL_SIZE = 256;
  const trailCanvas = document.createElement('canvas');
  trailCanvas.width = TRAIL_SIZE; trailCanvas.height = TRAIL_SIZE;
  const trailCtx = trailCanvas.getContext('2d');
  trailCtx.fillStyle = '#000'; trailCtx.fillRect(0,0,TRAIL_SIZE,TRAIL_SIZE);
  const trailTexture = new THREE.CanvasTexture(trailCanvas);

  const pointer = { x:0.5, y:0.5, active:false };
  const spring = { x:0.5, y:0.5 };
  let lastFrameX = null;
  let lastFrameY = null;
  let hintShown = true;

  function setPointerFromEvent(e){
    const rect = canvasEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    pointer.x = (clientX - rect.left) / rect.width;
    pointer.y = (clientY - rect.top) / rect.height;
    
    if (!pointer.active) {
      spring.x = pointer.x;
      spring.y = pointer.y;
      pointer.active = true;
    }
    
    if(hintShown){ hintShown = false; hint.classList.add('hidden'); }
  }

  function isInside(e) {
    const rect = canvasEl.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom);
  }

  window.addEventListener('pointermove', (e) => {
    if (isInside(e)) {
      setPointerFromEvent(e);
    } else {
      pointer.active = false;
    }
  });
  window.addEventListener('pointerdown', (e) => {
    if (isInside(e)) {
      setPointerFromEvent(e);
    }
  });
  window.addEventListener('touchmove', (e) => {
    if (isInside(e)) {
      setPointerFromEvent(e);
    }
  }, { passive:true });

  function updateTrail(){
    // lower alpha = slower fade = the clearing lingers like a liquid pool re-fogging, not a wiped mask
    trailCtx.fillStyle = 'rgba(0,0,0,0.035)';
    trailCtx.fillRect(0,0,TRAIL_SIZE,TRAIL_SIZE);
    
    if(pointer.active){
      // Smoothly interpolate the spring towards the actual pointer
      spring.x += (pointer.x - spring.x) * 0.12;
      spring.y += (pointer.y - spring.y) * 0.12;
      
      if (lastFrameX === null) {
        lastFrameX = spring.x;
        lastFrameY = spring.y;
      }
      
      const x1 = lastFrameX * TRAIL_SIZE;
      const y1 = lastFrameY * TRAIL_SIZE;
      const x2 = spring.x * TRAIL_SIZE;
      const y2 = spring.y * TRAIL_SIZE;
      
      const dist = Math.hypot(x2 - x1, y2 - y1);
      // Interpolate a circle every 4 pixels to form a smooth continuous brush stroke
      const steps = Math.max(1, Math.ceil(dist / 4));
      
      for(let i = 0; i <= steps; i++){
        const t = steps === 0 ? 1 : i/steps;
        const gx = x1 + (x2 - x1)*t;
        const gy = y1 + (y2 - y1)*t;
        
        const grad = trailCtx.createRadialGradient(gx,gy,0,gx,gy,46);
        grad.addColorStop(0,'rgba(255,255,255,0.95)');
        grad.addColorStop(1,'rgba(255,255,255,0)');
        trailCtx.fillStyle = grad;
        trailCtx.beginPath(); 
        trailCtx.arc(gx,gy,46,0,Math.PI*2); 
        trailCtx.fill();
      }
      
      lastFrameX = spring.x;
      lastFrameY = spring.y;
    } else {
      lastFrameX = null;
      lastFrameY = null;
    }
    
    trailTexture.needsUpdate = true;
  }

  const vertexShader = `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
    precision highp float;
    uniform sampler2D uGlass;
    uniform sampler2D uClear;
    uniform sampler2D uTrail;
    uniform float uTime;
    varying vec2 vUv;

    void main(){
      vec2 uv = vUv;
      float strength = texture2D(uTrail, uv).r;

      // very subtle idle ripple across the glass even at rest — sells "surface", not a static image
      float ambient = sin(uv.y*10.0 + uTime*0.5)*0.0015 + cos(uv.x*8.0 - uTime*0.35)*0.0015;

      // liquid melt distortion — concentrated right at the boundary of the reveal, not the core or the untouched glass
      float edgeBand = smoothstep(0.0,0.25,strength) - smoothstep(0.25,0.75,strength);
      float melt = sin(uv.y*26.0 + uTime*3.2)*0.03*edgeBand + cos(uv.x*22.0 - uTime*2.6)*0.03*edgeBand;
      float coreWave = sin(uv.y*14.0 + uTime*1.6)*0.012*strength;

      vec2 glassUv = uv + vec2(ambient);
      vec2 clearUv = uv + vec2(melt + coreWave, melt - coreWave);

      // thin chromatic/refraction fringe right at the melting edge — the detail that reads as "glass", not "mask"
      float ca = edgeBand*0.006;
      vec4 clearColor;
      clearColor.r = texture2D(uClear, clearUv + vec2(ca,0.0)).r;
      clearColor.g = texture2D(uClear, clearUv).g;
      clearColor.b = texture2D(uClear, clearUv - vec2(ca,0.0)).b;
      clearColor.a = 1.0;

      vec4 glassColor = texture2D(uGlass, glassUv);

      float mixAmount = smoothstep(0.05, 0.8, strength);
      vec4 finalColor = mix(glassColor, clearColor, mixAmount);

      // soft orange glow riding the melt boundary — brand accent, ties back to the rest of the site
      finalColor.rgb += vec3(1.0, 0.4, 0.0) * edgeBand * 0.5;

      gl_FragColor = finalColor;
    }
  `;

  let clearTexture, glassTexture;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uGlass: { value: null },
      uClear: { value: null },
      uTrail: { value: trailTexture },
      uTime: { value: 0 }
    },
    vertexShader, fragmentShader
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
  scene.add(quad);

  function sizeAndRebuild(){
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    
    if (!imagesLoaded) return;
    
    const rw = Math.max(2, Math.round(w * renderer.getPixelRatio()));
    const rh = Math.max(2, Math.round(h * renderer.getPixelRatio()));
    
    const isMobile = window.innerWidth < 768;
    
    // Use the mobile image for both, but zoom (cover) it so it fully fits the hero
    const imgBack = imgBackMobile;
    const imgFront = imgFrontMobile;
    const contain = false;
    
    if (clearTexture) clearTexture.dispose();
    if (glassTexture) glassTexture.dispose();
    
    clearTexture = createTexture(imgBack, rw, rh, contain);
    glassTexture = createTexture(imgFront, rw, rh, contain);
    
    material.uniforms.uClear.value = clearTexture;
    material.uniforms.uGlass.value = glassTexture;
  }

  let resizeTimer;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sizeAndRebuild, 180);
  });

  sizeAndRebuild();

  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    material.uniforms.uTime.value = clock.getElapsedTime();
    updateTrail();
    renderer.render(scene, camera);
  }
  animate();
})();
