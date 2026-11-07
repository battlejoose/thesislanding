import type { Plugin } from 'vite';
import { docsContent } from '../src/docs-content.ts';

// These pages contain no deployment-specific token names or addresses.
// Generate both crawler formats from the same content shown in the docs UI.
export function publicDocs(): Plugin {
  const sdice=process.env.SDICE_SKIN==='1';
  const thesis=process.env.THESIS_SKIN==='1';
  const brand=(text:string)=>thesis?text.replaceAll('acidpump.fun','Thesis PERPS').replaceAll('Acidpump','Thesis PERPS')
    .replaceAll('what-is-acidpump','what-is-thesis-perps').replace(/(href="|\]\()\/(?!\/|thesis[\/\"])/g,'$1/')
    :sdice?text.replaceAll('acidpump.fun','soltoshidice.wtf/perps').replaceAll('Acidpump','SDICE Perps')
    .replaceAll('what-is-acidpump','what-is-sdiceperps').replace(/(href="|\]\()\/(?!\/|perps[\/\"])/g,'$1/perps/'):text;
  return {
    name: 'public-onchain-docs',
    generateBundle() {
      const pages = docsContent('USDC','pPERPS').filter(page => ['intro/solana-magicblock', 'how/architecture', 'how/pricing'].includes(page.id));
      const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
      const anchor = (id: string) => id.replaceAll('/', '-');
      const link = ({ label, href }: { label: string; href: string }) => `<a href="${escape(href)}">${escape(label)}</a>`;
      const body = pages.map(page => `<article id="${anchor(page.id)}">
<h2>${escape(page.title)}</h2><p class="lead">${escape(page.lead)}</p>
${page.sections.map(section => `<section id="${anchor(page.id)}-${section.id}"><h3>${escape(section.title)}</h3>
${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('\n')}
${section.flow ? `<p class="flow">${section.flow.map(escape).join(' → ')}</p>` : ''}
${section.note ? `<p>${escape(section.note)}</p>` : ''}
${section.bullets ? `<ul>${section.bullets.map(p => `<li>${escape(p)}</li>`).join('')}</ul>` : ''}
${section.links ? `<ul>${section.links.map(item => `<li>${link(item)}</li>`).join('')}</ul>` : ''}
</section>`).join('\n')}</article>`).join('\n');
      this.emitFile({ type: 'asset', fileName: 'docs/onchain.html', source: brand(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solana &amp; MagicBlock · Acidpump docs</title>
<meta name="description" content="How Acidpump executes Solana programs in MagicBlock Ephemeral Rollups, streams prices, and settles funds on Solana mainnet.">
<meta name="theme-color" content="#080d0a"><link rel="icon" href="/favicon.svg"><link rel="alternate" type="text/plain" href="/llms.txt" title="AI-readable documentation">
<style>body{margin:0;background:#080d0a;color:#e6efdf;font:16px/1.7 system-ui,sans-serif}main{max-width:780px;margin:auto;padding:28px 22px 64px}a{color:#bfff62;text-underline-offset:3px}a:focus-visible{outline:2px solid #79e4c0;outline-offset:4px}nav{display:flex;gap:20px;flex-wrap:wrap}h1{font-size:clamp(28px,6vw,42px);line-height:1.2}h2{color:#c9ff74;line-height:1.3}h3{line-height:1.4}article{border-top:1px solid #30442e;padding-top:20px;margin-top:36px}section{margin:28px 0}.lead,.flow{color:#8ee1c2}footer{margin-top:42px;color:#a1b69b;font-size:13px}li{margin:8px 0}p,a{overflow-wrap:anywhere}</style>
</head><body><main><nav aria-label="Site"><a href="/">acidpump.fun</a><a href="/docs#/intro/solana-magicblock">Full docs</a><a href="/llms.txt">Plain text</a></nav>
<h1>Onchain trading on Solana with MagicBlock</h1><p>This page is the JavaScript-free version of Acidpump’s Solana, MagicBlock, architecture and pricing documentation.</p>
<nav aria-label="On this page">${pages.map(page => link({ label: page.title, href: '#' + anchor(page.id) })).join(' ')}</nav>
${body}<footer>Acidpump documentation · October 2026 · <a href="/deployment.json">Current public deployment configuration</a></footer>
</main></body></html>\n`) });
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: brand(`# Acidpump

> Acidpump is a Solana perpetuals platform using MagicBlock Ephemeral Rollups for delegated trading state and Solana mainnet for token custody and settlement.

## Documentation
- [Solana and MagicBlock: readable HTML](/docs/onchain.html): Complete explanation below, available without JavaScript.
- [Full site docs](/docs#/intro/what-is-acidpump): Trading, collateral, FIFO payouts, ownership, custody and risks.
- [Current deployment](/deployment.json): Public program and token configuration for this host.

${pages.map(page => `## ${page.title}\n\n${page.lead}\n\n${page.sections.map(section => `### ${section.title}\n\n${section.paragraphs.join('\n\n')}${section.note ? '\n\n' + section.note : ''}${section.flow ? '\n\n' + section.flow.join(' → ') : ''}${section.bullets ? '\n\n' + section.bullets.map(p => '- ' + p).join('\n') : ''}${section.links ? '\n\n' + section.links.map(item => `- [${item.label}](${item.href})`).join('\n') : ''}`).join('\n\n')}`).join('\n\n')}
`) });
    },
  };
}
