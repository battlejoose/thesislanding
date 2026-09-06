import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Thesis — A world of possibility',
  description: 'Discover a collection of tokenized projects in three immersive worlds: Roots, Brooklyn, and Steampunk.',
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
