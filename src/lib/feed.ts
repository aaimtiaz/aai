import rss from '@astrojs/rss';
import { getPublished, byDateDesc } from './content';
import { site } from '../data/site';
import type { CollectionKey } from 'astro:content';

/** One feed builder for the combined feed and each section feed. */
export async function buildFeed(opts: {
  sections: { name: CollectionKey; path: string }[];
  title: string;
  description: string;
  siteUrl: URL | undefined;
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

  return rss({
    title: opts.title,
    description: opts.description,
    site: opts.siteUrl!,
    items,
    customData: `<language>en</language><managingEditor>${site.email} (${site.name})</managingEditor>`,
  });
}
