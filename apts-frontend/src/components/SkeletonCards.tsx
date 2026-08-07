// src/components/SkeletonCards.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonCards() {
  return (
    <div className="space-y-4 mt-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 border rounded shadow space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
