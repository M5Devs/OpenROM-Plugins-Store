/**
 * Composes the public publisher profile: the publisher record, its live aggregates,
 * and the extensions it has published. Shared by the JSON API and the profile page so
 * both always agree on the numbers.
 */

import { getPublisherStats, listPluginsByPublisher, type Plugin, type PublisherStats } from './db.ts';
import { getPublisher, type Publisher } from './publishers.ts';

export interface PublisherProfile {
  publisher: Publisher;
  stats: PublisherStats;
  plugins: Plugin[];
}

/**
 * Outcome of loading a profile, so callers can tell the two failure modes apart:
 * a publisher that does not exist (render a 404) versus a database read that threw
 * (render a 503). Collapsing these into `null` is what made a missing `publishers`
 * table — an unapplied migration — surface as an unhandled 500.
 */
export type PublisherProfileResult =
  | { status: 'ok'; profile: PublisherProfile }
  | { status: 'not-found' }
  | { status: 'error'; error: unknown };

export async function loadPublisherProfile(
  db: D1Database,
  id: string,
): Promise<PublisherProfileResult> {
  try {
    const profile = await getPublisherProfile(db, id);
    return profile ? { status: 'ok', profile } : { status: 'not-found' };
  } catch (error) {
    return { status: 'error', error };
  }
}

export async function getPublisherProfile(
  db: D1Database,
  id: string,
): Promise<PublisherProfile | null> {
  const publisher = await getPublisher(db, id);
  if (!publisher) return null;

  const [plugins, stats] = await Promise.all([
    listPluginsByPublisher(db, publisher.id, publisher.name),
    getPublisherStats(db, publisher.id, publisher.name),
  ]);

  return { publisher, stats, plugins };
}
