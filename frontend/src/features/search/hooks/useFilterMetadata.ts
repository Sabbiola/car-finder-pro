import { useQuery } from "@tanstack/react-query";
import { fetchFilterMetadata } from "@/services/api/metadata";

export function useFilterMetadata() {
  return useQuery({
    queryKey: ["filter-metadata"],
    queryFn: fetchFilterMetadata,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

