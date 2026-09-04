import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Design principle: almost everything is optional.
 *
 * These schemas are written to from a phone, and a Zod failure fails the
 * Cloudflare build. Only `title` and `date` are ever required. A missing
 * optional field renders less; a required field that someone forgot takes
 * the whole site's next deploy down.
 */

/** Non-recursive on purpose: the sibling `images/` folder must never be
 *  matched as an entry. */
const md = (name: string) =>
  glob({ base: `./src/content/${name}`, pattern: '*.md' });

const base = {
  title: z.string(),

  /** Real Date, used ONLY for sorting, RSS pubDate and <time datetime>. */
  date: z.coerce.date(),
  /** What actually renders when the true date is fuzzy, e.g. "খুব সম্ভবত ২০২২".
   *  Keeps the timeline sortable without printing a false precision. */
  dateNote: z.string().optional(),
  updated: z.coerce.date().optional(),

  lang: z.enum(['en', 'bn']).default('en'),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),

  /** Provenance, so imported posts stay distinguishable from originals. */
  source: z.enum(['original', 'facebook']).default('original'),
  sourceUrl: z.string().url().optional(),
};

/** `image()` resolves paths relative to the entry file because the built-in
 *  glob() loader sets `filePath`. Under a custom or remote loader these would
 *  silently degrade to untransformed public paths. */
const cover = (image: () => any) => ({
  cover: image().optional(),
  coverAlt: z.string().default(''),
  coverCaption: z.string().optional(),
});

const writing = defineCollection({
  loader: md('writing'),
  schema: ({ image }) =>
    z.object({
      ...base,
      ...cover(image),
      form: z.enum(['poem', 'prose']).default('prose'),
      intro: z.string().optional(),
      note: z.string().optional(),
    }),
});

const travel = defineCollection({
  loader: md('travel'),
  schema: ({ image }) =>
    z.object({
      ...base,
      ...cover(image),
      location: z
        .object({ name: z.string(), country: z.string().optional() })
        .optional(),
      // How the trip was made, and how far. Drives the map pins and the
      // summary strip on /travel/. Both optional — plenty of trips are just
      // "went somewhere".
      mode: z.enum(['cycle', 'hike', 'island', 'mountain', 'road']).optional(),
      distanceKm: z.number().optional(),
      // `credit` exists because a gallery image previously had nowhere to
      // carry a photographer's name — which is how four photographs by
      // someone else shipped uncredited.
      gallery: z
        .array(
          z.object({
            src: image(),
            alt: z.string().default(''),
            caption: z.string().optional(),
            credit: z.string().optional(),
          }),
        )
        .default([]),
    }),
});

const research = defineCollection({
  loader: md('research'),
  schema: ({ image }) =>
    z.object({
      ...base,
      ...cover(image),
      supervisor: z.string().optional(),
      status: z.enum(['published', 'in-prep', 'ongoing']).default('ongoing'),
      /** Display order on /research/; lower first. */
      order: z.number().default(0),
      /** Present only for entries that are also publications. Lets /research/
       *  render a publications table AND a project grid from one collection. */
      publication: z
        .object({
          venue: z.string().optional(),
          doi: z.string().optional(),
          arxiv: z.string().optional(),
          adsBibcode: z.string().optional(),
          authors: z.array(z.string()).default([]),
          role: z.string().optional(),
        })
        .optional(),
    }),
});

const teaching = defineCollection({
  loader: md('teaching'),
  schema: ({ image }) =>
    z.object({
      ...base,
      ...cover(image),
      institution: z.string().optional(),
      role: z.string().optional(),
      term: z.string().optional(),
      endDate: z.coerce.date().optional(),
    }),
});

const outreach = defineCollection({
  loader: md('outreach'),
  schema: ({ image }) =>
    z.object({
      ...base,
      ...cover(image),
      org: z.string().optional(),
      role: z.string().optional(),
      eventDate: z.coerce.date().optional(),
    }),
});

/**
 * Photography. A collection rather than a static gallery page, so new sets can
 * be posted from /admin/ the same way writing is.
 */
const photography = defineCollection({
  loader: md('photography'),
  schema: ({ image }) =>
    z.object({
      ...base,
      ...cover(image),
      location: z.object({ name: z.string(), country: z.string().optional() }).optional(),
      /** Groups related sets, e.g. "Night sky" or "By the river". */
      series: z.string().optional(),
      gallery: z
        .array(
          z.object({
            src: image(),
            alt: z.string().default(''),
            caption: z.string().optional(),
            credit: z.string().optional(),
          }),
        )
        .default([]),
    }),
});

/** Standalone prose blocks (the home bio) kept as content, not markup. */
const pages = defineCollection({
  loader: md('pages'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      ...cover(image),
    }),
});

export const collections = { writing, travel, research, teaching, outreach, photography, pages };
