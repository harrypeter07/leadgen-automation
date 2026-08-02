// dashboard/src/lib/animations/scroll.ts
import gsap from 'gsap';

export function createScrollTrigger(target: HTMLElement, callback: () => void) {
  if (typeof window === 'undefined') return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback();
        observer.unobserve(entry.target);
      }
    });
  });
  observer.observe(target);
  return observer;
}
