export type PlanTier = 'scheduler' | 'scheduler_pro' | 'creator' | 'growth';

export interface PlanConfig {
  id: PlanTier;
  name: string;
  badge?: string;
  monthlyPriceUsd: number;
  yearlyMonthlyPriceUsd: number;
  maxWorkflows: number;            // 1 Workflow = up to 5 distinct accounts (IG, TT, YT, FB, LI)
  maxManualUploadsPerDay: number;  // Unique files allowed per day across active workflows
  monthlyAiCredits: number;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  scheduler: {
    id: 'scheduler',
    name: 'Scheduler',
    monthlyPriceUsd: 9.99,
    yearlyMonthlyPriceUsd: 7.99,
    maxWorkflows: 1,
    maxManualUploadsPerDay: 3,
    monthlyAiCredits: 15,
  },
  scheduler_pro: {
    id: 'scheduler_pro',
    name: 'Scheduler Pro',
    monthlyPriceUsd: 16.99,
    yearlyMonthlyPriceUsd: 13.59,
    maxWorkflows: 2,
    maxManualUploadsPerDay: 6,
    monthlyAiCredits: 15,
  },
  creator: {
    id: 'creator',
    name: 'Creator',
    monthlyPriceUsd: 24.0,
    yearlyMonthlyPriceUsd: 19.0,
    maxWorkflows: 1,
    maxManualUploadsPerDay: 3,
    monthlyAiCredits: 35,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    badge: 'Most Popular',
    monthlyPriceUsd: 39.0,
    yearlyMonthlyPriceUsd: 31.0,
    maxWorkflows: 2,
    maxManualUploadsPerDay: 6,
    monthlyAiCredits: 60,
  },
};

export function getPlanConfig(tier?: string | null): PlanConfig {
  if (tier && tier in PLAN_CONFIGS) {
    return PLAN_CONFIGS[tier as PlanTier];
  }
  return PLAN_CONFIGS.scheduler;
}
