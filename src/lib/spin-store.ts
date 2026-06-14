import logoAsset from "@/assets/logo.png.asset.json";
import cableAsset from "@/assets/cable2.png.asset.json";
import earphonesAsset from "@/assets/earphones2.png.asset.json";
import ultimaAsset from "@/assets/ultima.png.asset.json";
import kickAsset from "@/assets/kick.png.asset.json";
import cash2000Asset from "@/assets/cash2000.png.asset.json";
import cash1000Asset from "@/assets/cash1000.png.asset.json";
import tryagainAsset from "@/assets/tryagain2.png.asset.json";
import cash100Asset from "@/assets/cash100b.png.asset.json";

export const LOGO = logoAsset.url;

export type PrizeId =
  | "cable"
  | "earphones"
  | "ultima"
  | "kick"
  | "cash2000"
  | "cash1000"
  | "try-again"
  | "cash100";

export interface Prize {
  id: PrizeId;
  name: string;
  short: string;
  image: string;
  isWin: boolean;
}

// Order matters: visual order on the wheel (clockwise from top).
export const PRIZES: Prize[] = [
  { id: "cable", name: "Data Cable", short: "Data Cable", image: cableAsset.url, isWin: true },
  { id: "earphones", name: "Strong Bass Earphones", short: "Bass Earphones", image: earphonesAsset.url, isWin: true },
  { id: "ultima", name: "Ultima Circle Smartwatch", short: "Ultima Watch", image: ultimaAsset.url, isWin: true },
  { id: "kick", name: "KICK AirBuds", short: "Kick AirBuds", image: kickAsset.url, isWin: true },
  { id: "cash2000", name: "Rs. 2000 Cash Back", short: "Rs.2000 Cash", image: cash2000Asset.url, isWin: true },
  { id: "cash1000", name: "Rs. 1000 Cash Back", short: "Rs.1000 Cash", image: cash1000Asset.url, isWin: true },
  { id: "try-again", name: "Try Again", short: "Try Again", image: tryagainAsset.url, isWin: false },
  { id: "cash100", name: "Rs. 100 Cash Back", short: "Rs.100 Cash", image: cash100Asset.url, isWin: true },
];

const DEFAULT_PROBS: Record<PrizeId, number> = {
  cable: 25,
  earphones: 25,
  ultima: 25,
  kick: 0,
  cash2000: 0,
  cash1000: 0,
  "try-again": 25,
  cash100: 25,
};

const PROBS_KEY = "mmz_probs_v3";
const RECORDS_KEY = "mmz_records_v1";

export function getProbs(): Record<PrizeId, number> {
  try {
    const raw = localStorage.getItem(PROBS_KEY);
    if (raw) return { ...DEFAULT_PROBS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PROBS };
}

export function setProbs(p: Record<PrizeId, number>) {
  localStorage.setItem(PROBS_KEY, JSON.stringify(p));
}

export function pickWinner(excludeIds: PrizeId[] = []): Prize {
  const probs = getProbs();
  const pool = PRIZES.filter((p) => !excludeIds.includes(p.id) && (probs[p.id] || 0) > 0);
  const candidates = pool.length > 0 ? pool : PRIZES.filter((p) => !excludeIds.includes(p.id));
  if (candidates.length === 0) return PRIZES[0];
  const total = candidates.reduce((s, p) => s + (probs[p.id] || 1), 0) || 1;
  let r = Math.random() * total;
  for (const prize of candidates) {
    r -= probs[prize.id] || 1;
    if (r <= 0) return prize;
  }
  return candidates[0];
}

export interface SpinRecord {
  id: string;
  name: string;
  prizeId: PrizeId;
  prizeName: string;
  isWin: boolean;
  timestamp: number;
}

export function getRecords(): SpinRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecord(r: Omit<SpinRecord, "id" | "timestamp">) {
  const all = getRecords();
  const rec: SpinRecord = { ...r, id: crypto.randomUUID(), timestamp: Date.now() };
  all.unshift(rec);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
  return rec;
}

export function deleteRecord(id: string) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(getRecords().filter((r) => r.id !== id)));
}

export function resetCampaign() {
  localStorage.removeItem(RECORDS_KEY);
}

export function exportCsv(): string {
  const rows = [["Name", "Prize", "Result", "Date", "Time"]];
  for (const r of getRecords()) {
    const d = new Date(r.timestamp);
    rows.push([
      r.name.replace(/"/g, '""'),
      r.prizeName,
      r.isWin ? "Win" : "Try Again",
      d.toLocaleDateString(),
      d.toLocaleTimeString(),
    ]);
  }
  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
}
