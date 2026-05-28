import { prisma } from './db';

/**
 * Seed example cleanup rules on first start so the user has a working baseline.
 * Idempotent: only inserts when the table is empty.
 */
export async function seedCleanupRulesIfEmpty(): Promise<void> {
  const count = await prisma.cleanupRule.count();
  if (count > 0) return;

  await prisma.cleanupRule.createMany({
    data: [
      {
        name: 'Always keep Marvel',
        description: 'Marvel movies (any production company containing "Marvel") are never marked for deletion.',
        scope: 'movie',
        kind: 'exception',
        priority: 10,
        enabled: true,
        matchJson: JSON.stringify({ studios: ['Marvel'] }),
        conditionsJson: '{}',
      },
      {
        name: 'Always keep DC',
        description: 'DC films are never marked for deletion.',
        scope: 'movie',
        kind: 'exception',
        priority: 10,
        enabled: true,
        matchJson: JSON.stringify({
          collections: ['DC Extended Universe', 'DC Universe'],
          studios: ['DC Films', 'DC Entertainment', 'DC Studios'],
        }),
        conditionsJson: '{}',
      },
      {
        name: 'Unwatched and poorly rated',
        description: 'Movies never played that scored below 5 on the third-party rating.',
        scope: 'movie',
        kind: 'eligibility',
        priority: 50,
        enabled: true,
        matchJson: '{}',
        conditionsJson: JSON.stringify({
          neverViewed: true,
          rating: { max: 5 },
        }),
      },
      {
        name: 'Watched once, poorly rated',
        description: 'Movies watched exactly once where the rating is below 5. Highly rewatched titles stay because viewCount > 1.',
        scope: 'movie',
        kind: 'eligibility',
        priority: 51,
        enabled: true,
        matchJson: '{}',
        conditionsJson: JSON.stringify({
          viewCount: { min: 1, max: 1 },
          rating: { max: 5 },
        }),
      },
      {
        name: 'Stale shows never finished',
        description: 'Shows you started but never returned to in over a year, and never finished more than half of.',
        scope: 'show',
        kind: 'eligibility',
        priority: 50,
        enabled: true,
        matchJson: '{}',
        conditionsJson: JSON.stringify({
          daysSinceLastView: { min: 365 },
          showCompletion: { max: 0.5 },
        }),
      },
      {
        name: 'Always keep Marvel TV',
        description: 'Marvel shows are never marked for deletion.',
        scope: 'show',
        kind: 'exception',
        priority: 10,
        enabled: true,
        matchJson: JSON.stringify({ studios: ['Marvel Television', 'Marvel Studios'] }),
        conditionsJson: '{}',
      },
    ],
  });
}
