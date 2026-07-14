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

  // Responsive table labels for card layout on small screens
  function enhanceResponsiveTables() {
    document.querySelectorAll('.admin-table, .ca-sheet-table, .print-result-table').forEach((table) => {
      if (table.dataset.mobileEnhanced) return;
      table.dataset.mobileEnhanced = 'true';

      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
      table.querySelectorAll('tbody tr').forEach((row) => {
        Array.from(row.cells).forEach((cell, index) => {
          if (headers[index]) cell.setAttribute('data-label', headers[index]);
        });
      });
    });

    document.querySelectorAll('.admin-table-wrap:not(.ca-sheet-wrap)').forEach((wrap) => {
      const table = wrap.querySelector('.admin-table');
      if (!table) return;
      let hint = wrap.querySelector('.table-scroll-hint');
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'table-scroll-hint table-scroll-hint--show';
        hint.textContent = 'Records are shown as cards on mobile for easier reading.';
        wrap.parentNode.insertBefore(hint, wrap);
      }
    });
  }

  enhanceResponsiveTables();

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
