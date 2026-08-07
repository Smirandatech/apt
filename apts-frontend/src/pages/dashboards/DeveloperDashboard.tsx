import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ResumeTemplateManager from "@/components/ResumeTemplateManager";
import BidderManager from "@/components/BidderManager";
import JobApplicationTable from "@/components/JobApplicationTable";
import InterviewList from "@/components/InterviewList";
import ApiKeySettings from "@/components/ApiKeySettings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import DeveloperAnalytics from "@/components/DeveloperAnalytics";
import DeveloperBidderPayments from "@/components/DeveloperBidderPayments";

export default function DeveloperDashboard() {
  const [apiModalOpen, setApiModalOpen] = useState(false);

  return (
    <Tabs defaultValue="applications" className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Developer Dashboard</h1>
        <TabsList className="w-full sm:w-auto flex-wrap">
          <TabsTrigger value="management" className="text-xs sm:text-sm">Management</TabsTrigger>
          <TabsTrigger value="applications" className="text-xs sm:text-sm">Applications</TabsTrigger>
          <TabsTrigger value="other-developers-jobs" className="text-xs sm:text-sm">Other Developers' Jobs</TabsTrigger>
          <TabsTrigger value="interviews" className="text-xs sm:text-sm">Interviews</TabsTrigger>
          <TabsTrigger value="payment" className="text-xs sm:text-sm">Payment</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="management" className="space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <ResumeTemplateManager />
          <BidderManager />
        </div>

        <div className="mt-6">
          <Dialog open={apiModalOpen} onOpenChange={setApiModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-9 px-4 text-sm font-medium">Manage OpenAI API Key</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">OpenAI API Key Settings</DialogTitle>
              </DialogHeader>
              <ApiKeySettings />
            </DialogContent>
          </Dialog>
        </div>
      </TabsContent>

      <TabsContent value="applications">
        <JobApplicationTable />
      </TabsContent>

      <TabsContent value="other-developers-jobs">
        <JobApplicationTable endpoint="/developer/other-developers-jobs" />
      </TabsContent>

      <TabsContent value="interviews">
        <InterviewList />
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
