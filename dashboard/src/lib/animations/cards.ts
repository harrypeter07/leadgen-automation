// dashboard/src/lib/animations/cards.ts
import gsap from 'gsap';
import { EASINGS, DURATIONS } from './easings';

export function animateCardReveal(targets: gsap.TweenTarget, stagger = 0.04) {
  if (typeof window === 'undefined') return;
  return gsap.fromTo(
    targets,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: DURATIONS.normal, ease: EASINGS.power3, stagger }
  );
}

export function animateCardHover(target: HTMLElement) {
  if (typeof window === 'undefined') return;
  return gsap.to(target, {
    y: -4,
    scale: 1.015,
    duration: DURATIONS.fast,
    ease: EASINGS.power2,
  });
}

export function animateCardLeave(target: HTMLElement) {
  if (typeof window === 'undefined') return;
  return gsap.to(target, {
    y: 0,
    scale: 1,
    duration: DURATIONS.fast,
    ease: EASINGS.power2,
  });
}
