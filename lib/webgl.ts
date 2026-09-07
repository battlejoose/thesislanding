// Whether this browser can render the 3D site at all. Checked before any of
// three.js is fetched, so a machine without acceleration is served the plain
// page instead of downloading a renderer it cannot use.
export function hasWebGL(): boolean {
  try {
    if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) return false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!context) return false;
    // Chrome hands back a context that fails on first use when the GPU process
    // is unavailable; losing it immediately is the reliable signal.
    const lose = (context as WebGLRenderingContext).getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}
