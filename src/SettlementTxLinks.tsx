import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './components.tsx';
import { solscanTransaction } from './settlement-transactions.ts';

export function SettlementTxLinks({ signatures = [], cluster, label }: { signatures?: string[]; cluster: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const close = useCallback(() => setExpanded(false), []);
  const links = [...new Set(signatures)].flatMap(signature => {
    const href = solscanTransaction(signature, cluster);
    return href ? [{ signature, href }] : [];
  });
  if (!links.length) return null;
  const first = links[0];
  return <span className="journey-tx-links" onClick={e => e.stopPropagation()}>
    <a href={first.href} target="_blank" rel="noopener noreferrer" title={`${label} · ${first.signature}`} aria-label={`View ${label.toLowerCase()} transaction ${first.signature} on Solscan`}>
      {first.signature.slice(0, 4)}…{first.signature.slice(-4)}<span aria-hidden="true">↗</span>
    </a>
    {links.length > 1 && <button type="button" className="journey-tx-more" onClick={() => setExpanded(true)} aria-label={`View all ${links.length} ${label.toLowerCase()} transactions`}>+{links.length - 1}</button>}
    {expanded && createPortal(<Modal title={`${label} transactions`} close={close}>
      <div className="settlement-tx-list">{links.map(({ signature, href }) => <a key={signature} href={href} target="_blank" rel="noopener noreferrer"><code>{signature}</code><span>Solscan ↗</span></a>)}</div>
    </Modal>, document.body)}
  </span>;
}
