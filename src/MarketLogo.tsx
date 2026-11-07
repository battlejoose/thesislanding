/**
 * Market marks, drawn as small inline SVGs on a 32×32 grid (sized by CSS):
 * Bitcoin's tilted ₿ on orange, Ethereum's diamond on blue, Solana's three
 * bars on black, pump.fun's green and white pill; unknown markets get initials.
 * Decorative: the symbol is always written next to it.
 */
import { useId } from "react";

export function MarketLogo({
  symbol,
  className = "",
}: {
  symbol: string;
  className?: string;
}) {
  const gid = `sv-sol-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const cls = `sv-logo ${className}`.trim();
  switch (symbol.toUpperCase()) {
    case "PUMP":
      return (
        <svg className={cls} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#163c2f" />
          <g transform="rotate(-45 16 16)">
            <rect x="5" y="10" width="22" height="12" rx="6" fill="#fff" />
            <path d="M16 10h5a6 6 0 0 1 0 12h-5z" fill="#5bdc9b" />
            <rect
              x="5"
              y="10"
              width="22"
              height="12"
              rx="6"
              fill="none"
              stroke="#10271e"
              strokeWidth="1.5"
            />
          </g>
        </svg>
      );
    case "USDC":
      return (
        <svg className={cls} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#2775ca" />
          <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
            <path d="M19.5 11.5c-1.4-2.1-7-2-7 1.2s7 2.3 7 5.7-5.7 3.6-7.3 1.2M16 8v2m0 12v2M10 7.7a10.3 10.3 0 0 0 0 16.6M22 7.7a10.3 10.3 0 0 1 0 16.6" />
          </g>
        </svg>
      );
    case "BTC":
      return (
        <svg className={cls} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#f7931a" />
          <g
            transform="rotate(14 16 16)"
            fill="none"
            stroke="#fff"
            strokeWidth="2.3"
            strokeLinejoin="round"
          >
            <path d="M12.6 9.4v13.2M11.2 9.6h5.9a3.1 3.1 0 0 1 0 6.2h-4.5m-1.4 6.6h6.7a3.3 3.3 0 0 0 0-6.6h-5.3" />
            <path
              d="M14.4 7.2v2.4m2.7-2.4v2.4m-2.7 12.8v2.4m2.7-2.4v2.4"
              strokeLinecap="round"
            />
          </g>
        </svg>
      );
    case "ETH":
      return (
        <svg className={cls} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#627eea" />
          <g fill="#fff">
            <path d="M16 5v8.2l-6.9 3.1z" />
            <path d="M16 5l6.9 11.3-6.9-3.1z" fillOpacity=".6" />
            <path d="M16 13.2v7.2l-6.9-4.1z" fillOpacity=".6" />
            <path d="M16 13.2l6.9 3.1-6.9 4.1z" fillOpacity=".25" />
            <path d="M16 21.8V27l-6.9-9.7z" />
            <path d="M16 21.8l6.9-4.5L16 27z" fillOpacity=".6" />
          </g>
        </svg>
      );
    case "XRP":
      return (
        <svg className={cls} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#23292f" />
          <path
            d="M8 8l4.2 4.2a5.4 5.4 0 0 0 7.6 0L24 8M8 24l4.2-4.2a5.4 5.4 0 0 1 7.6 0L24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
          />
        </svg>
      );
    case "ZEC":
      return (
        <svg className={cls} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#f4b728" />
          <path
            d="M10 10h12L10 22h12M16 6v4m0 12v4"
            fill="none"
            stroke="#151515"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "SOL":
      return (
        <svg className={cls} viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient
              id={gid}
              x1="23"
              y1="25"
              x2="11"
              y2="7"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#14f195" />
              <stop offset="1" stopColor="#9945ff" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="#101014" />
          <path
            fill={`url(#${gid})`}
            d="M10.8 9.6H24l-2.8 2.9H8zm0 9.9H24l-2.8 2.9H8zM8 14.6h13.2l2.8 2.9H10.8z"
          />
        </svg>
      );
  }
  const text = symbol.slice(0, 3).toUpperCase();
  return (
    <svg className={`${cls} sv-logo-x`} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#655590" />
      <text
        x="16"
        y="16.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={text.length > 2 ? 10 : 13}
        fill="#eee7ff"
      >
        {text}
      </text>
    </svg>
  );
}
