/** Single typed source of truth for identity, credentials and links.
 *
 *  Everything here is drawn from the CV (Ahmad_CV_CASSA.pdf) and the CASSA
 *  end-of-term GRA report. These are page facts, not collection entries, so
 *  they are not draft-gated — the homepage and /cv/ can show them immediately
 *  while the teaching/outreach/travel posts stay hidden.
 *
 *  The values live in site.json rather than here. This file used to hold them
 *  as `as const` literals, which meant the in-page editor could only change
 *  them by rewriting TypeScript from a browser — parsing and patching source
 *  code to edit a job title. JSON is data, so the editor writes it back the
 *  same way it writes a Markdown file, and this module stays the typed door
 *  everything else imports through.
 */
import data from './site.json';

export interface Education { degree: string; institution: string; year: string; note?: string }
export interface Stat { value: string; label: string }
export interface Award { title: string; detail?: string; year?: string }

export const site = data.site;
export const education: Education[] = data.education;
export const stats: Stat[] = data.stats;
export const awards: Award[] = data.awards;
export const telescopes: string[] = data.telescopes;
export const tools: { research: string[]; languages: string[] } = data.tools;

/** Non-empty profile links, ready for `sameAs` and the UI links row. */
export const profileLinks = Object.entries(site.profiles)
  .filter(([, url]) => url.length > 0)
  .map(([key, url]) => ({ key, url }));

export const PROFILE_LABELS: Record<string, string> = {
  orcid: 'ORCID',
  scholar: 'Google Scholar',
  ads: 'NASA ADS',
  github: 'GitHub',
  arxiv: 'arXiv',
};

/** Structural, not editorial: these are the site's routes, so they stay in
 *  code where a typo cannot produce a link to a page that does not exist. */
export const nav = [
  { href: '/research/', label: 'Research' },
  { href: '/writing/', label: 'Writing' },
  { href: '/travel/', label: 'Travel' },
  { href: '/teaching/', label: 'Teaching' },
  { href: '/outreach/', label: 'Outreach' },
  { href: '/cv/', label: 'CV' },
] as const;
