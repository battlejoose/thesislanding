import { memo, useId } from "react";

/** The trading controls are soft acid membranes; the label stays still. */
export const AcidTradeSkin = memo(function AcidTradeSkin({ long }: { long: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className="acid-trade-skin"
      viewBox="0 0 240 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-gel`} x1="0" y1="0" x2=".4" y2="1">
          <stop stopColor={long ? "#e7ffab" : "#defeec"} />
          <stop offset=".5" stopColor={long ? "#c7ff3f" : "#99edcb"} />
          <stop offset="1" stopColor={long ? "#a5dd18" : "#62cda9"} />
        </linearGradient>
      </defs>
      <path
        className="acid-trade-body"
        d="M21 4C51 1 60 6 83 4S133 2 155 4S195 2 219 4C232 5 237 12 237 23L237 41C237 54 230 59 217 59C191 59 177 57 154 60S111 58 88 60S53 57 22 60C8 61 3 53 3 41V23C3 11 8 5 21 4Z"
        fill={`url(#${id}-gel)`}
      />
      <path
        className="acid-trade-highlight"
        d="M19 9C48 6 62 10 86 8S132 7 157 8S195 6 221 9"
      />
      <path
        className="acid-trade-underflow"
        d="M11 49C36 39 56 57 82 49S119 57 144 49S181 55 207 49S229 54 240 49V70H0V49Z"
      />
      <g className="acid-trade-bubbles">
        <circle cx="18" cy="42" r="3" />
        <circle cx="225" cy="28" r="2.1" />
        <circle cx="211" cy="49" r="1.6" />
      </g>
      <path className="acid-trade-crease" d="M11 24V35M230 33V42" />
    </svg>
  );
});
