import type { Metadata } from 'next';
import Construction from './construction/construction';

export const metadata: Metadata = {
  title: 'Thesis — A world of possibility',
  description: 'We are building Gamified Ponzification Proliferation. A Brooklyn skyline of builds, rendered in 3D.',
};

export default function Home() {
  return <Construction />;
}
