/** Single typed source of truth for identity and links.
 *  Anything that appeared copy-pasted across the old five HTML files lives here. */

export const site = {
  name: 'Ahmad Al-Imtiaz',
  /** Short identity line under the name. */
  tagline: 'Observational astrophysicist',
  /** One-sentence default meta description; pages override it. */
  description:
    'Ahmad Al-Imtiaz — observational astrophysicist studying galaxy evolution through strong gravitational lensing, using JWST, HST and Keck data.',
  email: 'ahmadal.imtiaz@gmail.com',

  affiliation: {
    role: 'Graduate Research Assistant',
    org: 'Center for Astronomy, Space Science and Astrophysics',
    institution: 'Independent University, Bangladesh',
    location: 'Dhaka, Bangladesh',
  },

  /** Scholarly identity. Empty strings are skipped by the UI and by JSON-LD
   *  `sameAs`, so an unknown profile renders nothing rather than a dead link.
   *  ADS and arXiv are still blank — add them when you have the URLs. */
  profiles: {
    orcid: 'https://orcid.org/0009-0008-9598-3439',
    scholar: 'https://scholar.google.com/citations?user=EnTN0hMAAAAJ&hl=en',
    ads: '',
    github: 'https://github.com/aaimtiaz',
    arxiv: '',
  },

  cv: '/cv/ahmad-al-imtiaz-cv.pdf',

  /** GA4. Set to '' to drop analytics entirely. */
  analyticsId: 'G-P6X673H4S7',
} as const;

/** Non-empty profile links, ready for `sameAs` and the UI links row. */
export const profileLinks = Object.entries(site.profiles)
  .filter(([, url]) => url.length > 0)
  .map(([key, url]) => ({ key, url }));

export const nav = [
  { href: '/research/', label: 'Research' },
  { href: '/writing/', label: 'Writing' },
  { href: '/travel/', label: 'Travel' },
  { href: '/teaching/', label: 'Teaching' },
  { href: '/outreach/', label: 'Outreach' },
  { href: '/cv/', label: 'CV' },
] as const;
