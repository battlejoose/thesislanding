export type SettlementIconKind = "bag" | "wallet" | "swap" | "pool" | "stakers" | "burn" | "ownership" | "queue" | "payout";

/** Small silhouettes for the settlement journey; each animated part has its own class. */
export function SettlementIcon({ kind, size = 36, className = "" }: {
  kind: SettlementIconKind; size?: number | string; className?: string;
}) {
  return <svg className={`settlement-icon settlement-icon--${kind} ${className}`} width={size} height={size}
    viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    {kind === "bag" && <>
      <path className="settlement-icon__body" fill="currentColor" fillOpacity=".1" d="m17 15-4-8 7 2 4-4 4 4 7-2-4 8c2 5 10 10 10 18 0 8-8 11-17 11S7 41 7 33c0-8 8-13 10-18Z"/>
      <path d="M17 15h14M16 19h16"/>
      <g className="settlement-icon__coin"><circle cx="24" cy="31" r="7" fill="currentColor" fillOpacity=".16"/><path d="M27 28h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-4m3-10v12" strokeWidth="1.6"/></g>
    </>}
    {kind === "wallet" && <>
      <path className="settlement-icon__body" fill="currentColor" fillOpacity=".1" d="M7 20V16c0-2 1-3 3-4l19-5v13h10v20H10a3 3 0 0 1-3-3V20Z"/>
      <path d="M7 20h32M11 16l14-4M40 27H30a4 4 0 0 0 0 8h10Z" fill="currentColor" fillOpacity=".16"/>
      <circle cx="31" cy="31" r="1" fill="currentColor" stroke="none"/>
      <g className="settlement-icon__coin"><circle cx="37" cy="10" r="7" fill="currentColor" fillOpacity=".15"/><path d="M34 10h6m-3-3v6" strokeWidth="1.7"/></g>
    </>}
    {kind === "swap" && <>
      <g className="settlement-icon__orbit"><path d="M8 22A16 16 0 0 1 36 12l4 5M40 8v9h-9M40 26A16 16 0 0 1 12 36l-4-5M8 40v-9h9" strokeWidth="2.6"/></g>
      <path className="settlement-icon__liquid" fill="currentColor" fillOpacity=".35" d="M24 14c-2 4-7 9-7 13a7 7 0 0 0 14 0c0-4-5-9-7-13Z"/>
      <path d="M20 27c0 2 1 3 3 3" strokeOpacity=".7"/>
    </>}
    {kind === "pool" && <>
      <path className="settlement-icon__body" fill="currentColor" fillOpacity=".08" d="M5 24h38c-1 12-8 19-19 19S6 36 5 24Z"/>
      <path className="settlement-icon__liquid" fill="currentColor" fillOpacity=".3" d="M7 27c6-6 11 6 17 0s11 6 17 0c-2 10-8 16-17 16S9 37 7 27Z" stroke="none"/>
      <path className="settlement-icon__wave" d="M7 27c6-6 11 6 17 0s11 6 17 0M3 24h42"/>
      <path className="settlement-icon__drop" fill="currentColor" fillOpacity=".6" d="M24 3c-1 3-5 7-5 10a5 5 0 0 0 10 0c0-3-4-7-5-10Z"/>
      <circle className="settlement-icon__bubble" cx="13" cy="16" r="2" strokeOpacity=".65"/>
      <circle className="settlement-icon__bubble" cx="35" cy="18" r="1.5" strokeOpacity=".65"/>
    </>}
    {kind === "stakers" && <>
      <g className="settlement-icon__people" fill="currentColor" fillOpacity=".12">
        <circle cx="24" cy="9" r="5"/><circle cx="10" cy="15" r="4"/><circle cx="38" cy="15" r="4"/>
        <path d="M16 27v-3a8 8 0 0 1 16 0v3M3 31v-3a7 7 0 0 1 11-6M45 31v-3a7 7 0 0 0-11-6"/>
      </g>
      <g className="settlement-icon__coin">
        <ellipse cx="24" cy="32" rx="10" ry="3.5" fill="currentColor" fillOpacity=".2"/>
        <path d="M14 32v5c0 2 4 3.5 10 3.5S34 39 34 37v-5M14 37v4c0 2 4 3.5 10 3.5S34 43 34 41v-4"/>
      </g>
    </>}
    {kind === "burn" && <>
      <path className="settlement-icon__flame" fill="currentColor" fillOpacity=".15" d="M27 3c2 12-9 14-7 22 4-2 6-5 7-9 7 6 14 12 12 19-2 7-8 10-15 10S9 40 9 32c0-7 5-11 7-16 0 5 1 7 3 8C14 15 22 13 27 3Z"/>
      <path className="settlement-icon__ember" fill="currentColor" fillOpacity=".7" stroke="none" d="M26 28c1 5 6 7 5 11-1 3-4 5-7 5s-6-2-6-5c0-4 5-5 8-11Z"/>
      <path className="settlement-icon__spark" d="m8 12-2-3m32 8 3-4" strokeOpacity=".65"/>
    </>}
    {kind === "ownership" && <>
      <path className="settlement-icon__ribbon" fill="currentColor" fillOpacity=".15" d="m14 30-4 14 9-4 5 5 5-5 9 4-4-14"/>
      <circle className="settlement-icon__coin" cx="24" cy="21" r="16" fill="currentColor" fillOpacity=".13"/>
      <circle cx="24" cy="21" r="11" strokeOpacity=".45"/>
      <path className="settlement-icon__seal" d="m18 21 4 4 8-9" strokeWidth="2.8"/>
      <path d="m39 5 1-3 1 3 3 1-3 1-1 3-1-3-3-1Z" fill="currentColor" stroke="none"/>
    </>}
    {kind === "queue" && <>
      <path className="settlement-icon__body" d="M12 5h24M12 43h24M15 5v8c0 5 4 7 9 11-5 4-9 6-9 11v8m18-38v8c0 5-4 7-9 11 5 4 9 6 9 11v8"/>
      <path className="settlement-icon__liquid" fill="currentColor" fillOpacity=".25" stroke="none" d="M17 12h14c0 5-3 7-7 10-4-3-7-5-7-10ZM17 41c0-5 3-7 7-10 4 3 7 5 7 10Z"/>
      <path className="settlement-icon__drop" d="M24 25v3" strokeWidth="2.8"/>
    </>}
    {kind === "payout" && <>
      <g className="settlement-icon__coin">
        <circle cx="24" cy="24" r="19" fill="currentColor" fillOpacity=".14"/>
        <circle cx="24" cy="24" r="14" strokeOpacity=".35"/>
        <path d="M30 16h-9a5 5 0 0 0 0 10h6a5 5 0 0 1 0 10h-9m6-24v28" strokeWidth="2.4"/>
      </g>
    </>}
  </svg>;
}
