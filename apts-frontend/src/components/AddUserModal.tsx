import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import api from "@/services/api";
import { useState } from "react";
import bcrypt from "bcryptjs";

interface AddUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddUserModal({ open, onOpenChange, onCreated }: AddUserModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("bidder");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    const passwordHash = await bcrypt.hash(password, 10);
    await api.post("/admin/users", { username, passwordHash, role });
    setLoading(false);
    onCreated();
    onOpenChange(false);
    setUsername("");
    setPassword("");
    setRole("bidder");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Username</Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Label>Password</Label>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <Label>Role</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="bidder">Bidder</option>
            <option value="developer">Developer</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
