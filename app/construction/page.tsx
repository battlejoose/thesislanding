import type { Metadata } from 'next';
import Construction from './construction';

export const metadata: Metadata = {
  title: 'Construction — Thesis',
  description: 'Explore project buildings in a living 3D Brooklyn cityscape.',
};

export default function ConstructionPage() {
  return <Construction />;
}
