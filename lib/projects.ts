export type Theme = 'brooklyn';
export interface Project {
  id: string; name: string; ticker: string; category: string; description: string;
  cap: string; change: string; image: string; icon: string;
  color: string; featured?: boolean; comingSoon?: boolean; x: string | null; telegram: string | null;
}
// Dice Game carries illustrative metrics until verified figures are supplied.
// The `comingSoon` builds are placeholders: they deliberately carry no metrics,
// no community links and no preview, so nothing invented is shown for them.
export const projects: Project[] = [
  { id: 'dice', name: 'Dice Game', ticker: 'DICE', category: 'Game', description: 'Roll to play.', cap: '$12.8M', change: '+8.24%', image: '/media/dice.webp', x: null, telegram: null, icon: '⚄', color: '#d4ec6e', featured: true },
  { id: 'soon-two', name: 'Coming Soon', ticker: 'SOON', category: 'In development', description: 'Next up on the site.', cap: '', change: '', image: '/media/4266.webp', x: null, telegram: null, icon: '◷', color: '#add8e7', comingSoon: true },
  { id: 'soon-three', name: 'Coming Soon', ticker: 'SOON', category: 'In development', description: 'Next up on the site.', cap: '', change: '', image: '/media/41537.webp', x: null, telegram: null, icon: '◷', color: '#e5bb92', comingSoon: true },
];
