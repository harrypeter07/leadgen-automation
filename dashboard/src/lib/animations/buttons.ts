// dashboard/src/lib/animations/buttons.ts
import gsap from 'gsap';
import { DURATIONS, EASINGS } from './easings';

export function animateButtonHover(target: HTMLElement) {
  if (typeof window === 'undefined') return;
  return gsap.to(target, {
    scale: 1.02,
    duration: DURATIONS.fast,
    ease: EASINGS.power2,
  });
}

export function animateButtonPressed(target: HTMLElement) {
  if (typeof window === 'undefined') return;
  return gsap.to(target, {
    scale: 0.98,
    duration: 0.1,
    ease: EASINGS.power2,
  });
}
