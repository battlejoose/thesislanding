import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Thesis — A world of possibility',
  description: 'We are building Gamified Ponzification Proliferation. A Brooklyn skyline of builds, rendered in 3D.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
