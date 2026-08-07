import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DeveloperAnalytics from "@/components/DeveloperAnalytics";
import DeveloperBidderPayments from "@/components/DeveloperBidderPayments";
import JobApplicationTable from "@/components/JobApplicationTable";

export default function ManagerDashboard() {
  return (
    <Tabs defaultValue="applications" className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Manager Dashboard</h1>
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="applications" className="text-xs sm:text-sm">
            Applications
          </TabsTrigger>
          <TabsTrigger value="payment" className="text-xs sm:text-sm">
            Payment
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">
            Analytics
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="applications">
        <JobApplicationTable />
      </TabsContent>

      <TabsContent value="payment">
        <DeveloperBidderPayments />
      </TabsContent>

      <TabsContent value="analytics">
        <DeveloperAnalytics />
      </TabsContent>
    </Tabs>
  );
}
