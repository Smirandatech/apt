import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { EditUserModal } from "./EditUserModal";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ReassignSelect } from "./ReassignSelect";
import { ManagerAssignSelect } from "./ManagerAssignSelect";
import { User } from "@/types/types";

interface UserTableProps {
  users: User[];
  role: string;
  developers?: User[];
  managers?: { id: string; username: string }[];
  onActionComplete: () => void;
}

export function UserTable({ users, role, developers, managers, onActionComplete }: UserTableProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            {role === "bidder" && <TableHead>Current Developer</TableHead>}
            {role === "bidder" && <TableHead>Reassign</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.username}</TableCell>
              <TableCell>{user.role}</TableCell>
              {role === "developer" && (
                <>
                  <TableCell>
                    {user.manager?.username || (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  {managers && managers.length > 0 && (
                    <TableCell>
                      <ManagerAssignSelect
                        developerId={user.id}
                        onChange={onActionComplete}
                        currentManagerId={user.manager?.id}
                        managers={managers}
                      />
                    </TableCell>
                  )}
                </>
              )}
              {role === "bidder" && (
                <>
                  <TableCell>
                    {user.developer?.username || (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ReassignSelect
                      bidderId={user.id}
                      onChange={onActionComplete}
                      currentDevId={user.developer?.id}
                      developers={developers || []}
                    />
                  </TableCell>
                </>
              )}
              <TableCell className="text-right space-x-2">
                <Button size="sm" onClick={() => setEditingUser(user)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeletingUser(user)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={onActionComplete}
        />
      )}

      {deletingUser && (
        <ConfirmDeleteDialog
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={onActionComplete}
        />
      )}
    </div>
  );
}
