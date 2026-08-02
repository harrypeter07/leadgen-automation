// dashboard/src/lib/animations/easings.ts
import gsap from 'gsap';

export const EASINGS = {
  power2: 'power2.out',
  power3: 'power3.out',
  power4: 'power4.out',
  expo: 'expo.out',
  circ: 'circ.out',
  back: 'back.out(1.4)',
  editorial: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

export const DURATIONS = {
  fast: 0.25,
  normal: 0.55,
  slow: 0.8,
};

if (typeof window !== 'undefined') {
  gsap.defaults({
    duration: DURATIONS.normal,
    ease: EASINGS.power3,
  });
}
