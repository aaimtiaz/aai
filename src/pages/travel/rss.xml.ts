import type { APIRoute } from 'astro';
import { buildFeed } from '../../lib/feed';
import { site } from '../../data/site';

export const GET: APIRoute = async (ctx) =>
  buildFeed({
    sections: [{ name: 'travel', path: 'travel' }],
    title: `${site.name} — Travel`,
    description: 'Travel writing and photographs.',
    siteUrl: ctx.site,
    self: '/travel/rss.xml',
  });
