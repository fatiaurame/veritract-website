(function(){
  // ---- Preloader Logic ----
  window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
      setTimeout(() => {
        preloader.classList.add('hidden');
        setTimeout(() => {
          preloader.remove();
        }, 1000); // Wait for transition
      }, 1000); // Minimum time on screen
    }
  });

  // ---- Scroll Reveal Animation ----
  const revealElements = document.querySelectorAll('.reveal');
  const revealOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  };
  
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('active');
      observer.unobserve(entry.target);
    });
  }, revealOptions);
  
  revealElements.forEach(el => {
    revealObserver.observe(el);
  });

  // ---- Make Noise Tile Utility (exported for interior pages) ----

  // ---- Make Noise Tile Utility (exported for interior pages) ----
  window.makeNoiseTile = function(size = 128, alpha = 16){
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for(let i = 0; i < img.data.length; i += 4){
      const v = Math.random() * 255;
      img.data[i] = v; img.data[i+1] = v; img.data[i+2] = v; img.data[i+3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  // ---- Navigation Logic ----
  const nav = document.getElementById('siteNav');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  
  if (nav && toggle && links) {
    const isHome = document.body.classList.contains('page-home');
    if(!isHome) nav.classList.add('solid');

    let ticking = false;
    function onScrollNav(){
      if(isHome) nav.classList.toggle('scrolled', window.scrollY > window.innerHeight * 0.8);
      ticking = false;
    }
    window.addEventListener('scroll', ()=>{
      if(!ticking){ requestAnimationFrame(onScrollNav); ticking = true; }
    }, { passive:true });
    onScrollNav();

    toggle.addEventListener('click', ()=>{
      const open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if(open){ links.querySelector('a').focus(); }
    });

    // close mobile menu after a link is tapped
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', ()=>{
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }));
  }

  // ---- Scroll Reveal Utility ----
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 0px 0px' });
  els.forEach(el => io.observe(el));

  // ---- FAQ Accordion ----
  document.querySelectorAll('.faq-item').forEach(item=>{
    const btn = item.querySelector('.faq-q');
    const panel = item.querySelector('.faq-a');
    if (!btn || !panel) return;
    btn.addEventListener('click', ()=>{
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(other=>{
        if(other!==item){
          other.classList.remove('open');
          other.querySelector('.faq-a').style.maxHeight = null;
          other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        }
      });
      if(isOpen){
        item.classList.remove('open');
        panel.style.maxHeight = null;
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ---- Scroll Scrub Intro ----
  const introScroll = document.getElementById('introScroll');
  if (introScroll) {
    const lines = introScroll.querySelectorAll('.scrub-line');
    // Set section height to 100vh (sticky) + 80vh per line
    const scrollableHeight = lines.length * 80;
    introScroll.style.height = `calc(100vh + ${scrollableHeight}vh)`;

    let tickingScrub = false;
    function updateScrub() {
      const rect = introScroll.getBoundingClientRect();
      const vh = window.innerHeight;
      
      const maxScroll = (lines.length * vh * 0.8);
      let progress = -rect.top / maxScroll;
      progress = Math.max(0, Math.min(1, progress));

      const activeIndex = Math.min(lines.length - 1, Math.floor(progress * lines.length));
      
      lines.forEach((line, i) => {
        if (i < activeIndex) {
          line.classList.add('done');
          line.classList.remove('active');
        } else if (i === activeIndex) {
          line.classList.add('active');
          line.classList.remove('done');
        } else {
          line.classList.remove('done', 'active');
        }
      });
      tickingScrub = false;
    }

    window.addEventListener('scroll', () => {
      if (!tickingScrub) {
        requestAnimationFrame(updateScrub);
        tickingScrub = true;
      }
    }, { passive: true });
    updateScrub();
  }
  // ---- Vertical Process Section Animations (New) ----
  const stepRows = document.querySelectorAll('.step-row');
  if (stepRows.length > 0) {
    const stepObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-active');
        } else {
          entry.target.classList.remove('is-active');
        }
      });
    }, {
      rootMargin: '0px 0px -20% 0px',
      threshold: 0.2
    });

    stepRows.forEach(row => {
      stepObserver.observe(row);
    });
  }


  // ---- Stats Counter (Homepage & Case Studies) ----
  const counters = document.querySelectorAll('.count');
  if (counters.length > 0) {
    const ioStats = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(!e.isIntersecting) return;
        const el = e.target;
        const target = parseFloat(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        const dur = 3500;
        const start = performance.now();
        function tick(now){
          const p = Math.min(1, (now-start)/dur);
          // Linear tick for a true timer feel
          const eased = p;
          let val = Math.round(eased*target);
          // Pad with zeros if it's the 200 or 100 stat for a digital timer look
          if (target >= 100 && val < 100) val = val.toString().padStart(3, '0');
          el.textContent = val + suffix;
          if(p<1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        ioStats.unobserve(el);
      });
    }, { threshold:0.6 });
    counters.forEach(el=>ioStats.observe(el));
  }

  // ---- Work Page Filters ----
  const pills = document.querySelectorAll('.filter-pill');
  const cards = document.querySelectorAll('.case-card[data-service]');
  if (pills.length > 0 && cards.length > 0) {
    pills.forEach(pill => pill.addEventListener('click', ()=>{
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter;
      cards.forEach(card => {
        card.style.display = (filter === 'all' || card.dataset.service === filter) ? '' : 'none';
      });
    }));
  }

  // ---- Contact Form Validation ----
  const form = document.getElementById('contactForm');
  if(form) {
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      let valid = true;
      form.querySelectorAll('[required]').forEach(field=>{
        const wrapper = field.closest('.field');
        const ok = field.type === 'email'
          ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())
          : field.value.trim().length > 0;
        wrapper.classList.toggle('error', !ok);
        if(!ok) valid = false;
      });
      if(!valid) return;
      
      form.querySelector('.form-status').textContent = "Thanks â€” we'll be in touch within 1 business day.";
      form.reset();
    });
  }


  // ---- Mouse Parallax for Floating Elements ----
  const parallaxScene = document.getElementById('parallax-scene');
  if (parallaxScene) {
    const wrappers = parallaxScene.querySelectorAll('.parallax-wrapper');
    window.addEventListener('mousemove', (e) => {
      // Normalize mouse coordinates from -1 to 1
      const x = (e.clientX * 2) / window.innerWidth - 1;
      const y = (e.clientY * 2) / window.innerHeight - 1;
      
      wrappers.forEach(wrap => {
        const speed = parseFloat(wrap.getAttribute('data-speed')) || 1;
        const xPos = x * speed * 15;
        const yPos = y * speed * 15;
        wrap.style.transform = `translate(${xPos}px, ${yPos}px)`;
      });
    });
  }

  // ---- Horizontal Scroll Reviews ----
  const revSection = document.getElementById('reviews');
  const revGrid = document.getElementById('revGrid');
  if (revSection && revGrid) {
    let tickingRev = false;
    function updateRevScroll() {
      if (window.innerWidth >= 1024) {
        revGrid.style.transform = '';
        tickingRev = false;
        return;
      }
      
      const rect = revSection.getBoundingClientRect();
      const vh = window.innerHeight;
      
      const maxScroll = rect.height - vh; 
      let progress = -rect.top / maxScroll;
      progress = Math.max(0, Math.min(1, progress));
      
      const gridWidth = revGrid.scrollWidth;
      const windowWidth = window.innerWidth;
      
      // Ensure we can scroll exactly to the end of the cards with a little padding
      const maxTranslate = gridWidth - windowWidth + (windowWidth * 0.1); 
      
      if (maxTranslate > 0) {
        revGrid.style.transform = `translateX(${-progress * maxTranslate}px)`;
      } else {
        revGrid.style.transform = `translateX(0px)`;
      }
      tickingRev = false;
    }
    window.addEventListener('scroll', () => {
      if (!tickingRev) {
        requestAnimationFrame(updateRevScroll);
        tickingRev = true;
      }
    }, { passive: true });
    // Initialize position
    updateRevScroll();
  }

  // ---- Case Study Modal ----
  const caseCards = document.querySelectorAll('.case-card[data-case]');
  const modal = document.getElementById('caseModal');
  if (caseCards.length > 0 && modal) {
    const modalClose = document.getElementById('caseModalClose');
    const modalBackdrop = document.getElementById('caseModalBackdrop');
    
    // UI Elements inside modal
    const cmImage = document.getElementById('cm-image');
    const cmIndustry = document.getElementById('cm-industry');
    const cmTitle = document.getElementById('cm-title');
    const cmSubtitle = document.getElementById('cm-subtitle');
    const cmSolutions = document.getElementById('cm-solutions');
    const cmContent = document.getElementById('cm-content');
    
    function openModal(caseId) {
      if (!window.caseStudiesData || !window.caseStudiesData[caseId]) return;
      
      const data = window.caseStudiesData[caseId];
      
      // Populate data
      cmImage.src = data.image;
      cmImage.alt = data.title;
      cmIndustry.textContent = data.industry;
      cmTitle.textContent = data.title;
      cmSubtitle.textContent = data.subtitle;
      cmSolutions.textContent = data.solutions;
      cmContent.innerHTML = data.content;
      
      // Open modal
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    
    function closeModal() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      // Optional: clear content after animation
      setTimeout(() => {
        if(!modal.classList.contains('open')){
          cmContent.innerHTML = '';
        }
      }, 500);
    }
    
    caseCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(card.dataset.case);
      });
    });
    
    modalClose.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
    });
  }

  // ---- About Story Collapse/Expand ----
  const readAllBtn = document.getElementById('readAllBtn');
  const aboutStoryContainer = document.getElementById('aboutStoryContainer');
  if (readAllBtn && aboutStoryContainer) {
    readAllBtn.addEventListener('click', () => {
      aboutStoryContainer.classList.add('story-expanded');
      aboutStoryContainer.classList.remove('story-collapsed');
    });
  }

})();
