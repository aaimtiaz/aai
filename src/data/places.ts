/**
 * Gazetteer: destination name -> coordinates.
 *
 * The importer strips `coordinate` from every Facebook post on the way in,
 * because that field also carries check-ins at home and at work. These are the
 * opposite: public destinations, resolved by hand, so the map reintroduces
 * nothing private. A place has to be listed here to appear on the map, which
 * is the point — nothing is geolocated automatically.
 *
 * Keys are matched case-insensitively against `location.name`, so the messier
 * names the import produced ("cox's bazar", "sylhet-jaflong") resolve too.
 */
export interface Place {
  lat: number;
  lon: number;
  /** What to print on the map and in listings. */
  label: string;
  country?: string;
}

export const PLACES: Record<string, Place> = {
  'chiang mai, thailand': { lat: 18.79, lon: 98.98, label: 'Chiang Mai', country: 'Thailand' },
  thailand: { lat: 12.89, lon: 100.87, label: 'Jomtien', country: 'Thailand' },
  sylhet: { lat: 24.9, lon: 91.87, label: 'Sylhet', country: 'Bangladesh' },
  'sylhet-jaflong': { lat: 25.16, lon: 92.02, label: 'Jaflong', country: 'Bangladesh' },
  bandarban: { lat: 22.2, lon: 92.22, label: 'Bandarban', country: 'Bangladesh' },
  "cox's bazar": { lat: 21.43, lon: 91.98, label: "Cox's Bazar", country: 'Bangladesh' },
  "saint martin's island": { lat: 20.63, lon: 92.32, label: "Saint Martin's", country: 'Bangladesh' },
  munshiganj: { lat: 23.55, lon: 90.53, label: 'Munshiganj', country: 'Bangladesh' },
  'হরষপুর': { lat: 23.94, lon: 91.28, label: 'Harashpur', country: 'Bangladesh' },
  'northern bangladesh': { lat: 26.33, lon: 88.55, label: 'Panchagarh', country: 'Bangladesh' },
  // The dark-sky ride: the post does not name a spot, and the whole point was
  // to find somewhere unlit outside the city. Placed at Sylhet, its start.
  bangladesh: { lat: 24.9, lon: 91.87, label: 'Sylhet', country: 'Bangladesh' },
};

export const lookupPlace = (name?: string): Place | undefined =>
  name ? PLACES[name.trim().toLowerCase()] : undefined;

/** How a trip was made. Drives the pin icon and the summary strip. */
export const MODES = {
  cycle: { label: 'By bicycle', icon: 'cycle' },
  hike: { label: 'On foot', icon: 'hike' },
  island: { label: 'Island', icon: 'island' },
  mountain: { label: 'Hills', icon: 'mountain' },
  road: { label: 'By road', icon: 'road' },
} as const;

export type Mode = keyof typeof MODES;
