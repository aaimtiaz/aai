import type { APIRoute } from 'astro';
import { buildFeed } from '../lib/feed';
import { site } from '../data/site';

export const GET: APIRoute = async (ctx) =>
  buildFeed({
    sections: [
      { name: 'writing', path: 'writing' },
      { name: 'travel', path: 'travel' },
      { name: 'research', path: 'research' },
    ],
    title: site.name,
    description: site.description,
    siteUrl: ctx.site,
  });
