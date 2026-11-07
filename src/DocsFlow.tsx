import { appPath, sdiceSkin } from "./app-url.ts";
import { useId } from 'react';

/** Responsive SDICE steps; retain the original skin's lightweight SVG. */
export function DocsFlow({ labels = ['Your bag', 'Leveraged position', 'FIFO payout'], caption = 'Your tokens power a synthetic position. Profits enter an oldest-first payout queue.' }: { labels?: [string, string, string]; caption?: string }) {
  const id = useId().replace(/:/g, '');
  if (sdiceSkin) return <figure className="docs-flow sdice-docs-flow">
    <ol aria-label={caption}>{labels.map((label, i) => <li key={i}>
      <span aria-hidden="true">0{i + 1}</span><strong>{label}</strong>
    </li>)}</ol>
    <figcaption>{caption}</figcaption>
  </figure>;
  return <figure className="docs-flow"><svg viewBox="0 0 600 140" role="img" aria-labelledby={id}>
    <title id={id}>{caption}</title>
    <defs><linearGradient id={`${id}-fill`} x2="0" y2="1"><stop stopColor="#caff52" stopOpacity=".65"/><stop offset="1" stopColor="#48dbaa" stopOpacity=".12"/></linearGradient></defs>
    <path className="docs-flow-pipe" d="M116 55H250M350 55H484"/>
    <path className="docs-flow-current" d="M116 55H250M350 55H484"/>
    {[70, 300, 530].map((x, i) => <g key={x}>
      <path d={`M${x-35} 26v52q0 15 15 15h40q15 0 15-15V26`} fill="#0c1912" stroke="#7ecb94" strokeWidth="1.5"/>
      <path d={`M${x-32} 57q16-9 32 0t32 0v20q0 12-12 12h-40q-12 0-12-12Z`} fill={`url(#${id}-fill)`}/>
      <path d={`M${x-39} 25h78`} stroke="#b9ed80" strokeWidth="2"/>
      <circle className="docs-flow-bubble" style={{ animationDelay: `${-i * .7}s` }} cx={x-16} cy="77" r="3" fill="#d7ff6c"/>
      <circle className="docs-flow-bubble" style={{ animationDelay: `${-i * .7-1}s` }} cx={x+15} cy="73" r="2" fill="#8bf1c9"/>
      <text x={x} y="123" textAnchor="middle" fill="#dfedcf" fontSize="13" fontWeight="600">{labels[i]}</text>
    </g>)}
    <text x="300" y="68" textAnchor="middle" fill="#e8ffaf" fontSize="27">↗</text>
    <path d="m521 59 7 8 13-20" fill="none" stroke="#daff8b" strokeWidth="3"/>
    <image href={appPath("/acidpump.svg")} x="49" y="42" width="42" height="40"/>
  </svg><figcaption>{caption}</figcaption></figure>;
}
