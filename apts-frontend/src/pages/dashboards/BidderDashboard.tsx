import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import JobApplicationForm from "@/components/JobApplicationForm";
import JobApplicationTable from "@/components/JobApplicationTable";
import api from "@/services/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type DailyDatum = { date: string; count: number };

const tzLocal =
  (typeof Intl !== "undefined" &&
    Intl.DateTimeFormat().resolvedOptions().timeZone) ||
  "UTC";

function fmtYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BidderDashboard() {
  const [refresh, setRefresh] = useState(false);
  const [open, setOpen] = useState(false);

  // --- Analytics dialog state ---
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [dailyData, setDailyData] = useState<DailyDatum[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  // Default range = last 7 days (inclusive)
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);

  const [startDate, setStartDate] = useState<string>(fmtYmd(weekAgo));
  const [endDate, setEndDate] = useState<string>(fmtYmd(today));

  const [demographics, setDemographics] = useState<any | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    const fetchDemographics = async () => {
      try {
        const res = await api.get("/bidder/demographics");
        setDemographics(res.data);
      } catch { }
    };
    fetchDemographics();
  }, []);

  // keep dates valid
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setEndDate(startDate);
  }, [startDate]);
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) setStartDate(endDate);
  }, [endDate]);

  // load data whenever dialog opens or dates change
  useEffect(() => {
    if (!analyticsOpen) return;
    let cancelled = false;
    (async () => {
      setDailyLoading(true);
      setDailyError(null);
      try {
        const q = new URLSearchParams();
        if (startDate) q.set("from", startDate);
        if (endDate) q.set("to", endDate);
        if (tzLocal) q.set("tz", tzLocal);

        const res = await api.get<DailyDatum[]>(`/bidder/daily-jobs?${q.toString()}`);
        if (!cancelled) {
          const sorted = [...res.data].sort((a, b) => a.date.localeCompare(b.date));
          setDailyData(sorted);
        }
      } catch (e: any) {
        if (!cancelled) setDailyError(e?.message ?? "Failed to load data");
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analyticsOpen, startDate, endDate]);

  return (
    <div className="mx-auto space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Bidder Dashboard</h1>

        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Analytics button + dialog */}
          <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
            <DialogTrigger asChild>
              {/* <Button variant="outline">Analytics</Button> */}
            </DialogTrigger>

            <DialogContent
              className="p-0 overflow-hidden h-[90vh]"
              style={{ width: "80vw", maxWidth: "80vw" }}   // ← forces 80% of screen width
            >
              <div className="flex flex-col h-full">
                <DialogHeader className="px-6 pt-6 pb-3 border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <DialogTitle>Daily Job Applications</DialogTitle>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="flex flex-col">
                      <Label htmlFor="start-date">Start date</Label>
                      <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 h-9 rounded-md border px-3 text-sm"
                        max={endDate || undefined}
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label htmlFor="end-date">End date</Label>
                      <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 h-9 rounded-md border px-3 text-sm"
                        min={startDate || undefined}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const t = new Date();
                          const w = new Date();
                          w.setDate(t.getDate() - 6);
                          setStartDate(fmtYmd(w));
                          setEndDate(fmtYmd(t));
                        }}
                      >
                        Last 7 days
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto px-6 pb-6">
                  {dailyLoading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Loading daily counts…
                    </div>
                  ) : dailyError ? (
                    <div className="py-10 text-center text-sm text-red-600">
                      {dailyError}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                      <div className="border rounded-md bg-white dark:bg-card flex flex-col max-h-[65vh] overflow-auto">
                        <div className="p-4 border-b">
                          <h3 className="text-lg font-semibold">Daily Counts (Table)</h3>
                        </div>
                        <div className="overflow-auto">
                          <BidderDailyJobsTable data={dailyData} />
                        </div>
                      </div>

                      <div className="border rounded-md bg-white dark:bg-card p-4 max-h-[65vh] overflow-auto">
                        <h3 className="text-lg font-semibold mb-3">Applications by Date (Bar)</h3>
                        <div className="w-full h-[360px]">
                          <BidderDailyJobsBarChart data={dailyData} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button
            variant="outline"
            onClick={() => setShowDemo((prev) => !prev)}
            className="h-9 px-4 text-sm font-medium"
          >
            {showDemo ? "Hide Demographics" : "Show Demographics"}
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 px-4 text-sm font-semibold">+ New Application</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw] sm:w-full">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Submit Job Application</DialogTitle>
              </DialogHeader>
              <JobApplicationForm
                onSuccess={() => setRefresh(!refresh)}
                onClose={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {demographics && showDemo && (
        <div className="border p-4 sm:p-6 rounded-lg bg-muted/50 shadow-sm mx-4 sm:mx-6 lg:mx-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5">Resume Demographics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <Field label="Name" value={demographics.name} />
            <Field label="Email" value={demographics.email} />
            <Field label="Phone" value={demographics.phone} />
            <Field label="Gender" value={demographics.gender} />
            <Field label="Date of Birth" value={demographics.dob} />
            <Field label="Ethnicity" value={demographics.ethnicity} />
            <Field label="Disability" value={demographics.disability} />
            <Field label="Veteran" value={demographics.veteran} />
            <Field label="LinkedIn">
              <a
                href={demographics.linkedin}
                target="_blank"
                className="text-blue-600 underline"
              >
                {demographics.linkedin || "—"}
              </a>
            </Field>
            <Field label="Website">
              <a
                href={demographics.website}
                target="_blank"
                className="text-blue-600 underline"
              >
                {demographics.website || "—"}
              </a>
            </Field>
            <div className="md:col-span-2">
              <Field label="Address" value={demographics.address} />
            </div>
          </div>
        </div>
      )}

      <JobApplicationTable refresh={refresh} />
    </div>
  );
}

/* -------------------- helpers & subcomponents -------------------- */

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <p className="text-sm text-muted-foreground">
        {children ?? value ?? "—"}
      </p>
    </div>
  );
}

function BidderDailyJobsTable({ data }: { data: DailyDatum[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-4 py-2 text-left border-b">Date</th>
            <th className="px-4 py-2 text-right border-b">Applications</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                No data in this range.
              </td>
            </tr>
          ) : (
            data.map(({ date, count }) => (
              <tr key={date} className="hover:bg-muted/30">
                <td className="px-4 py-2 border-b">{date}</td>
                <td className="px-4 py-2 border-b text-right">{count}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function BidderDailyJobsBarChart({ data }: { data: DailyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
