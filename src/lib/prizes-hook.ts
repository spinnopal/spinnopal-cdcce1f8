import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPrizesBySlug } from "@/lib/prizes.functions";
import { rowToPrize, type Prize, type PrizeRow } from "@/lib/spin-store";

export const prizesQueryKey = (slug: string) => ["prizes", slug] as const;

export function usePrizesBySlug(slug: string) {
  const fetchPrizes = useServerFn(listPrizesBySlug);
  const query = useQuery({
    queryKey: prizesQueryKey(slug),
    queryFn: async () => {
      const res = await fetchPrizes({ data: { slug } });
      return (res.prizes as PrizeRow[]).map(rowToPrize);
    },
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: !!slug,
  });
  return { prizes: (query.data ?? []) as Prize[], isLoading: query.isLoading };
}

export function useInvalidatePrizes(slug?: string) {
  const qc = useQueryClient();
  return () =>
    slug
      ? qc.invalidateQueries({ queryKey: prizesQueryKey(slug) })
      : qc.invalidateQueries({ queryKey: ["prizes"] });
}
