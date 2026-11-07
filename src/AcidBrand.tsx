import { appPath, sdiceSkin, thesisSkin } from "./app-url.ts";
import { memo } from "react";
import { AcidpumpLogo } from "./AcidpumpLogo";
import "./acid-brand.css";

/** Compact wordmark: all effects stay behind the letters and inside the header. */
export const AcidBrand = memo(function AcidBrand() {
  if (thesisSkin) return <span className="thesis-brand" role="img" aria-label="Thesis PERPS"><img src={appPath('/thesis-brand/mark.png')} alt=""/><span className="thesis-brand-type"><b><img src={appPath('/thesis-brand/wordmark.png')} alt=""/></b><span>PERPS</span></span></span>;
  if (sdiceSkin) return <span className="sdice-brand" role="img" aria-label="SoltoshiDICE Perps"><img src={appPath("/sdice/logo.png")} alt=""/><b>SoltoshiDICE</b><span>PERPS</span></span>;
  return (
    <span className="acid-wordmark" role="img" aria-label="acidpump.fun">
      <span className="acid-wordmark-symbol" aria-hidden="true">
        <AcidpumpLogo />
      </span>
      <span className="acid-wordmark-type" aria-hidden="true">
        <span className="acid-wordmark-smoke">
          <svg
            className="acid-wordmark-wisp"
            viewBox="0 0 68 44"
            fill="none"
            focusable="false"
          >
            <path d="M19 39C37 28 8 29 17 19C27 8 36 16 29 3" />
            <path d="M40 38C24 30 52 26 45 17C42 12 36 10 41 2" />
          </svg>
          <i />
          <i />
          <i />
          <b />
          <b />
        </span>
        <span className="acid-wordmark-acid">
          <span>a</span>
          <span>c</span>
          <span>i</span>
          <span>d</span>
        </span>
        <span className="acid-wordmark-pump">pump</span>
        <span className="acid-wordmark-domain">.fun</span>
      </span>
    </span>
  );
});
