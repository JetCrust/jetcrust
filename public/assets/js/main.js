/* =====================================================================
   Jet Crust — homepage interactions
   Vanilla JS, no dependencies. Kept small and readable on purpose.
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Sticky header: solid on scroll ---- */
  var header = document.getElementById('header');
  var onScroll = function () {
    if (window.scrollY > 40) header.classList.add('solid');
    else header.classList.remove('solid');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---- Mobile menu ---- */
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('navMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- Reveal on scroll ---- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Testimonial rotator ---- */
  var quotes = document.querySelectorAll('.quote');
  var dots = document.querySelectorAll('#quoteDots button');
  if (quotes.length && dots.length) {
    var current = 0;
    var timer;
    var show = function (i) {
      quotes[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = (i + quotes.length) % quotes.length;
      quotes[current].classList.add('active');
      dots[current].classList.add('active');
    };
    var start = function () { timer = setInterval(function () { show(current + 1); }, 6500); };
    var reset = function () { clearInterval(timer); start(); };
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); reset(); });
    });
    start();
  }

  /* ---- Newsletter: gentle inline confirmation (wire to real provider later) ---- */
  var newsForm = document.getElementById('newsForm');
  if (newsForm) {
    newsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = newsForm.querySelector('input');
      if (input && input.value && input.checkValidity()) {
        newsForm.innerHTML = '<p style="margin:0;color:var(--brass-2);font-size:0.85rem;">Thank you. We will be in touch.</p>';
      } else if (input) {
        input.focus();
      }
    });
  }

  /* ---- Enquiry form: inline confirmation (wire to booking engine later) ---- */
  var enquireForm = document.getElementById('enquireForm');
  if (enquireForm) {
    enquireForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!enquireForm.checkValidity()) { enquireForm.reportValidity(); return; }
      enquireForm.innerHTML = '<p class="full" style="margin:0;font-family:var(--serif);font-size:1.5rem;color:var(--ink);">Thank you. Your enquiry is with us, and we will reply personally, usually within the day.</p>';
    });
  }

  /* ---- Footer year ---- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
