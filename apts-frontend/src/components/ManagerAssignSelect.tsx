import api from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ManagerAssignSelectProps {
  developerId: string;
  onChange: () => void;
  currentManagerId?: string;
  managers: { id: string; username: string }[];
}

export function ManagerAssignSelect({
  developerId,
  onChange,
  currentManagerId,
  managers,
}: ManagerAssignSelectProps) {
  const NONE_VALUE = "__none__";

  const handleAssign = async (managerId: string) => {
    if (managerId === NONE_VALUE) {
      if (currentManagerId) {
        await api.delete("/admin/developer-managers", {
          params: { developer_id: developerId, manager_id: currentManagerId },
        });
      }
    } else {
      await api.post("/admin/developer-managers", {
        developer_id: developerId,
        manager_id: managerId,
      });
    }
    onChange();
  };

  return (
    <Select
      value={currentManagerId || NONE_VALUE}
      onValueChange={handleAssign}
    >
      <SelectTrigger className="h-8">
        <SelectValue placeholder="Assign manager" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>— None —</SelectItem>
        {managers.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.username}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
