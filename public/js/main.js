(function () {
  'use strict';

  // Mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  function setNavOpen(open) {
    if (!mainNav) return;
    mainNav.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    if (navToggle) navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      setNavOpen(!mainNav.classList.contains('open'));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setNavOpen(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) setNavOpen(false);
    });
  }

  // Dropdown toggles (desktop click + mobile)
  document.querySelectorAll('.nav-dropdown-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const parent = btn.closest('.nav-item--dropdown');
      if (!parent) return;

      const willOpen = !parent.classList.contains('open');

      document.querySelectorAll('.nav-item--dropdown.open').forEach((item) => {
        if (item === parent) return;
        item.classList.remove('open');
        const toggle = item.querySelector('.nav-dropdown-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });

      parent.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.nav-item--dropdown')) return;

    document.querySelectorAll('.nav-item--dropdown.open').forEach((item) => {
      item.classList.remove('open');
      const toggle = item.querySelector('.nav-dropdown-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Admin sidebar slide-in drawer (mobile)
  const adminSidebar = document.getElementById('adminSidebar');
  const adminSidebarToggle = document.getElementById('adminSidebarToggle');
  const adminSidebarClose = document.getElementById('adminSidebarClose');
  const adminSidebarBackdrop = document.getElementById('adminSidebarBackdrop');
  const MOBILE_BREAKPOINT = 768;

  function isMobileAdminLayout() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function setAdminSidebarOpen(open) {
    if (!adminSidebar) return;

    const shouldOpen = open && isMobileAdminLayout();
    adminSidebar.classList.toggle('is-open', shouldOpen);
    document.body.classList.toggle('admin-sidebar-open', shouldOpen);

    if (adminSidebarToggle) {
      adminSidebarToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }

    if (adminSidebarBackdrop) {
      adminSidebarBackdrop.hidden = !shouldOpen;
      adminSidebarBackdrop.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    }

    if (isMobileAdminLayout()) {
      adminSidebar.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    } else {
      adminSidebar.setAttribute('aria-hidden', 'false');
    }
  }

  if (adminSidebar && adminSidebarToggle) {
    adminSidebarToggle.addEventListener('click', () => {
      setAdminSidebarOpen(!adminSidebar.classList.contains('is-open'));
    });

    if (adminSidebarClose) {
      adminSidebarClose.addEventListener('click', () => setAdminSidebarOpen(false));
    }

    if (adminSidebarBackdrop) {
      adminSidebarBackdrop.addEventListener('click', () => setAdminSidebarOpen(false));
    }

    adminSidebar.querySelectorAll('.admin-sidebar-link').forEach((link) => {
      link.addEventListener('click', () => setAdminSidebarOpen(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setAdminSidebarOpen(false);
    });

    window.addEventListener('resize', () => {
      if (!isMobileAdminLayout()) {
        setAdminSidebarOpen(false);
      }
    });

    setAdminSidebarOpen(false);
  }

  function addTableScrollHints() {
    if (window.innerWidth > 768) return;

    document.querySelectorAll(
      '.admin-table-wrap, .ca-sheet-wrap, .print-table-wrap, .student-terminal-report--embedded'
    ).forEach((wrap) => {
      if (!wrap.querySelector('table')) return;
      if (wrap.previousElementSibling && wrap.previousElementSibling.classList.contains('table-scroll-hint')) {
        return;
      }

      const hint = document.createElement('p');
      hint.className = 'table-scroll-hint table-scroll-hint--show';
      hint.textContent = 'Swipe sideways to see all columns.';
      wrap.parentNode.insertBefore(hint, wrap);
    });
  }

  addTableScrollHints();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(addTableScrollHints, 150);
  });

  // Hero carousel
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  const prevBtn = document.querySelector('.hero-nav--prev');
  const nextBtn = document.querySelector('.hero-nav--next');

  if (slides.length > 0) {
    let current = 0;
    let timer;

    function goTo(index) {
      slides[current].classList.remove('active');
      if (dots[current]) dots[current].classList.remove('active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('active');
      if (dots[current]) dots[current].classList.add('active');
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    function startAutoplay() {
      clearInterval(timer);
      timer = setInterval(next, 6000);
    }

    if (prevBtn) prevBtn.addEventListener('click', () => { prev(); startAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { next(); startAutoplay(); });

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        goTo(parseInt(dot.dataset.index, 10));
        startAutoplay();
      });
    });

    startAutoplay();
  }

  // Cookie banner
  const banner = document.getElementById('cookieBanner');
  const acceptBtn = document.getElementById('acceptCookies');

  if (banner && acceptBtn && !localStorage.getItem('cookiesAccepted')) {
    banner.hidden = false;
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('cookiesAccepted', 'true');
      banner.hidden = true;
    });
  }
})();
