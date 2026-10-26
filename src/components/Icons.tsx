// Minimal stroke icon set (24px grid, currentColor).
import type { SVGProps } from "react";

const base = (d: string | string[]) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        {(Array.isArray(d) ? d : [d]).map((p, i) => (
          <path key={i} d={p} />
        ))}
      </svg>
    );
  };

export const IHome = base(["M3 10.5 12 3l9 7.5", "M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"]);
export const ISearch = base(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"]);
export const IPlay = base(["M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"]);
export const IFlame = base(["M12 22c4.4 0 7-3 7-6.8 0-4.6-3.6-7-4.6-11.2-2.2 1.6-3.4 3.8-3.4 6.2-1.2-.6-2-1.8-2.2-3.4C6.6 8.6 5 11.4 5 15.2 5 19 7.6 22 12 22z"]);
export const IBookmark = base(["M6 3.5h12a.5.5 0 0 1 .5.5v17l-6.5-4.5L5.5 21V4a.5.5 0 0 1 .5-.5z"]);
export const IBook = base(["M4 4.5h5a3 3 0 0 1 3 3V21a2.5 2.5 0 0 0-2.5-2.5H4z", "M20 4.5h-5a3 3 0 0 0-3 3V21a2.5 2.5 0 0 1 2.5-2.5H20z"]);
export const ILayers = base(["M12 3 2 8l10 5 10-5z", "M2 13l10 5 10-5", "M2 18l10 5 10-5"]);
export const IFile = base(["M14 3H6v18h12V7z", "M14 3v4h4", "M9 13h6", "M9 17h6"]);
export const ITimer = base(["M10 2h4", "M12 14l3-3", "M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"]);
export const IZap = base(["M13 2 4 14h7l-1 8 9-12h-7z"]);
export const ITarget = base(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 12h.01"]);
export const IRotate = base(["M3 12a9 9 0 0 1 15.5-6.2L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15.5 6.2L3 16", "M3 21v-5h5"]);
export const ITrophy = base(["M8 21h8", "M12 17v4", "M7 4h10v5a5 5 0 0 1-10 0z", "M17 5h3v2a3 3 0 0 1-3 3", "M7 5H4v2a3 3 0 0 0 3 3"]);
export const IInfo = base(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-5", "M12 8h.01"]);
export const ISun = base(["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 1v2", "M12 21v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M1 12h2", "M21 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4"]);
export const IMoon = base(["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"]);
export const ICheck = base(["M20 6 9 17l-5-5"]);
export const ICheckCircle = base(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M8 12.5l2.7 2.7L16.5 9.5"]);
export const IXCircle = base(["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M15 9l-6 6", "M9 9l6 6"]);
export const IX = base(["M18 6 6 18", "M6 6l12 12"]);
export const IAlert = base(["M12 3 2 21h20z", "M12 10v4", "M12 18h.01"]);
export const IDownload = base(["M12 3v12", "M7 10l5 5 5-5", "M4 21h16"]);
export const IUpload = base(["M12 21V9", "M7 14l5-5 5 5", "M4 3h16"]);
export const IFlag = base(["M5 21V4", "M5 4h11l-2 4 2 4H5"]);
export const IChevronL = base(["M15 18l-6-6 6-6"]);
export const IChevronR = base(["M9 18l6-6-6-6"]);
export const IChevronD = base(["M6 9l6 6 6-6"]);
export const IArrowL = base(["M19 12H5", "M12 19l-7-7 7-7"]);
export const IFilter = base(["M3 5h18", "M6 12h12", "M10 19h4"]);
export const IGrid = base(["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"]);
export const ICalendar = base(["M4 5h16v16H4z", "M4 10h16", "M9 3v4", "M15 3v4"]);
export const ITrash = base(["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"]);
export const ILang = base(["M4 5h8", "M8 3v2", "M10 5c0 4-3 7-6 8", "M6 9c1 2 3 3.5 5 4", "M13 21l4-9 4 9", "M14.5 18h5"]);
