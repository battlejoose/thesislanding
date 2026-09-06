import type { Project } from './projects';

export interface Lore { heading: string; lines: string[]; }

// A finished build tells its story; a placeholder just teases, picking one of
// its lines from the seed so repeat hovers do not repeat themselves.
export function loreFor(project: Project|null|undefined, seed: number): Lore|null {
  if (!project) return null;
  if (project.lore) return project.lore;
  const teases = project.teases;
  if (teases?.length) {
    const index = ((seed % teases.length) + teases.length) % teases.length;
    return { heading: 'SITE UNDER WRAPS', lines: [teases[index]] };
  }
  return null;
}
