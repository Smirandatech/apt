import { useEffect, useState } from "react";
import api from "@/services/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { AdminUserManager } from "@/components/AdminUserManager";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [refreshUsers, setRefreshUsers] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const fetchStats = async () => {
    const params: Record<string, any> = {};
    if (startDate) params.start_date = startDate.toISOString().split("T")[0];
    if (endDate) params.end_date = endDate.toISOString().split("T")[0];

    const res = await api.get("/admin/stats", { params });
    setStats(res.data);
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  return (
    <Tabs defaultValue="analytics" className="space-y-6 w-full">
      <div className="px-4 sm:px-6 lg:px-8">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">📊 Analytics</TabsTrigger>
          <TabsTrigger value="manage" className="text-xs sm:text-sm">👥 Manage Users</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="analytics">
        <AdminAnalytics
          stats={stats}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
        />
      </TabsContent>

      <TabsContent value="manage">
        <AdminUserManager refresh={refreshUsers} setRefresh={setRefreshUsers} />
      </TabsContent>
    </Tabs>
  );
}
