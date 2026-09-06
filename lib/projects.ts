export type Theme = 'brooklyn';
export interface Project {
  id: string; name: string; ticker: string; category: string; description: string;
  cap: string; change: string; image: string; icon: string; token?: string;
  color: string; featured?: boolean; comingSoon?: boolean; x: string | null; telegram: string | null;
  lore?: { heading: string; lines: string[] };
  // Placeholder builds tease instead: one of these is picked at random per hover.
  teases?: string[];
}
// Dice Game's cap and change start as dashes and are replaced with live
// DexScreener figures once they load, so no invented number is ever shown.
// The `comingSoon` builds are placeholders: they deliberately carry no metrics,
// no community links and no preview, so nothing invented is shown for them.
export const projects: Project[] = [
  { id: 'soon-two', name: 'Coming Soon', ticker: 'SOON', category: 'In development', description: 'Next up on the site.', cap: '', change: '', image: '/media/4266.webp', x: null, telegram: null, icon: '◷', color: '#add8e7', comingSoon: true, teases: [
      "You're curious, aren't you.",
      'Nothing to see here. Yet.',
      'This one is still under a tarp.',
      "Keep looking. It won't load any faster.",
      'The crane is doing its best.',
      'Scaffolding now. Story later.',
      "You hovered a building that doesn't exist yet.",
      'Patience is a position.',
      'Come back when the concrete sets.',
      'Under construction, like everything else here.',
    ] },
  { id: 'dice', name: 'Dice Game', ticker: 'DICE', category: 'Game', description: 'Roll to play.', cap: '—', change: '—', image: '/media/dice.webp', x: null, telegram: null, icon: '⚄', color: '#d4ec6e', featured: true, token: '3rbmAAonWqxmPJ7rzQUHyZtqwqrF54EZa3pJgphmpump',
    lore: { heading: 'SATOSHI DICE / 2012', lines: [
      'The first game most people ever played on a blockchain. You sent bitcoin to an address. The house sent back more, or nothing. The chain settled it in public.',
      'No account. No deposit. No one to trust. At its peak it accounted for more than half of all Bitcoin transactions, and it sold in 2013 for 126,315 BTC.',
      'That was the signal. The first thing crypto was truly good at was letting strangers bet without a middleman. A game does not need a market. It needs a meme, a fair roll, and somewhere to settle.',
    ] } },
  { id: 'soon-three', name: 'Coming Soon', ticker: 'SOON', category: 'In development', description: 'Next up on the site.', cap: '', change: '', image: '/media/41537.webp', x: null, telegram: null, icon: '◷', color: '#e5bb92', comingSoon: true, teases: [
      "You're curious, aren't you.",
      'Nothing to see here. Yet.',
      'This one is still under a tarp.',
      "Keep looking. It won't load any faster.",
      'The crane is doing its best.',
      'Scaffolding now. Story later.',
      "You hovered a building that doesn't exist yet.",
      'Patience is a position.',
      'Come back when the concrete sets.',
      'Under construction, like everything else here.',
    ] },
];
