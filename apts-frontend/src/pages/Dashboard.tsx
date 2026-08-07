// src/pages/Dashboard.tsx
import { useAuth } from "@/contexts/AuthContext";
import BidderDashboard from "./dashboards/BidderDashboard";
import DeveloperDashboard from "@/pages/dashboards/DeveloperDashboard";
import AdminDashboard from "@/pages/dashboards/AdminDashboard";
import ManagerDashboard from "@/pages/dashboards/ManagerDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return <div>Loading...</div>;

  if (user.role === "bidder") {
    return <BidderDashboard />;
  }

  if (user.role === "developer") {
    return <DeveloperDashboard />;
  }

  if (user.role === "manager") {
    return <ManagerDashboard />;
  }

  if (user.role === "admin") {
    return <AdminDashboard />;
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 text-center">
      <h2 className="text-xl font-bold">Hello {user.name} 👋</h2>
      <p className="mt-4">
        The dashboard for your role (<code>{user.role}</code>) is coming soon.
      </p>
    </div>
  );
}
