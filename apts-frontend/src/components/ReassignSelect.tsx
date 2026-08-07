import api from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "@/types/types";

interface ReassignSelectProps {
  bidderId: string;
  onChange: () => void;
  currentDevId?: string;
  developers: User[];
}

export function ReassignSelect({
  bidderId,
  onChange,
  currentDevId,
  developers,
}: ReassignSelectProps) {
  const UNASSIGNED_VALUE = "__unassigned__";

  const handleReassign = async (devId: string) => {
    const newDeveloperId = devId === UNASSIGNED_VALUE ? null : devId;
    await api.patch(`/admin/bidders/${bidderId}/reassign`, {
      newDeveloperId,
    });
    onChange();
  };

  return (
    <Select value={currentDevId} onValueChange={handleReassign}>
      <SelectTrigger className="h-8">
        <SelectValue placeholder="Reassign" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED_VALUE}>— Unassigned —</SelectItem>
        {developers.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.username}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
