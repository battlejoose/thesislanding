export type Theme = 'brooklyn';
export interface Project {
  id: string; name: string; ticker: string; category: string; description: string;
  cap: string; change: string; image: string; icon: string; token?: string;
  color: string; featured?: boolean; comingSoon?: boolean; x: string | null; telegram: string | null;
}
// The live build's name, symbol, figures and links all come from the token
// itself. Its cap and change start as dashes and are only ever replaced with
// fetched values, so no invented number is shown. The artwork is mirrored
// locally because the token image CDN sends no CORS header, and a cross-origin
// image cannot be uploaded as a WebGL texture.
// The `comingSoon` builds are placeholders: they deliberately carry no metrics,
// no community links and no preview, so nothing invented is shown for them.
export const projects: Project[] = [
  { id: 'soon-two', name: 'Coming Soon', ticker: 'SOON', category: 'In development', description: 'Next up on the site.', cap: '', change: '', image: '/media/4266.webp', x: null, telegram: null, icon: '◷', color: '#add8e7', comingSoon: true },
  { id: 'live', name: 'Zcash Cat', ticker: 'ZCASHCAT', category: 'Token', description: 'Live on pump.fun.', cap: '—', change: '—', image: '/media/token-art.webp', x: null, telegram: null, icon: '⚄', color: '#d4ec6e', featured: true, token: '3rbmAAonWqxmPJ7rzQUHyZtqwqrF54EZa3pJgphmpump' },
  { id: 'soon-three', name: 'Coming Soon', ticker: 'SOON', category: 'In development', description: 'Next up on the site.', cap: '', change: '', image: '/media/41537.webp', x: null, telegram: null, icon: '◷', color: '#e5bb92', comingSoon: true },
];
