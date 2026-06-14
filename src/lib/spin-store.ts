import logoAsset from "@/assets/logo.png.asset.json";
import tryagainAsset from "@/assets/tryagain.jpg.asset.json";
import aeropodsAsset from "@/assets/aeropods.png.asset.json";
import zeblazeAsset from "@/assets/zeblaze.png.asset.json";
import earphonesAsset from "@/assets/earphones.png.asset.json";
import cableAsset from "@/assets/cable.png.asset.json";
import cash100Asset from "@/assets/cash100.jpg.asset.json";

export const LOGO = logoAsset.url;

export type PrizeId = "try-again" | "cable" | "earphones" | "cash100" | "aeropods" | "zeblaze";

export interface Prize {
  id: PrizeId;
  name: string;
  short: string;
  image: string;
  isWin: boolean;
}

// Order matters: this is the visual order on the wheel (clockwise from top).
export const PRIZES: Prize[] = [
  { id: "try-again", name: "Try Again", short: "Try Again", image: tryagainAsset.url, isWin: false },
  { id: "cable", name: "My Power Charging Cable", short: "Charging Cable", image: cableAsset.url, isWin: true },
  { id: "earphones", name: "Strong Bass Earphones", short: "Bass Earphones", image: earphonesAsset.url, isWin: true },
  { id: "cash100", name: "Rs. 100 Cash Back", short: "Rs.100 Cash", image: cash100Asset.url, isWin: true },
  { id: "aeropods", name: "KICK AeroPods X3", short: "AeroPods X3", image: aeropodsAsset.url, isWin: true },
  { id: "zeblaze", name: "Zeblaze BTalk 3 Plus Smartwatch", short: "Zeblaze BTalk 3+", image: zeblazeAsset.url, isWin: true },
];

const DEFAULT_PROBS: Record<PrizeId, number> = {
  "try-again": 20,
  cable: 30,
  earphones: 50,
  cash100: 0,
  aeropods: 0,
  zeblaze: 0,
};

const PROBS_KEY = "mmz_probs_v2";
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
