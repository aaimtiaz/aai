/**
 * Article-level structured data.
 *
 * Built here rather than inline in each entry template, because each template
 * had drifted: research emitted schema only when a `publication` existed, so
 * three of seven research entries shipped `og:type="article"` with no article
 * markup at all. And none of them carried `image`, which Google requires for
 * Article rich results — so the site was eligible for none.
 */

export interface ArticleInput {
  type: 'BlogPosting' | 'ScholarlyArticle' | 'ImageGallery';
  title: string;
  url: string;
  siteUrl: string;
  date: Date;
  updated?: Date;
  lang?: string;
  description?: string;
  /** Absolute URL of the entry's own image, when it has one. */
  image?: string;
  publication?: {
    venue?: string;
    doi?: string;
    arxiv?: string;
    adsBibcode?: string;
    role?: string;
  };
  authorName: string;
  personId: string;
}

export function articleSchema(a: ArticleInput): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': a.type,
    '@id': `${a.url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.url },
    url: a.url,
    headline: a.title,
    name: a.title,
    datePublished: a.date.toISOString(),
    // Falling back to datePublished is honest: an entry that has never been
    // revised was last modified when it was written.
    dateModified: (a.updated ?? a.date).toISOString(),
    // Reference the sitewide Person by id instead of repeating a bare name,
    // so the graph resolves to one author rather than dozens of duplicates.
    author: { '@id': a.personId },
    publisher: { '@id': a.personId },
    ...(a.lang ? { inLanguage: a.lang } : {}),
    ...(a.description ? { description: a.description } : {}),
    ...(a.image ? { image: [a.image] } : {}),
  };

  if (a.publication) {
    const p = a.publication;
    // schema.org expects a Periodical here, not a bare string.
    if (p.venue) node.publication = { '@type': 'Periodical', name: p.venue };
    if (p.doi) {
      node.identifier = { '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi };
      node.sameAs = `https://doi.org/${p.doi}`;
    }
    if (p.arxiv) node.arxivId = p.arxiv;
  }

  return node;
}

/** Root-first breadcrumb trail for an entry page. */
export const crumbsFor = (section: string, label: string, title: string) => [
  { name: 'Home', href: '/' },
  { name: label, href: `/${section}/` },
  { name: title, href: `/${section}/` },
];
