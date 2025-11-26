import { DonationStats, MenorahSegment } from './types';

// Calculate which segments should be lit based on percent complete
export function calculateLitSegments(
  percentComplete: number,
  segments: MenorahSegment[]
): string[] {
  // Sort segments by order (lowest first = bottom of menorah)
  const sorted = [...segments].sort((a, b) => a.order - b.order);

  // Return IDs of segments whose threshold has been reached
  return sorted
    .filter(seg => percentComplete >= seg.thresholdPercent)
    .map(seg => seg.id);
}

// Build stats object from total and config
export function buildStats(
  totalAmount: number,
  donationCount: number,
  goalAmount: number,
  segments: MenorahSegment[]
): DonationStats {
  // T059: Cap at 100% if total exceeds goal
  const percentComplete = Math.min(100, (totalAmount / goalAmount) * 100);

  return {
    totalAmount,
    donationCount,
    percentComplete,
    litSegments: calculateLitSegments(percentComplete, segments)
  };
}
