import type { Metadata } from 'next';
import { INITIAL_CONSTRUCTION_PROJECTS } from '@/lib/construction-projects';
import './globals.css';
export const metadata: Metadata = {
  title: 'Thesis — A world of possibility',
  description: 'Discover a collection of tokenized projects in five immersive 3D worlds: Roots, Brooklyn, Steampunk, Volcanic, and Space.',
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  // Explicit HTML hints survive Vercel's static export, including before hydration.
  return <html lang="en"><head>{INITIAL_CONSTRUCTION_PROJECTS.filter(project=>project.kind==='token').map(project=><link key={project.id} rel="preload" as="image" href={project.image} crossOrigin="anonymous" fetchPriority="high"/>)}</head><body>{children}</body></html>;
}
