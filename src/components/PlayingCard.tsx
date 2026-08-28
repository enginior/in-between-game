import type { CSSProperties, ReactElement } from "react";
import type { CardData } from "../game/cards";
import { isRed, rankLabel } from "../game/cards";

interface Props {
  card: CardData;
  faceUp: boolean;
  dealFrom?: { x: number; y: number } | null;
  glow?: "win" | "lose" | null;
}

const RED = "#b3122e";
const INK = "#1c2233";

export default function PlayingCard({ card, faceUp, dealFrom, glow }: Props): ReactElement {
  const style = dealFrom
    ? ({ "--dx": `${dealFrom.x}px`, "--dy": `${dealFrom.y}px` } as CSSProperties)
    : undefined;
  const red = isRed(card.suit);
  const color = red ? RED : INK;
  const court = card.rank >= 11 && card.rank <= 13;
  const ace = card.rank === 14;

  return (
    <div
      className={`card3d ${dealFrom ? "deal-in" : ""} ${glow === "win" ? "win-glow" : ""} ${
        glow === "lose" ? "lose-dim" : ""
      }`}
      style={style}
    >
      <div className={`card-inner ${faceUp ? "face-up" : ""}`}>
        {/* back */}
        <div className="card-face card-back-face">
          <div className="card-lattice" />
        </div>
        {/* front */}
        <div className="card-face card-front">
          <div className="absolute inset-0 flex flex-col justify-between p-[6%]">
            <Corner card={card} color={color} />
            <div className="grid flex-1 place-items-center">
              {court ? (
                <div
                  className="relative grid place-items-center rounded-md border-2 px-[16%] py-[9%]"
                  style={{ borderColor: color }}
                >
                  <div
                    className="absolute inset-[3px] rounded border"
                    style={{ borderColor: color, opacity: 0.45 }}
                  />
                  <span
                    className="font-display font-black leading-none"
                    style={{ color, fontSize: "clamp(18px,4vmin,34px)" }}
                  >
                    {rankLabel(card.rank)}
                  </span>
                  <span style={{ color, fontSize: "clamp(11px,2.2vmin,17px)" }}>{card.suit}</span>
                </div>
              ) : (
                <span
                  className="leading-none"
                  style={{
                    color,
                    fontSize: ace ? "clamp(30px,7vmin,60px)" : "clamp(24px,5.5vmin,46px)",
                    textShadow: red
                      ? "0 0 16px rgba(179,18,46,.28)"
                      : "0 0 16px rgba(28,34,51,.22)",
                  }}
                >
                  {card.suit}
                </span>
              )}
            </div>
            <Corner card={card} color={color} rotate />
          </div>
        </div>
      </div>
    </div>
  );
}

function Corner({ card, color, rotate }: { card: CardData; color: string; rotate?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center leading-none ${
        rotate ? "rotate-180 self-end" : "self-start"
      }`}
    >
      <span
        className="font-display font-bold"
        style={{ color, fontSize: "clamp(10px,2vmin,16px)" }}
      >
        {rankLabel(card.rank)}
      </span>
      <span style={{ color, fontSize: "clamp(9px,1.8vmin,14px)" }}>{card.suit}</span>
    </div>
  );
}
