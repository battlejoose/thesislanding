import {BACKEND_ORIGIN, BACKEND_PREFIX} from '../src/hosting.ts';
import {THESIS_SHARE_ORIGIN, THESIS_X_HANDLE} from '../src/thesis-share.ts';

type Assets = {fetch(request: Request): Promise<Response>};
type Environment = {ASSETS: Assets};
const sharePath = /^\/share\/([a-f0-9]{64})(\.png)?$/;
const title = 'Thesis PERPS position';

/** Read only the already escaped metadata produced by our snapshot service.
 * Its older application shell and branding must never reach this domain. */
export function sharePage(appHtml: string, snapshotHtml: string, id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Invalid snapshot ID');
  const description = /<meta name="description" content="([^"<>]*)">/.exec(snapshotHtml)?.[1];
  const width = /<meta property="og:image:width" content="(\d+)">/.exec(snapshotHtml)?.[1];
  const height = /<meta property="og:image:height" content="(\d+)">/.exec(snapshotHtml)?.[1];
  if (description === undefined || !width || !height || +width < 1 || +height < 1 || +width > 2400 || +height > 2400)
    throw Error('Snapshot metadata unavailable');
  const url = `${THESIS_SHARE_ORIGIN}/share/${id}`, image = url + '.png';
  const metadata = `<title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:site_name" content="Thesis PERPS"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="${width}"><meta property="og:image:height" content="${height}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@${THESIS_X_HANDLE}"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="Thesis PERPS position snapshot">`;
  if (!/<head\b[^>]*>[\s\S]*?<\/head\s*>/i.test(appHtml)) throw Error('Application shell unavailable');
  return appHtml.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i, head => head
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, tag => {
      const attr = /\b(?:name|property)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
      const name = (attr?.[1] ?? attr?.[2] ?? attr?.[3] ?? '').toLowerCase();
      return name === 'description' || name.startsWith('og:') || name.startsWith('twitter:') ? '' : tag;
    })
    .replace(/<link\b[^>]*>/gi, tag => /\brel\s*=\s*(?:"canonical"|'canonical'|canonical(?:\s|\/?>))/i.test(tag) ? '' : tag)
    .replace(/<\/head\s*>/i, () => metadata + '</head>'));
}

const failure = (status: number, message: string, head: boolean) => new Response(head ? null : message, {
  status, headers: {'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'},
});

/** Only public snapshot reads pass through this Worker. Trading calls keep
 * their existing direct connection to the service. No cookies or auth forward. */
export async function handleShare(request: Request, env: Environment, upstream: typeof fetch = fetch): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/share/')) return env.ASSETS.fetch(request);
  const head = request.method === 'HEAD';
  if (!head && request.method !== 'GET') return new Response(null, {status:405,headers:{Allow:'GET, HEAD'}});
  const match = sharePath.exec(path);
  if (!match) return failure(404, 'Position snapshot not found', head);
  try {
    const image = !!match[2];
    const saved = await upstream(BACKEND_ORIGIN + BACKEND_PREFIX + path, {
      method: image && head ? 'HEAD' : 'GET', redirect:'manual',
      headers:{Accept:image ? 'image/png' : 'text/html'}, signal:AbortSignal.timeout(10_000),
    });
    if (!saved.ok) return failure(saved.status === 404 ? 404 : 502, 'Position snapshot unavailable', head);
    if (image) {
      if (saved.headers.get('content-type')?.split(';')[0] !== 'image/png') throw Error('Invalid snapshot image');
      return new Response(head ? null : saved.body, {headers:{
        'content-type':'image/png','cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff',
      }});
    }
    if (!saved.headers.get('content-type')?.startsWith('text/html')) throw Error('Invalid snapshot page');
    const app = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    if (!app.ok) throw Error('Application unavailable');
    const html = sharePage(await app.text(), await saved.text(), match[1]);
    const headers = new Headers({'content-type':'text/html; charset=utf-8','cache-control':'no-cache',
      'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer'});
    const policy = app.headers.get('content-security-policy');
    if (policy) headers.set('content-security-policy', policy);
    return new Response(head ? null : html, {headers});
  } catch (error) {
    console.error('Position snapshot unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return failure(502, 'Position snapshot temporarily unavailable. Please try again.', head);
  }
}

export default {fetch: (request: Request, env: Environment) => handleShare(request, env)};
