import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const release=JSON.parse(readFileSync(new URL('../kolperps-provenance.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../public/kolperps/index.html',import.meta.url),'utf8');

test('KOL preview is an independent entry with assets rooted at its public subpath',()=>{
  assert.match(html,/<title>Thesis PERPS · Coming soon<\/title>/);
  assert.match(html,/<link rel="canonical" href="https:\/\/thesis\.casino\/kolperps\/"/);
  const assets=[...html.matchAll(/(?:src|href)="(\/[^"<>]+)"/g)].map(match=>match[1]);
  assert.ok(assets.some(path=>path.endsWith('.js')));
  assert.ok(assets.some(path=>path.endsWith('.css')));
  for(const path of assets){
    assert.ok(path.startsWith('/kolperps/'),`Unexpected asset path: ${path}`);
    assert.ok(release.files.some((file:{path:string})=>file.path===path.slice(1)),`Missing release asset: ${path}`);
  }
});

test('pinned landing files match the reviewed source release manifest',()=>{
  assert.match(release.sourceCommit,/^[a-f0-9]{40}$/);
  assert.equal(release.mountPath,'/kolperps/');
  for(const file of release.files){
    assert.match(file.path,/^kolperps\/[a-zA-Z0-9_./-]+$/);
    assert.ok(!file.path.includes('..'));
    const bytes=readFileSync(new URL('../public/'+file.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
  }
});
