// dashboard/src/lib/animations/dashboard.ts
import gsap from 'gsap';
import { animateCardReveal } from './cards';

export function animateDashboardOrchestrator(dashboardContainer: HTMLElement) {
  if (typeof window === 'undefined') return;
  const cards = dashboardContainer.querySelectorAll('.glass');
  if (cards.length > 0) {
    animateCardReveal(cards, 0.05);
  }
}
