// dashboard/src/lib/animations/counters.ts
import gsap from 'gsap';
import { DURATIONS, EASINGS } from './easings';

export function animateCountUp(target: HTMLElement, endValue: number, prefix = '', suffix = '') {
  if (typeof window === 'undefined') return;
  const obj = { val: 0 };
  return gsap.to(obj, {
    val: endValue,
    duration: DURATIONS.normal,
    ease: EASINGS.power3,
    onUpdate: () => {
      if (target) {
        target.innerText = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
      }
    },
  });
}
