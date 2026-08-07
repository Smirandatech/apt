import { useEffect, useState } from "react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserTable } from "@/components/UserTable";
import { AddUserModal } from "@/components/AddUserModal";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminUserManagerProps {
  refresh: boolean;
  setRefresh: (value: boolean) => void;
}

export function AdminUserManager({
  refresh,
  setRefresh,
}: AdminUserManagerProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await api.get("/admin/users");
    setUsers(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [refresh]);

  const developers = users.filter((u) => u.role === "developer");
  const bidders = users.filter((u) => u.role === "bidder");
  const managers = users.filter((u) => u.role === "manager");

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">User Management</h2>
        <Button onClick={() => setShowAddModal(true)}>Add User</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Developers</CardTitle>
        </CardHeader>
        <CardContent>
          <UserTable
            users={developers}
            role="developer"
            managers={managers}
            onActionComplete={() => setRefresh(!refresh)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Managers</CardTitle>
        </CardHeader>
        <CardContent>
          <UserTable
            users={managers}
            role="manager"
            onActionComplete={() => setRefresh(!refresh)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bidders</CardTitle>
        </CardHeader>
        <CardContent>
          <UserTable
            users={bidders}
            role="bidder"
            developers={developers}
            onActionComplete={() => setRefresh(!refresh)}
          />
        </CardContent>
      </Card>

      <AddUserModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onCreated={() => setRefresh(!refresh)}
      />
    </div>
  );
}
