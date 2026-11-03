/**
 * Composes the public publisher profile: the publisher record, its live aggregates,
 * and the extensions it has published. Shared by the JSON API and the profile page so
 * both always agree on the numbers.
 */

import { getPublisherStats, listPluginsByPublisher, type Plugin, type PublisherStats } from './db';
import { getPublisher, type Publisher } from './publishers';

export interface PublisherProfile {
  publisher: Publisher;
  stats: PublisherStats;
  plugins: Plugin[];
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
