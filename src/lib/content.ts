import { getCollection, type CollectionKey } from 'astro:content';

/** Every collection except `pages`, which holds standalone prose (the home
 *  bio) and deliberately has no date, tags or excerpt. Anything that sorts,
 *  feeds or lists by date must use this, not CollectionKey. */
export type DatedCollection = Exclude<CollectionKey, 'pages'>;

/** Drafts render in `astro dev` so imported/unfinished posts are reviewable,
 *  and disappear from production builds and the sitemap. */
export const published = ({ data }: { data: { draft: boolean } }) =>
  import.meta.env.PROD ? !data.draft : true;

export async function getPublished<K extends CollectionKey>(name: K) {
  return getCollection(name, published as any);
}

/** Newest content date across every collection — the honest "last updated". */
export async function siteUpdatedAt(): Promise<Date | undefined> {
  const names: DatedCollection[] = ['writing', 'travel', 'research', 'teaching', 'outreach'];
  const all = await Promise.all(names.map((n) => getPublished(n)));
  const dates = all
    .flat()
    .map((e: any) => e.data.updated ?? e.data.date)
    .filter(Boolean) as Date[];
  if (!dates.length) return undefined;
  return dates.reduce((a, b) => (a > b ? a : b));
}

export const byDateDesc = (a: { data: { date: Date } }, b: { data: { date: Date } }) =>
  b.data.date.valueOf() - a.data.date.valueOf();

/** What to show for a date: the fuzzy note when the true date is a guess. */
export function displayDate(data: { date: Date; dateNote?: string; lang?: string }) {
  if (data.dateNote) return data.dateNote;
  return data.date.toLocaleDateString(data.lang === 'bn' ? 'bn-BD' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/** Single definition of a tag's URL segment. Imported by both the tag route
 *  that generates pages and the entry pages that link to them, so a link can
 *  never point at a slug the build did not produce. */
export const tagSlug = (t: string) => t.trim().toLowerCase().replace(/\s+/g, '-');
