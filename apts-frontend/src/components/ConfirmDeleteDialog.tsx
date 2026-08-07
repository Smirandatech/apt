import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import api from "@/services/api";

interface ConfirmDeleteDialogProps {
  user: { id: string; username: string };
  onClose: () => void;
  onDeleted: () => void;
}

export function ConfirmDeleteDialog({ user, onClose, onDeleted }: ConfirmDeleteDialogProps) {
  const handleDelete = async () => {
    await api.delete(`/admin/users/${user.id}`);
    onDeleted();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User?</DialogTitle>
        </DialogHeader>
        <p>
          Are you sure you want to delete <b>{user.username}</b>?
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
