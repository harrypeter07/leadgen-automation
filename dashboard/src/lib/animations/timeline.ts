// dashboard/src/lib/animations/timeline.ts
import gsap from 'gsap';
import { EASINGS, DURATIONS } from './easings';

export function createMasterTimeline(options: gsap.TimelineVars = {}) {
  return gsap.timeline({
    defaults: {
      duration: DURATIONS.normal,
      ease: EASINGS.power3,
    },
    ...options,
  });
}
