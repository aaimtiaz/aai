import rss from '@astrojs/rss';
import { getPublished, byDateDesc, type DatedCollection } from './content';
import { site } from '../data/site';

/** One feed builder for the combined feed and each section feed. */
export async function buildFeed(opts: {
  sections: { name: DatedCollection; path: string }[];
  title: string;
  description: string;
  siteUrl: URL | undefined;
  /** This feed's own path, for the atom self-link. */
  self: string;
}) {
  const groups = await Promise.all(
    opts.sections.map(async (s) =>
      (await getPublished(s.name)).map((e) => ({ e, path: s.path })),
    ),
  );

  const items = groups
    .flat()
    .sort((a, b) => byDateDesc(a.e, b.e))
    .map(({ e, path }) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.excerpt ?? '',
      link: `/${path}/${e.id}/`,
    }));

  const latest = items.reduce<Date | undefined>(
    (n, i) => (!n || i.pubDate > n ? i.pubDate : n), undefined);

  return rss({
    title: opts.title,
    description: opts.description,
    site: opts.siteUrl!,
    items,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData:
      `<language>en</language>` +
      `<managingEditor>${site.email} (${site.name})</managingEditor>` +
      `<atom:link href="${new URL(opts.self, opts.siteUrl)}" rel="self" type="application/rss+xml"/>` +
      (latest ? `<lastBuildDate>${latest.toUTCString()}</lastBuildDate>` : ''),
  });
}
