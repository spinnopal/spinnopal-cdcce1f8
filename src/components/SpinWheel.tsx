import { useEffect, useRef, useState } from "react";
import { PRIZES, LOGO, type Prize } from "@/lib/spin-store";

interface Props {
  spinning: boolean;
  targetIndex: number | null;
  onComplete: (prize: Prize) => void;
  onLogoLongPress?: () => void;
}

const SEG = 360 / PRIZES.length; // 72°

export function SpinWheel({ spinning, targetIndex, onComplete, onLogoLongPress }: Props) {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    if (spinning && targetIndex !== null) {
      // Segment i is centered at angle (i*SEG + SEG/2) measured clockwise from top.
      // Pointer is at top (0°). To land on segment center, wheel rotation must satisfy:
      //   (rotation + segmentCenter) mod 360 === 0  (so segment center sits under pointer)
      // => rotation = -segmentCenter mod 360
      const center = targetIndex * SEG + SEG / 2;
      const base = ((360 - center) % 360 + 360) % 360;
      const turns = 6; // full rotations
      const current = rotationRef.current;
      // next absolute rotation: current rounded up to next full + turns*360 + base offset
      const currentMod = ((current % 360) + 360) % 360;
      const delta = ((base - currentMod) + 360) % 360;
      const next = current + turns * 360 + delta;
      rotationRef.current = next;
      setRotation(next);
      const t = window.setTimeout(() => onComplete(PRIZES[targetIndex]), 5200);
      return () => clearTimeout(t);
    }
  }, [spinning, targetIndex, onComplete]);

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
      {/* Metallic outer ring */}
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
                {PRIZES.map((prize, i) => {
                  const centerAngle = i * SEG;
                  const iconR = r * 0.62;
                  const ix = cx + iconR * Math.cos((centerAngle - 90) * Math.PI / 180);
                  const iy = cy + iconR * Math.sin((centerAngle - 90) * Math.PI / 180);
                  return (
                    <clipPath key={prize.id} id={`clip-${prize.id}`}>
                      <circle cx={ix} cy={iy} r={28} />
                    </clipPath>
                  );
                })}
              </defs>
              {PRIZES.map((prize, i) => {
                const centerAngle = i * SEG; // 0 at top
                const a1 = (centerAngle - SEG / 2 - 90) * Math.PI / 180;
                const a2 = (centerAngle + SEG / 2 - 90) * Math.PI / 180;
                const x1 = cx + r * Math.cos(a1);
                const y1 = cy + r * Math.sin(a1);
                const x2 = cx + r * Math.cos(a2);
                const y2 = cy + r * Math.sin(a2);
                const fill = i % 2 === 0 ? "#1f242e" : "#FF7A00";
                const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
                const iconR = r * 0.62;
                const ix = cx + iconR * Math.cos((centerAngle - 90) * Math.PI / 180);
                const iy = cy + iconR * Math.sin((centerAngle - 90) * Math.PI / 180);
                const textR = r * 0.88;
                const tx = cx + textR * Math.cos((centerAngle - 90) * Math.PI / 180);
                const ty = cy + textR * Math.sin((centerAngle - 90) * Math.PI / 180);
                return (
                  <g key={prize.id}>
                    <path d={path} fill={fill} stroke="#0F1115" strokeWidth="2" />
                    <circle cx={ix} cy={iy} r={28} fill="#0F1115" stroke="#F5C542" strokeWidth="1.5" />
                    <image
                      href={prize.image}
                      x={ix - 28}
                      y={iy - 28}
                      width="56"
                      height="56"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip-${prize.id})`}
                      transform={`rotate(${centerAngle} ${ix} ${iy})`}
                    />
                    <text
                      x={tx}
                      y={ty}
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="700"
                      textAnchor="middle"
                      transform={`rotate(${centerAngle} ${tx} ${ty})`}
                    >
                      {prize.short}
                    </text>
                  </g>
                );
              })}
              {/* inner ring */}
              <circle cx={cx} cy={cy} r={r * 0.22} fill="#0F1115" stroke="#F5C542" strokeWidth="2" />
            </svg>

            {/* Center logo hub */}
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

      {/* Gold pointer */}
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
