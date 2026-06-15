import { useEffect, useRef, useState } from "react";
import { LOGO, type Prize } from "@/lib/spin-store";
import { startSpinTicks, playWin, playLose } from "@/lib/sounds";

interface Props {
  prizes: Prize[];
  spinning: boolean;
  targetIndex: number | null;
  onComplete: (prize: Prize) => void;
  onLogoLongPress?: () => void;
}

export function SpinWheel({ prizes, spinning, targetIndex, onComplete, onLogoLongPress }: Props) {
  const SEG = prizes.length > 0 ? 360 / prizes.length : 360;
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const pressTimer = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const startedRef = useRef(false);
  const ticksCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (spinning && targetIndex !== null && !startedRef.current && prizes.length > 0) {
      startedRef.current = true;
      const center = targetIndex * SEG;
      const base = ((360 - center) % 360 + 360) % 360;
      const turns = 6;
      const current = rotationRef.current;
      const currentMod = ((current % 360) + 360) % 360;
      const delta = ((base - currentMod) + 360) % 360;
      const next = current + turns * 360 + delta;
      rotationRef.current = next;
      setRotation(next);
      ticksCancelRef.current = startSpinTicks(5200);
      const t = window.setTimeout(() => {
        const prize = prizes[targetIndex];
        if (prize) {
          if (prize.isWin) playWin(); else playLose();
          onCompleteRef.current(prize);
        }
      }, 5200);
      return () => {
        clearTimeout(t);
        ticksCancelRef.current?.();
        ticksCancelRef.current = null;
      };
    }
    if (!spinning) startedRef.current = false;
  }, [spinning, targetIndex, prizes, SEG]);

  const startPress = () => {
    if (!onLogoLongPress) return;
    pressTimer.current = window.setTimeout(() => onLogoLongPress(), 5000);
  };
  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const size = 360;
  const r = size / 2;
  const cx = r, cy = r;

  return (
    <div className="relative w-full aspect-square">
      <div className="absolute inset-0 rounded-full metallic-ring p-[3%] glow-orange">
        <div className="w-full h-full rounded-full bg-[#0F1115] p-[2%]">
          <div className="w-full h-full rounded-full relative overflow-hidden"
               style={{ background: "radial-gradient(circle, #2a2f3a 0%, #14171d 70%)" }}>
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? "transform 5.2s cubic-bezier(0.16, 1, 0.3, 1)"
                  : "none",
              }}
            >
              <defs>
                {prizes.map((prize, i) => {
                  const centerAngle = i * SEG;
                  const iconR = r * 0.6;
                  const ix = cx + iconR * Math.cos((centerAngle - 90) * Math.PI / 180);
                  const iy = cy + iconR * Math.sin((centerAngle - 90) * Math.PI / 180);
                  return (
                    <clipPath key={prize.id} id={`clip-${prize.id}`}>
                      <circle cx={ix} cy={iy} r={44} />
                    </clipPath>
                  );
                })}
              </defs>
              {prizes.map((prize, i) => {
                const centerAngle = i * SEG;
                const a1 = (centerAngle - SEG / 2 - 90) * Math.PI / 180;
                const a2 = (centerAngle + SEG / 2 - 90) * Math.PI / 180;
                const x1 = cx + r * Math.cos(a1);
                const y1 = cy + r * Math.sin(a1);
                const x2 = cx + r * Math.cos(a2);
                const y2 = cy + r * Math.sin(a2);
                const fill = i % 2 === 0 ? "#1f242e" : "#FF7A00";
                const largeArc = SEG > 180 ? 1 : 0;
                const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                const iconR = r * 0.6;
                const ix = cx + iconR * Math.cos((centerAngle - 90) * Math.PI / 180);
                const iy = cy + iconR * Math.sin((centerAngle - 90) * Math.PI / 180);
                const textR = r * 0.9;
                const tx = cx + textR * Math.cos((centerAngle - 90) * Math.PI / 180);
                const ty = cy + textR * Math.sin((centerAngle - 90) * Math.PI / 180);
                return (
                  <g key={prize.id}>
                    <path d={path} fill={fill} stroke="#0F1115" strokeWidth="2" />
                    <circle cx={ix} cy={iy} r={44} fill="#0F1115" stroke="#F5C542" strokeWidth="2" />
                    <image
                      href={prize.image}
                      x={ix - 44}
                      y={iy - 44}
                      width="88"
                      height="88"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip-${prize.id})`}
                      transform={`rotate(${centerAngle} ${ix} ${iy})`}
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill="#FFFFFF"
                      fontSize="12"
                      fontWeight="800"
                      textAnchor="middle"
                      transform={`rotate(${centerAngle} ${tx} ${ty})`}
                    >
                      {prize.short}
                    </text>
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r={r * 0.22} fill="#0F1115" stroke="#F5C542" strokeWidth="2" />
            </svg>

            <button
              onPointerDown={startPress}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[22%] h-[22%] rounded-full overflow-hidden border-2 border-[var(--gold)] glow-gold bg-[#0F1115]"
              aria-label="Mas Mobile Zone"
            >
              <img src={LOGO} alt="Mas Mobile Zone" className="w-full h-full object-cover" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-10 drop-shadow-[0_4px_10px_rgba(245,197,66,0.6)]">
        <svg width="44" height="56" viewBox="0 0 44 56">
          <defs>
            <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FCE38A" />
              <stop offset="50%" stopColor="#F5C542" />
              <stop offset="100%" stopColor="#A8800A" />
            </linearGradient>
          </defs>
          <path d="M22 54 L4 12 Q22 0 40 12 Z" fill="url(#gp)" stroke="#5a4106" strokeWidth="1.5" />
          <circle cx="22" cy="14" r="4" fill="#0F1115" />
        </svg>
      </div>
    </div>
  );
}
