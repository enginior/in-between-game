import type { CSSProperties, ReactElement } from "react";

const CHIP_STYLE: Record<number, { bg: string; label: string }> = {
  5: { bg: "#c0392b", label: "5" },
  25: { bg: "#1e7a52", label: "25" },
  100: { bg: "#23272f", label: "100" },
  500: { bg: "#6d3fc0", label: "500" },
};

export function ChipButton({
  value,
  disabled,
  onClick,
  size = 60,
}: {
  value: number;
  disabled?: boolean;
  onClick?: () => void;
  size?: number;
}): ReactElement {
  const s = CHIP_STYLE[value];
  return (
    <button
      type="button"
      className="chip"
      style={
        {
          width: size,
          height: size,
          fontSize: size * 0.3,
          "--chip-c": s.bg,
        } as CSSProperties
      }
      onClick={onClick}
      disabled={disabled}
      aria-label={`Add $${value} chip`}
    >
      <span className="relative z-10">{s.label}</span>
    </button>
  );
}

/** A chip resting in the bet-spot stack. Only newly added chips animate in. */
export function StackChip({
  value,
  index,
  size = 34,
  fresh,
}: {
  value: number;
  index: number;
  size?: number;
  fresh: boolean;
}): ReactElement {
  const s = CHIP_STYLE[value];
  const top = index * Math.max(5, size * 0.2);
  const rot = ((index * 47) % 13) - 6;
  return (
    <div
      className="absolute bottom-1 left-1/2"
      style={{ transform: `translate(-50%, ${-top}px) rotate(${rot}deg)` }}
    >
      <div
        className={`chip ${fresh ? "chip-drop" : ""}`}
        style={
          {
            width: size,
            height: size,
            fontSize: size * 0.3,
            "--chip-c": s.bg,
          } as CSSProperties
        }
      >
        <span className="relative z-10">{s.label}</span>
      </div>
    </div>
  );
}
