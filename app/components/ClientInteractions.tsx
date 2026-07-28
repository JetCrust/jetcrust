"use client";
import { useEffect } from "react";

// Ports the original main.js behaviour: sticky header, mobile menu,
// reveal-on-scroll, testimonial rotator, newsletter stub, footer year.
export default function ClientInteractions() {
  useEffect(() => {
    const header = document.getElementById("header");
    const onScroll = () => {
      if (!header) return;
      if (window.scrollY > 40) header.classList.add("solid");
      else header.classList.remove("solid");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("navMenu");
    const onToggle = () => {
      const open = menu?.classList.toggle("open");
      toggle?.setAttribute("aria-expanded", String(!!open));
    };
    const onMenuClick = (e: Event) => {
      if ((e.target as HTMLElement).closest("a")) {
        menu?.classList.remove("open");
        toggle?.setAttribute("aria-expanded", "false");
      }
    };
    toggle?.addEventListener("click", onToggle);
    menu?.addEventListener("click", onMenuClick);

    const reveals = document.querySelectorAll(".reveal");
    let io: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io!.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
      );
      reveals.forEach((el) => io!.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add("in"));
    }

    const quotes = document.querySelectorAll(".quote");
    const dots = document.querySelectorAll("#quoteDots button");
    let timer: ReturnType<typeof setInterval> | undefined;
    let current = 0;
    if (quotes.length && dots.length) {
      const show = (i: number) => {
        quotes[current].classList.remove("active");
        dots[current].classList.remove("active");
        current = (i + quotes.length) % quotes.length;
        quotes[current].classList.add("active");
        dots[current].classList.add("active");
      };
      const start = () => (timer = setInterval(() => show(current + 1), 6500));
      dots.forEach((dot, i) =>
        dot.addEventListener("click", () => {
          show(i);
          if (timer) clearInterval(timer);
          start();
        })
      );
      start();
    }

    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());

    return () => {
      window.removeEventListener("scroll", onScroll);
      toggle?.removeEventListener("click", onToggle);
      menu?.removeEventListener("click", onMenuClick);
      io?.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}
