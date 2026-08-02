// dashboard/src/lib/animations/sidebar.ts
import gsap from 'gsap';
import { EASINGS } from './easings';

export function animateSidebarToggle(sidebarTarget: HTMLElement, collapsed: boolean) {
  if (typeof window === 'undefined') return;
  return gsap.to(sidebarTarget, {
    width: collapsed ? 76 : 250,
    duration: 0.35,
    ease: EASINGS.editorial,
  });
}
