// dashboard/src/lib/animations/loaders.ts
import gsap from 'gsap';

export function animateSkeletonShimmer(skeletonTarget: HTMLElement) {
  if (typeof window === 'undefined') return;
  return gsap.to(skeletonTarget, {
    opacity: 0.4,
    repeat: -1,
    yoyo: true,
    duration: 0.8,
    ease: 'power1.inOut',
  });
}
