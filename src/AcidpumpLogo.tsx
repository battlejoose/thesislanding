import { appPath, sdiceSkin, thesisSkin } from "./app-url.ts";
export function AcidpumpLogo() {
  return (
    <img
      className="acidpump-mark"
      src={appPath(thesisSkin ? '/thesis-brand/mark.png' : sdiceSkin ? "/sdice/logo.png" : "/acidpump.svg")}
      alt=""
      aria-hidden="true"
    />
  );
}
