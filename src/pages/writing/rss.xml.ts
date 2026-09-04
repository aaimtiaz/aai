import type { APIRoute } from 'astro';
import { buildFeed } from '../../lib/feed';
import { site } from '../../data/site';

export const GET: APIRoute = async (ctx) =>
  buildFeed({
    sections: [{ name: 'writing', path: 'writing' }],
    title: `${site.name} — Writing`,
    description: 'Poetry and prose in English and Bengali.',
    siteUrl: ctx.site,
    self: '/writing/rss.xml',
  });
