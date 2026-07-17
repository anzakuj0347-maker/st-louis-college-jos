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

  // Mobile dropdown toggles
  document.querySelectorAll('.nav-dropdown-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (window.innerWidth > 768) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const parent = btn.closest('.nav-item--dropdown');
      parent.classList.toggle('open');
      btn.setAttribute('aria-expanded', parent.classList.contains('open'));
    });
  });

  // Admin sidebar collapse (mobile)
  const adminSidebar = document.getElementById('adminSidebar');
  const adminSidebarToggle = document.getElementById('adminSidebarToggle');

  if (adminSidebar && adminSidebarToggle) {
    adminSidebarToggle.addEventListener('click', () => {
      const open = adminSidebar.classList.toggle('is-open');
      adminSidebarToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        adminSidebar.classList.remove('is-open');
        adminSidebarToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function addTableScrollHints() {
    if (window.innerWidth > 768) return;

    document.querySelectorAll(
      '.admin-table-wrap, .ca-sheet-wrap, .student-terminal-report--embedded, .print-ca-sheet'
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
