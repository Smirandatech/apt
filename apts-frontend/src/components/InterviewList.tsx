import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { InterviewStage } from "@/types/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
} from "date-fns";
import { InterviewStatusBadge } from "@/components/InterviewBadges";
import { InterviewExportButtons } from "@/components/InterviewExportButtons";
import InterviewCalendar from "@/components/InterviewCalendar";

export default function DeveloperInterviewList() {
  const [interviews, setInterviews] = useState<InterviewStage[]>([]);
  const [filtered, setFiltered] = useState<InterviewStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selected, setSelected] = useState<InterviewStage | null>(null);
  const [formData, setFormData] = useState<Partial<InterviewStage>>({});

  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const res = await api.get("/interviews");
      setInterviews(res.data);
    } catch {
      toast.error("Failed to load interviews.");
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (interview: InterviewStage) => {
    setSelected(interview);
    setFormData({
      ...interview,
      scheduled_at: interview.scheduled_at
        ? new Date(interview.scheduled_at)
        : null,
    });
    setEditModalOpen(true);
  };

  const saveInterview = async () => {
    if (!selected) return;

    try {
      await api.put(`/interviews/${selected.id}`, {
        ...formData,
        scheduled_at: formData.scheduled_at
          ? new Date(formData.scheduled_at).toISOString()
          : null,
      });
      toast.success("Interview updated!");
      setEditModalOpen(false);
      fetchInterviews();
    } catch {
      toast.error("Failed to update interview.");
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  useEffect(() => {
    // Filtering & sorting
    const result = interviews
      .filter((intv) => {
        return (
          (!statusFilter || intv.status === statusFilter) &&
          (!companyFilter ||
            intv.company_name
              .toLowerCase()
              .includes(companyFilter.toLowerCase()))
        );
      })
      .sort(
        (a, b) =>
          new Date(a.scheduled_at || "").getTime() -
          new Date(b.scheduled_at || "").getTime()
      );

    setFiltered(result);
  }, [interviews, statusFilter, companyFilter]);

  const groupedInterviews = useMemo(() => {
    const groups: Record<string, InterviewStage[]> = {};

    for (const intv of filtered) {
      if (!intv.scheduled_at) {
        if (!groups["Unscheduled"]) groups["Unscheduled"] = [];
        groups["Unscheduled"].push(intv);
        continue;
      }

      const date = startOfDay(new Date(intv.scheduled_at));

      let key = format(date, "MM/dd/yyyy");
      if (isToday(date)) key = "Today";
      else if (isTomorrow(date)) key = "Tomorrow";
      else if (isYesterday(date)) key = "Yesterday";

      if (!groups[key]) groups[key] = [];
      groups[key].push(intv);
    }

    return groups;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Interview Management</h2>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <InterviewExportButtons data={filtered} />
        <Button
          variant="outline"
          onClick={() => setShowCalendar(!showCalendar)}
        >
          {showCalendar ? "Show List View" : "Show Calendar View"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="w-48 gap-2 grid">
          <Label>Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value === "all" ? "" : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="scheduling">Scheduling</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="waiting">Waiting Feedback</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-64 gap-2 grid">
          <Label>Company Name</Label>
          <Input
            placeholder="Search by company"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading interviews...</p>
      ) : Object.entries(groupedInterviews).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No interviews match filters.
        </p>
      ) : showCalendar ? (
        <InterviewCalendar
          interviews={filtered}
          onSelect={(intv) => openEditor(intv)}
        />
      ) : (
        Object.entries(groupedInterviews).map(([date, interviews]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-lg font-semibold border-b dark:border-gray-700 pb-1">{date}</h3>
            {interviews.map((intv) => (
              <div
                key={intv.id}
                className="border p-4 rounded shadow-sm bg-white dark:bg-card dark:border-gray-700 flex justify-between items-start"
              >
                <div>
                  <h3 className="font-semibold text-base">
                    {intv.company_name} — {intv.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Stage:{" "}
                    <span className="font-medium">{intv.stage_name}</span>
                  </p>
                  <p className="text-sm">
                    Status: <InterviewStatusBadge status={intv.status} />
                  </p>
                  {intv.scheduled_at && (
                    <p className="text-sm">
                      Scheduled:{" "}
                      {new Date(intv.scheduled_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  <div className="flex gap-4 text-sm mt-2">
                    <a
                      href={intv.job_description_url}
                      target="_blank"
                      className="underline text-blue-600 dark:text-blue-400"
                    >
                      Job
                    </a>
                    <a
                      href={intv.resume_url}
                      target="_blank"
                      className="underline text-green-600 dark:text-green-400"
                    >
                      Resume
                    </a>
                  </div>
                </div>
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditor(intv)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Editor Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Interview Stage</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <b>{selected.company_name}</b> — {selected.title}
              </p>

              <div className="flex gap-2">
                <div className="grid gap-2 flex-1">
                  <Label>Stage Name</Label>
                  <Select
                    value={formData.stage_name}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        stage_name: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recruiter">Recruiter</SelectItem>
                      <SelectItem value="screen">Screen</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 flex-1">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduling">Scheduling</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="waiting">Waiting Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Scheduled Time</Label>
                <DatePicker
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd h:mm aa"
                  className="border px-2 py-1 rounded w-full"
                  selected={
                    formData.scheduled_at
                      ? new Date(formData.scheduled_at)
                      : null
                  }
                  onChange={(date) =>
                    setFormData((prev) => ({ ...prev, scheduled_at: date }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  rows={4}
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveInterview}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
