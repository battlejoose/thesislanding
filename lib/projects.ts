export type Theme = 'roots' | 'brooklyn' | 'steampunk' | 'volcanic' | 'space';
export interface Project {
  id: string; name: string; ticker: string; category: string; description: string;
  cap: string; change: string; image: string; video: string | null; icon: string;
  color: string; featured?: boolean; x: string | null; telegram: string | null;
  tokenAddress?: string; kind?: 'token' | 'soon'; dataState?: 'loading' | 'ready' | 'error' | 'stale';
  website?: string | null; tokenUrl?: string; updatedAt?: string;
  price?: string; volume?: string; liquidity?: string;
  imageAvailable?: boolean;
}
// Illustrative concept projects. Replace metrics and null community URLs with verified project data.
export const projects: Project[] = [
  { id: 'canopy', name: 'Canopy', ticker: 'CNPY', category: 'Regeneration', description: 'A greener future, grown together.', cap: '$12.8M', change: '+8.24%', image: '/media/41401.webp', video: '/media/41401.mp4', x: null, telegram: null, icon: '◈', color: '#d4ec6e', featured: true },
  { id: 'tide', name: 'Tide Protocol', ticker: 'TIDE', category: 'DeFi', description: 'Liquidity that moves with you.', cap: '$8.42M', change: '+5.17%', image: '/media/4266.webp', video: '/media/4266.mp4', x: null, telegram: null, icon: '≈', color: '#add8e7' },
  { id: 'terra', name: 'Terra Collective', ticker: 'TRRA', category: 'Real-world assets', description: 'Real places. Shared possibilities.', cap: '$24.6M', change: '+2.81%', image: '/media/41537.webp', video: '/media/41537.mp4', x: null, telegram: null, icon: '⌁', color: '#e5bb92' },
  { id: 'solace', name: 'Solace', ticker: 'SOLC', category: 'Clean energy', description: 'A little sunlight. A lasting impact.', cap: '$6.15M', change: '+12.36%', image: '/media/2168.webp', video: '/media/2168.mp4', x: null, telegram: null, icon: '✳', color: '#f5c077' },
  { id: 'wild', name: 'Wild Commons', ticker: 'WILD', category: 'Community', description: 'Some things are better belonging to everyone.', cap: '$3.72M', change: '+4.09%', image: '/media/40657.webp', video: '/media/40657.mp4', x: null, telegram: null, icon: '✺', color: '#d0d5ac' },
  { id: 'atlas', name: 'Atlas Network', ticker: 'ATLS', category: 'Infrastructure', description: 'Connecting the world we want to build.', cap: '$18.9M', change: '+6.42%', image: '/media/41389.webp', video: '/media/41389.mp4', x: null, telegram: null, icon: '⊕', color: '#c8bdec' },
];
