import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Thesis — A world of possibility',
  description: 'Discover a collection of tokenized projects in five immersive 3D worlds: Roots, Brooklyn, Steampunk, Volcanic, and Space.',
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
