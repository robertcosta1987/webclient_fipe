// Plate.tsx — renders a Brazilian license plate as a small realistic badge,
// choosing the look from the plate FORMAT:
//
//   Old / Classic  LLL-NNNN  (3 letters, 4 digits) → gray plate, "UF-CIDADE"
//                                                     header, black chars, dot
//                                                     separator (FBI·5551).
//   Mercosul       LLLNLNN   (letter in the 5th slot) → white plate, blue
//                                                     "BRASIL" strip + flag.
//
// Detection reuses the canonical regexes in lib/placa/normalize. Anything that
// isn't clearly old falls back to the Mercosul look (the current standard).

import { PLATE_OLD, PLATE_MERCOSUL, normalizePlaca } from "@/lib/placa/normalize";

type Size = "sm" | "md" | "lg";

export function Plate({
  placa,
  size = "md",
  className = "",
}: {
  placa: string | null | undefined;
  size?: Size;
  className?: string;
}) {
  const raw = (placa ?? "").toString();
  const norm = normalizePlaca(raw);
  const isOld = PLATE_OLD.test(norm);
  const isMercosul = PLATE_MERCOSUL.test(norm);

  // Nothing usable → plain fallback, no fake plate.
  if (!norm) return <span className={className}>—</span>;

  if (isOld) {
    const num = `${norm.slice(0, 3)}·${norm.slice(3)}`; // ABC·1234
    return (
      <span
        className={`plate plate--old plate--${size} ${className}`}
        title={raw}
        aria-label={`Placa modelo antigo ${norm}`}
      >
        <span className="plate-screw plate-screw--l" aria-hidden />
        <span className="plate-screw plate-screw--r" aria-hidden />
        <span className="plate-old-head">UF-CIDADE</span>
        <span className="plate-old-num">{num}</span>
      </span>
    );
  }

  // Mercosul (and fallback for anything not matching the old format).
  return (
    <span
      className={`plate plate--mer plate--${size} ${className}`}
      title={raw}
      aria-label={`Placa Mercosul ${isMercosul ? norm : raw.toUpperCase()}`}
    >
      <span className="plate-mer-head">
        <span className="plate-mer-br">BR</span>
        <span className="plate-mer-title">BRASIL</span>
        <svg className="plate-mer-flag" viewBox="0 0 20 14" aria-hidden>
          <rect width="20" height="14" fill="#0a8a3f" />
          <polygon points="10,1.4 18.6,7 10,12.6 1.4,7" fill="#ffd100" />
          <circle cx="10" cy="7" r="3" fill="#16357e" />
        </svg>
      </span>
      <span className="plate-mer-num">{norm || raw.toUpperCase()}</span>
    </span>
  );
}
