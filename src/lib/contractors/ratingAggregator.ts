import type { ContractorJob } from './contractorTypes';

export function calculateOverallRating(scores: {
  speedScore: number;
  qualityScore: number;
  professionalismScore: number;
  communicationScore: number;
}): number {
  return Number(
    (
      (scores.speedScore +
        scores.qualityScore +
        scores.professionalismScore +
        scores.communicationScore) /
      4
    ).toFixed(2),
  );
}

export function aggregateRatings(jobs: ContractorJob[]) {
  const ratings = jobs.map((job) => job.rating?.overallScore).filter((score): score is number => typeof score === 'number');
  const avgRating = ratings.length
    ? Number((ratings.reduce((sum, score) => sum + score, 0) / ratings.length).toFixed(2))
    : 0;
  return { avgRating, ratingCount: ratings.length };
}
