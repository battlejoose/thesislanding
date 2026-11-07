import { appPath, sdiceSkin, thesisSkin, appName } from "./app-url.ts";
import { appFetch as fetch } from "./app-url.ts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AcidBackdrop } from './AcidBackdrop.tsx';
import { AcidBrand } from './AcidBrand.tsx';
import { AcidTradeSkin } from './AcidTradeSkin.tsx';
import { AcidInfoBorder } from './AcidInfoBorder.tsx';
import { LandingPreview } from './LandingPreview.tsx';
import { DocsFlow } from './DocsFlow.tsx';
import { docsContent } from './docs-content.ts';
import { FIRST_DOC_PAGE as FIRST_PAGE, canonicalDocsId, docsHref } from './docs-route.ts';
import releases from './generated/mainnet-releases.json';
import './public-pages.css';
import './sdice-landing.css';
import './sdice-docs.css';

const brandCopy = (text: string) => sdiceSkin ? text.replace(/\bAcidpump\b/gi, thesisSkin?'Thesis PERPS':'SDICE Perps') : text;
type MainnetRelease = (typeof releases)[number];
function PapertradeLink() { return <a href="https://papertrade.xyz/" target="_blank" rel="noopener noreferrer">papertrade.xyz <span aria-hidden="true">↗</span></a>; }

export function PublicPages({ route }: { route: 'landing' | 'docs' }) {
  return route === 'landing' ? <Landing /> : <Docs />;
}

function Landing() {
  useEffect(() => { document.title = appName; }, []);
  return <main className="landing">
    <AcidBackdrop />
    <div className="landing-topline"><span><i />{sdiceSkin ? 'SDICE PERPS / SOLANA' : 'SOLANA · PUMP.FUN COLLATERAL'}</span><a href={docsHref(FIRST_PAGE)}>{sdiceSkin ? 'Documentation ↗' : 'Meet the protocol ↗'}</a></div>
    <section className="landing-hero" aria-label={sdiceSkin ? "SDICE Perps introduction" : "Acidpump introduction"}>
      <div className="landing-copy">
        {sdiceSkin && <p className="sdice-landing-eyebrow">PERPETUALS · MAINNET</p>}
        <h1><AcidBrand /></h1>
        <LandingPromises />
        <nav className="landing-actions" aria-label="Get started"><a className="landing-trade" href={appPath("/trade")}><AcidTradeSkin long /><span>Trade <b aria-hidden="true">↗</b></span></a><a className="landing-docs" href={docsHref(FIRST_PAGE)}><AcidInfoBorder /><span>Docs <b aria-hidden="true">→</b></span></a></nav>
        <p className="landing-fineprint">Built on the FIFO debt queue pioneered by <PapertradeLink /></p>
      </div>
      <LandingPreview />
    </section>
  </main>;
}

function LandingPromises() {
  const points = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = points.current;
    const drop = node?.querySelector<HTMLElement>('.landing-acid-hop');
    if (!node || !drop) return;
    const items = node.querySelectorAll('li');
    // Measure only when the text reflows; CSS runs the motion without a JS timer.
    const measure = () => {
      const origin = node.getBoundingClientRect().top;
      items.forEach((item, i) => {
        const row = item.getBoundingClientRect();
        drop.style.setProperty(`--point-${i}`, `${row.top - origin + row.height / 2}px`);
      });
      // Start only after real row positions replace the old fixed fallbacks.
      drop.classList.add('is-measured');
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    items.forEach(item => observer.observe(item));
    measure();
    return () => observer.disconnect();
  }, []);
  return <div className="landing-points" ref={points}>
    <span className="landing-acid-hop" aria-hidden="true"><svg viewBox="0 0 28 30" fill="none"><path className="landing-acid-drop" d="M14 3C12 8 4 13 4 20a10 8 0 0 0 20 0c0-7-8-12-10-17Z" fill="#caff39" /><path d="M10 14c-2 2-3 4-3 6" stroke="#f4ffbe" strokeWidth="2.3" strokeLinecap="round"/><circle className="landing-acid-speck" cx="24" cy="7" r="2" fill="#79ffd0"/><circle className="landing-acid-speck" cx="3" cy="10" r="1.5" fill="#dfff91"/></svg></span>
    {sdiceSkin ? <ul className="landing-promises">
      <li><span>Up to <strong>1000×</strong> leverage</span></li>
      <li><span>Any <strong>pump.fun token</strong> as locked collateral</span></li>
      <li><span>Profits go to losing traders</span></li>
      <li><span>Fully onchain on <strong>Solana</strong></span></li>
    </ul> : <ul className="landing-promises"><li><strong>1000x</strong> leverage</li><li>use any pump.fun token as locked collateral</li><li>100% of platform profits go to losing traders</li><li>fully onchain on <span>Solana</span></li></ul>}
  </div>;
}

function Docs() {
  const [path, setPath] = useState(() => canonicalDocsId(location.hash.slice(2).split('?')[0]) || FIRST_PAGE);
  const [menu, setMenu] = useState(false);
  const [deployment, setDeployment] = useState<MainnetRelease | null>(null);
  const article = useRef<HTMLElement>(null);
  const pages = useMemo(() => docsContent('USDC', 'pPERPS').map(page => ({
    ...page, id: canonicalDocsId(page.id), title: brandCopy(page.title), lead: brandCopy(page.lead), sections: page.sections.map(section => ({
      ...section, title: brandCopy(section.title), paragraphs: section.paragraphs.map(brandCopy),
      note: section.note && brandCopy(section.note), bullets: section.bullets?.map(brandCopy),
      flow: section.flow?.map(brandCopy) as typeof section.flow,
      links: section.links?.map(link => ({...link, label: brandCopy(link.label)})),
    })),
  })), [deployment]);
  const index = pages.findIndex(page => page.id === path);
  const page = pages[index >= 0 ? index : 0];
  const groups = [...new Set(pages.map(p => p.group))];
  useEffect(() => {
    const abort = new AbortController();
    void fetch('/deployment.json', { signal: abort.signal, cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d || abort.signal.aborted) return;
      const match = releases.find(r => r.programId === d.programId && d.cluster === 'mainnet-beta' && d.assets?.some((a: { mint: string; feedId: number }) => a.feedId === 102 && a.mint === r.primaryMint));
      setDeployment(match ?? null);
    }).catch(() => {});
    return () => abort.abort();
  }, []);
  useEffect(() => {
    const change = () => {
      const hash = location.hash.slice(2);
      const previous = hash.split('?')[0];
      const next = canonicalDocsId(previous) || FIRST_PAGE;
      if (previous && previous !== next) {
        // Replace the legacy entry so Back does not loop through the old URL.
        history.replaceState(history.state, '', `${location.pathname}${location.search}#/${next}${hash.slice(previous.length)}`);
      }
      setPath(next); setMenu(false); window.scrollTo(0, 0); article.current?.focus({ preventScroll: true });
    };
    change();
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => { document.title = `${page.title} · ${appName} docs`; }, [page.title]);
  useEffect(() => { const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);
  const jump = (id: string) => document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  return <main className="docs-shell">
    <AcidBackdrop />
    <a className="docs-skip" href="#article" onClick={e => { e.preventDefault(); article.current?.focus(); }}>Skip to content</a>
    <header className="docs-header"><a href={appPath("/")} aria-label={`${appName} home`}><AcidBrand /></a><a className="docs-header-label" href={docsHref(FIRST_PAGE)}>Docs</a><a className="docs-header-trade" href={appPath("/trade")}>Trade ↗</a></header>
    <div className="docs-mobile-bar"><button aria-expanded={menu} aria-controls="docs-nav" onClick={() => setMenu(!menu)}>{menu ? '✕ Close navigation' : '☰ Explore docs'}</button><span>{page.group}</span></div>
    <div className="docs-layout">
      <aside id="docs-nav" className={`docs-sidebar${menu ? ' is-open' : ''}`}><nav aria-label="Documentation">{groups.map(group => <section key={group}><h2>{group}</h2>{pages.filter(p => p.group === group).map(p => <a key={p.id} href={docsHref(p.id)} aria-current={page.id === p.id ? 'page' : undefined} onClick={() => setMenu(false)}>{p.title}</a>)}</section>)}</nav><div className="docs-reference"><small>THE ORIGINAL FIFO PRIMITIVE</small><PapertradeLink /></div></aside>
      <article ref={article} className="docs-article" id="article" tabIndex={-1}>
        <div className="docs-breadcrumb">DOCS <span>/</span> {page.group} <span>/</span> {page.title}</div>
        <header><span className="docs-eyebrow">{page.group}</span><h1>{page.title}</h1><p className="docs-lead">{page.lead}</p></header>
        {index < 0 && <p className="docs-note">That page could not be found. Here is the introduction.</p>}
        {page.id === FIRST_PAGE && <section id="doc-mainnet-addresses" className="docs-mainnet-addresses" aria-label="Mainnet addresses"><DeploymentAddresses deployment={deployment} /></section>}
        {page.sections.map(section => <section id={`doc-${section.id}`} key={section.id} className={section.id === 'credit' ? 'docs-credit' : ''}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {section.id === 'credit' && <div className="docs-credit-link"><PapertradeLink /><a href="https://docs.papertrade.xyz/" target="_blank" rel="noopener noreferrer">Read their docs ↗</a></div>}
          {section.note && <p className="docs-note">{section.note}</p>}
          {section.flow && <DocsFlow labels={section.flow} caption={`${section.flow[0]} → ${section.flow[1]} → ${section.flow[2]}`} />}
          {section.bullets && <ul>{section.bullets.map(p => <li key={p}>{p}</li>)}</ul>}
          {section.links && <ul>{section.links.map(link => <li key={link.href}><a href={appPath(link.href)}>{link.label} ↗</a></li>)}</ul>}
          {page.id === 'dev/contract-addresses' && section.id === 'active' && <DeploymentAddresses deployment={deployment} />}
        </section>)}
        {page.id === FIRST_PAGE && <p className="docs-note">One USDC payout market for BTC, ETH, SOL and ZEC. Combine SOL and USDC for bet backing. Stake pPERPS to earn PERPS. Pool ownership is recorded as pPERPS.</p>}
        <nav className="docs-pager" aria-label="Previous and next pages">{index > 0 ? <a href={docsHref(pages[index - 1].id)}><small>← PREVIOUS</small>{pages[index - 1].title}</a> : <span />}{index < pages.length - 1 && <a href={docsHref(pages[Math.max(index, 0) + 1].id)}><small>NEXT →</small>{pages[Math.max(index, 0) + 1].title}</a>}</nav>
        <footer className="docs-article-footer"><a href={thesisSkin?docsHref('intro/solana-magicblock'):sdiceSkin ? '/perps/docs/intro/solana-magicblock' : appPath('/docs/onchain.html')}>Onchain architecture · HTML</a><a href={thesisSkin?appPath('/llms.txt'):sdiceSkin ? '/llms.txt' : appPath('/llms.txt')}>AI-readable docs</a><span>{appName} documentation</span></footer>
      </article>
      <aside className="docs-toc" aria-label="On this page"><h2>On this page</h2>{page.id === FIRST_PAGE && <button onClick={() => jump('mainnet-addresses')}>Mainnet program &amp; addresses</button>}{page.sections.map(s => <button key={s.id} onClick={() => jump(s.id)}>{s.title}</button>)}<a href={appPath("/trade")}>Put your bags to work ↗</a></aside>
    </div>
  </main>;
}

function DeploymentAddresses({ deployment }: { deployment: MainnetRelease | null }) {
  return <div className="docs-addresses">{deployment ? <>
    <Address label={`$${deployment.primarySymbol} token`} value={deployment.primaryMint} />
    <Address label={`${appName} program`} value={deployment.programId} />
  </> : <p>Mainnet addresses unavailable.</p>}</div>;
}

function Address({ label, value }: { label: string; value: string }) { return <div className="docs-address-row"><small>{label}</small><a href={`https://solscan.io/account/${value}`} title={value} aria-label={`${label}: ${value} (open in Solscan)`} target="_blank" rel="noopener noreferrer"><code>{value}</code><span aria-hidden="true">↗</span></a></div>; }
