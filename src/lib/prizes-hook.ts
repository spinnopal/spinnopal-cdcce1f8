import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPrizesBySlug } from "@/lib/prizes.functions";
import { rowToPrize, type Prize, type PrizeRow } from "@/lib/spin-store";

export const prizesQueryKey = (slug: string, campaignSlug?: string) =>
  ["prizes", slug, campaignSlug ?? "_default"] as const;

export function usePrizesBySlug(slug: string, campaignSlug?: string) {
  const fetchPrizes = useServerFn(listPrizesBySlug);
  const query = useQuery({
    queryKey: prizesQueryKey(slug, campaignSlug),
    queryFn: async () => {
      const res = await fetchPrizes({ data: { slug, ...(campaignSlug ? { campaignSlug } : {}) } });
      return (res.prizes as PrizeRow[]).map(rowToPrize);
    },
    // Prizes rarely change during a customer's session. Skip aggressive polling
    // (was refetching every 4s per open tab, dominating DB load) and cache for
    // 5 minutes; window-focus refetch still catches shop-owner edits.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    enabled: !!slug,
  });
  return { prizes: (query.data ?? []) as Prize[], isLoading: query.isLoading };
}

export function useInvalidatePrizes(slug?: string) {
  const qc = useQueryClient();
  return () =>
    slug
      ? qc.invalidateQueries({ queryKey: ["prizes", slug] })
      : qc.invalidateQueries({ queryKey: ["prizes"] });
}
