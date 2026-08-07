import { Badge } from "@/components/ui/badge";

export function InterviewStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    scheduled: "blue",
    passed: "green",
    waiting: "yellow",
    scheduling: "orange",
    canceled: "red",
  };

  return (
    <Badge
      className={`capitalize`}
      style={{
        backgroundColor: colorMap[status] || "gray",
        color: "white",
      }}
    >
      {status}
    </Badge>
  );
}
