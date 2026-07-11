(function () {
  'use strict';

  // Mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open);
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
