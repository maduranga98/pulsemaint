export function computeRiskScore(likelihood: number, consequence: number): number {
  return likelihood * consequence;
}

export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score <= 6) return 'low';
  if (score <= 14) return 'medium';
  return 'high';
}

export function isHighPriorityAlert(riskScore: number, machineCriticality: number): boolean {
  return riskScore >= 15 && machineCriticality <= 2;
}
