import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import api from "@/services/api";
import bcrypt from "bcryptjs";

export function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: { id: string; username: string };
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!username.trim()) {
      errs.username = "Username is required.";
    }
    if (newPassword && newPassword.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate()) return;

    setSaving(true);
    const payload: any = { username };

    if (newPassword.trim()) {
      const hash = await bcrypt.hash(newPassword.trim(), 10);
      payload.passwordHash = hash;
    }

    try {
      await api.patch(`/admin/users/${user.id}`, payload);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={errors.username ? "border-destructive" : ""}
            />
            {errors.username && (
              <p className="text-xs text-destructive mt-1">{errors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">
              New Password{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              className={errors.password ? "border-destructive" : ""}
            />
            {errors.password && (
              <p className="text-xs text-destructive mt-1">{errors.password}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
