import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPrizes } from "@/lib/prizes.functions";
import { rowToPrize, type Prize, type PrizeRow } from "@/lib/spin-store";

export const PRIZES_QUERY_KEY = ["prizes"] as const;

export function usePrizes() {
  const fetchPrizes = useServerFn(listPrizes);
  const query = useQuery({
    queryKey: PRIZES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetchPrizes();
      return (res.prizes as PrizeRow[]).map(rowToPrize);
    },
    // Near-immediate propagation of admin edits without realtime
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  return { prizes: (query.data ?? []) as Prize[], isLoading: query.isLoading };
}

export function useInvalidatePrizes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PRIZES_QUERY_KEY });
}
