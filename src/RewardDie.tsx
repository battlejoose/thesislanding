/** Inline vector art stays sharp in both sizes and needs no image request. */
export function RewardDie({ id }: { id: string }) {
  return <g className="reward-beaker-dice">
    <defs>
      <linearGradient id={`${id}-die`} x1="13" y1="49" x2="26" y2="71" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--dice-face)"/><stop offset="1" stopColor="var(--dice-deep)"/>
      </linearGradient>
      <linearGradient id={`${id}-die-top`} x1="20" y1="42" x2="31" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--dice-light)"/><stop offset="1" stopColor="var(--dice-face)"/>
      </linearGradient>
    </defs>
    <ellipse cx="26" cy="70" rx="12" ry="2" fill="var(--dice-deep)" opacity=".35"/>
    <g stroke="var(--dice-edge)" strokeWidth=".85" strokeLinejoin="round">
      <path d="M13 49 26 42 39 49 26 56Z" fill={`url(#${id}-die-top)`}/>
      <path d="M13 49 26 56V71L13 64Z" fill={`url(#${id}-die)`}/>
      <path d="M26 56 39 49V64L26 71Z" fill="var(--dice-deep)"/>
    </g>
    <path d="M14 49 26 43 38 49M26 56V69" stroke="var(--dice-light)" strokeWidth=".8" strokeLinecap="round" opacity=".8"/>
    <g fill="#f4ffff">
      <ellipse cx="26" cy="49" rx="2" ry="1.15"/>
      <ellipse cx="17" cy="55" rx="1.25" ry="1.65" transform="rotate(-28 17 55)"/>
      <ellipse cx="19.5" cy="60" rx="1.25" ry="1.65" transform="rotate(-28 19.5 60)"/>
      <ellipse cx="22" cy="65" rx="1.25" ry="1.65" transform="rotate(-28 22 65)"/>
      <ellipse cx="30" cy="58" rx="1.25" ry="1.65" transform="rotate(28 30 58)"/>
      <ellipse cx="35" cy="55.5" rx="1.25" ry="1.65" transform="rotate(28 35 55.5)"/>
      <ellipse cx="30" cy="65" rx="1.25" ry="1.65" transform="rotate(28 30 65)"/>
      <ellipse cx="35" cy="62.5" rx="1.25" ry="1.65" transform="rotate(28 35 62.5)"/>
    </g>
    <path d="m16 39 .9 2.7 2.6.8-2.6.8-.9 2.7-.8-2.7-2.7-.8 2.7-.8Z" fill="var(--dice-light)"/>
  </g>;
}
