// dashboard/src/lib/animations/modals.ts
import gsap from 'gsap';
import { DURATIONS, EASINGS } from './easings';

export function animateModalOpen(modalTarget: HTMLElement) {
  if (typeof window === 'undefined') return;
  return gsap.fromTo(
    modalTarget,
    { opacity: 0, scale: 0.94, filter: 'blur(8px)' },
    { opacity: 1, scale: 1, filter: 'blur(0px)', duration: DURATIONS.normal, ease: EASINGS.editorial }
  );
}
