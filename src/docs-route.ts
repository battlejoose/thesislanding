import { appPath, sdiceSkin, thesisSkin } from './app-url.ts';

const LEGACY_INTRO = 'intro/what-is-acidpump';
export const FIRST_DOC_PAGE = thesisSkin ? 'intro/what-is-thesis-perps' : sdiceSkin ? 'intro/what-is-sdicePERPS' : LEGACY_INTRO;

// Keep existing bookmarks working while every SDICE navigation link uses its brand.
export const canonicalDocsId = (id: string) => sdiceSkin && (id === LEGACY_INTRO || thesisSkin && id === 'intro/what-is-sdicePERPS') ? FIRST_DOC_PAGE : id;
export const docsHref = (id = FIRST_DOC_PAGE) => appPath(`/docs#/${canonicalDocsId(id)}`);
