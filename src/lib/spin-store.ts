import logoUrl from "@/assets/spinnopal-logo.png";

// Default platform logo used on marketing/landing pages and as a fallback
// when a shop hasn't uploaded its own logo yet.
export const DEFAULT_LOGO = logoUrl;

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
