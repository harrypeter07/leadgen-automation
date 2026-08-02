// dashboard/src/lib/animations/hover.ts
import gsap from 'gsap';

export function setupHoverEffect(target: HTMLElement) {
  if (typeof window === 'undefined') return;

  const enter = () => gsap.to(target, { scale: 1.02, duration: 0.2, ease: 'power2.out' });
  const leave = () => gsap.to(target, { scale: 1, duration: 0.2, ease: 'power2.out' });

  target.addEventListener('mouseenter', enter);
  target.addEventListener('mouseleave', leave);

  return () => {
    target.removeEventListener('mouseenter', enter);
    target.removeEventListener('mouseleave', leave);
  };
}
