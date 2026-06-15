import logoAsset from "@/assets/logo.png.asset.json";

export const LOGO = logoAsset.url;

export interface Prize {
  id: string;
  name: string;
  short: string;
  image: string;
  isWin: boolean;
  probability: number;
}

export type PrizeRow = {
  id: string;
  name: string;
  short: string;
  image_url: string;
  is_win: boolean;
  probability: number;
  sort_order: number;
};

export function rowToPrize(r: PrizeRow): Prize {
  return {
    id: r.id,
    name: r.name,
    short: r.short,
    image: r.image_url,
    isWin: r.is_win,
    probability: r.probability,
  };
}

const RECORDS_KEY = "mmz_records_v1";

export interface SpinRecord {
  id: string;
  name: string;
  prizeId: string;
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
