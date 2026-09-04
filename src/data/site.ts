/** Single typed source of truth for identity, credentials and links.
 *
 *  Everything here is drawn from the CV (Ahmad_CV_CASSA.pdf) and the CASSA
 *  end-of-term GRA report. These are page facts, not collection entries, so
 *  they are not draft-gated — the homepage and /cv/ can show them immediately
 *  while the teaching/outreach/travel posts stay hidden.
 */

export const site = {
  name: 'Ahmad Al-Imtiaz',
  /** The one-line role. Deliberately the job title, not a self-description. */
  role: 'Graduate Research Assistant',
  description:
    'Ahmad Al-Imtiaz — Graduate Research Assistant at CASSA, Independent University, Bangladesh. Galaxy evolution and strong gravitational lensing with JWST, HST and Keck data.',
  email: 'ahmadal.imtiaz@gmail.com',

  affiliation: {
    role: 'Graduate Research Assistant',
    org: 'Center for Astronomy, Space Science and Astrophysics (CASSA)',
    institution: 'Independent University, Bangladesh',
    location: 'Dhaka, Bangladesh',
  },

  /** Empty entries are skipped everywhere rather than rendered as dead links. */
  profiles: {
    orcid: 'https://orcid.org/0009-0008-9598-3439',
    scholar: 'https://scholar.google.com/citations?user=EnTN0hMAAAAJ&hl=en',
    ads: '',
    github: 'https://github.com/aaimtiaz',
    arxiv: '',
  },

  cv: '/cv/ahmad-al-imtiaz-cv.pdf',
  analyticsId: 'G-P6X673H4S7',
} as const;

export const education = [
  {
    degree: 'M.Sc. in Physics',
    institution: 'Shahjalal University of Science and Technology',
    year: '2024',
    note: 'CGPA 3.56 / 4',
  },
  {
    degree: 'B.Sc. in Physics',
    institution: 'Shahjalal University of Science and Technology',
    year: '2022',
    note: 'CGPA 3.28 / 4',
  },
] as const;

/** Headline figures for the homepage. Each is traceable to the CV. */
export const stats = [
  { value: '2,300+', label: 'students reached through outreach' },
  { value: '6 years', label: 'of astronomy outreach' },
  { value: '11', label: 'schools and workshops' },
  { value: '3', label: 'telescopes operated' },
] as const;

export const awards = [
  {
    // The CV says "Best Oral Presenter"; the GRA report says the AGEL0014
    // *poster*. Worded neutrally until the owner confirms which.
    title: 'Best Presenter Award',
    detail: 'International Conference on Physics 2026, Bangladesh Physical Society — for AGEL0014',
    year: '2026',
  },
  {
    title: '15th globally, International Theoretical Physics Olympiad',
    detail: 'Team Bosons, SUST',
    year: '2019',
  },
  { title: 'Winner, University Physics Olympiad', detail: 'SUST', year: '2019' },
  {
    title: 'Hackathon winner, ASTRO101 workshop',
    detail: 'NARIT, Chiang Mai, Thailand',
    year: '2023',
  },
] as const;

export const telescopes = [
  'Celestron CGEM II 800 SCT 8" on a CGEM II computerised equatorial mount',
  'EvoStar 80ED Apo refractor on a Meade LX85 computerised equatorial mount',
  'Sky-Watcher Explorer-200P on an EQ6-R Pro computerised equatorial mount',
] as const;

export const tools = {
  research: ['Lenstronomy', 'Dense Basis', 'alf', 'photutils', 'STARRED', 'TOPCAT', 'ds9', 'APT', 'DRAGONS', 'JWST pipelines'],
  languages: ['Python', 'C', 'MATLAB', 'Mathematica'],
} as const;

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

export const nav = [
  { href: '/research/', label: 'Research' },
  { href: '/writing/', label: 'Writing' },
  { href: '/travel/', label: 'Travel' },
  { href: '/photography/', label: 'Photography' },
  { href: '/teaching/', label: 'Teaching' },
  { href: '/outreach/', label: 'Outreach' },
  { href: '/cv/', label: 'CV' },
] as const;
