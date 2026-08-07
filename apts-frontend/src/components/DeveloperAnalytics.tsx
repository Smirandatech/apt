import { useEffect, useState } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

type IntervalType = "daily" | "weekly" | "monthly";

export default function DeveloperAnalytics() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [chartData, setChartData] = useState<any[]>([]);
  const [interviewTotals, setInterviewTotals] = useState<{ date: string; count: number }[]>([]);
  const [interviewsPerBidder, setInterviewsPerBidder] = useState<{ bidder: string; count: number }[]>([]);
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [interval, setInterval] = useState<IntervalType>("daily");
  const [interviewInterval, setInterviewInterval] = useState<IntervalType>("daily");
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const rolePath = user?.role === "manager" ? "/manager" : "/developer";

      const [activityRes, interviewRes] = await Promise.all([
        api.get(`${rolePath}/analytics/bidder-activity`, {
          params: {
            interval: interval,
            start: format(startDate, "yyyy-MM-dd"),
            end: format(endDate, "yyyy-MM-dd"),
          },
        }),
        api.get(`${rolePath}/analytics/interviews`, {
          params: {
            interval: interviewInterval,
            start: format(startDate, "yyyy-MM-dd"),
            end: format(endDate, "yyyy-MM-dd"),
          },
        }),
      ]);

      setChartData(activityRes.data);
      setInterviewTotals(interviewRes.data.dailyTotals || []);
      setInterviewsPerBidder(interviewRes.data.perBidder || []);
    } catch (err) {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate, interval, interviewInterval]);

  const getBidderNames = (data: any[]) =>
    data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "label") : [];

  const bidderNames = getBidderNames(chartData);

  const getTotalPerBidder = (data: any[]) => {
    const totals: Record<string, number> = {};

    data.forEach((row) => {
      Object.entries(row).forEach(([key, val]) => {
        if (key !== "label") {
          totals[key] = (totals[key] || 0) + Number(val);
        }
      });
    });

    return Object.entries(totals).map(([bidder, count]) => ({
      bidder,
      count,
    }));
  };

  const bidderTotals = getTotalPerBidder(chartData);

  const getBidderColorMap = (bidders: string[]) => {
    const colorMap: Record<string, string> = {};
    bidders.forEach((bidder, idx) => {
      colorMap[bidder] = `hsl(${(idx * 67) % 360}, 70%, 50%)`;
    });
    return colorMap;
  };

  const bidderColorMap = getBidderColorMap(bidderNames);

  const getIntervalLabel = () => {
    switch (interval) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Daily";
    }
  };

  const getInterviewIntervalLabel = () => {
    switch (interviewInterval) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      default:
        return "Daily";
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">Bidder Application Analytics</h2>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-sm font-medium block">Start Date</label>
          <DatePicker
            selected={startDate}
            onChange={(date) => date && setStartDate(date)}
            className="border dark:border-gray-700 dark:bg-input/30 dark:text-foreground px-2 py-1 rounded"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        <div>
          <label className="text-sm font-medium block">End Date</label>
          <DatePicker
            selected={endDate}
            onChange={(date) => date && setEndDate(date)}
            className="border dark:border-gray-700 dark:bg-input/30 dark:text-foreground px-2 py-1 rounded"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">View</label>
          <div className="flex gap-2">
            <Button
              variant={interval === "daily" ? "default" : "outline"}
              size="sm"
              onClick={() => setInterval("daily")}
            >
              Daily
            </Button>
            <Button
              variant={interval === "weekly" ? "default" : "outline"}
              size="sm"
              onClick={() => setInterval("weekly")}
            >
              Weekly
            </Button>
            <Button
              variant={interval === "monthly" ? "default" : "outline"}
              size="sm"
              onClick={() => setInterval("monthly")}
            >
              Monthly
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <>
          {/* Dynamic Chart based on date range */}
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {getIntervalLabel()} Chart
            </h3>
            <div className="p-4 bg-white dark:bg-card rounded-xl shadow-md">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#374151" : "#e5e7eb"} />
                  <XAxis dataKey="label" stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                  <YAxis allowDecimals={false} stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                      border: theme === "dark" ? "1px solid #374151" : "1px solid #e5e7eb",
                      color: theme === "dark" ? "#f3f4f6" : "#111827"
                    }}
                  />
                  <Legend wrapperStyle={{ color: theme === "dark" ? "#f3f4f6" : "#111827" }} />
                  {bidderNames.map((bidder) => (
                    <Bar
                      key={bidder}
                      dataKey={bidder}
                      stackId="a"
                      fill={bidderColorMap[bidder]}
                    >
                      <LabelList
                        dataKey={bidder}
                        content={({ x, y, width, height, value }) => {
                          if (!value || Number(value) === 0) return null;
                          const isTooSmall = Number(height) < 18;
                          const posY = isTooSmall
                            ? Number(y) + 10
                            : Number(y) + Number(height) / 2;

                          const textColor = isTooSmall 
                            ? (theme === "dark" ? "#f3f4f6" : "black")
                            : "white";
                          return (
                            <text
                              x={Number(x) + Number(width) / 2}
                              y={posY}
                              fill={textColor}
                              fontSize="12"
                              fontWeight="bold"
                              textAnchor="middle"
                              alignmentBaseline={
                                isTooSmall ? "baseline" : "middle"
                              }
                              style={{ pointerEvents: "none" }}
                            >
                              {value}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bidder Totals Chart */}
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Bidder Application Totals (Summed Over {getIntervalLabel().toLowerCase()} Period)
            </h3>
            <div className="p-4 bg-white dark:bg-card rounded-xl shadow-md">
              <ResponsiveContainer
                width="100%"
                height={Math.max(400, bidderTotals.length * 40)}
              >
                <BarChart data={bidderTotals} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#374151" : "#e5e7eb"} />
                  <XAxis type="number" allowDecimals={false} stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                  <YAxis type="category" dataKey="bidder" stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                      border: theme === "dark" ? "1px solid #374151" : "1px solid #e5e7eb",
                      color: theme === "dark" ? "#f3f4f6" : "#111827"
                    }}
                  />
                  <Bar dataKey="count" isAnimationActive={false}>
                    {bidderTotals.map((entry) => (
                      <Cell
                        key={`cell-${entry.bidder}`}
                        fill={bidderColorMap[entry.bidder]}
                      />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      style={{ 
                        fontSize: 12, 
                        fontWeight: "bold",
                        fill: theme === "dark" ? "#f3f4f6" : "#111827"
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interview Analytics Section */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Interview Analytics</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">View:</label>
                <div className="flex gap-2">
                  <Button
                    variant={interviewInterval === "daily" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInterviewInterval("daily")}
                  >
                    Daily
                  </Button>
                  <Button
                    variant={interviewInterval === "weekly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInterviewInterval("weekly")}
                  >
                    Weekly
                  </Button>
                  <Button
                    variant={interviewInterval === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInterviewInterval("monthly")}
                  >
                    Monthly
                  </Button>
                </div>
              </div>
            </div>

            {/* Interview Totals Chart */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">
                Interview Totals ({getInterviewIntervalLabel()})
              </h3>
              <div className="p-4 bg-white dark:bg-card rounded-xl shadow-md">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={interviewTotals}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#374151" : "#e5e7eb"} />
                    <XAxis dataKey="date" stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                    <YAxis allowDecimals={false} stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                        border: theme === "dark" ? "1px solid #374151" : "1px solid #e5e7eb",
                        color: theme === "dark" ? "#f3f4f6" : "#111827"
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6">
                      <LabelList
                        dataKey="count"
                        position="top"
                        style={{ 
                          fontSize: 12, 
                          fontWeight: "bold",
                          fill: theme === "dark" ? "#f3f4f6" : "#111827"
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Interviews Per Bidder Chart */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Interviews Per Bidder</h3>
              <div className="p-4 bg-white dark:bg-card rounded-xl shadow-md">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(400, interviewsPerBidder.length * 40)}
                >
                  <BarChart data={interviewsPerBidder} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#374151" : "#e5e7eb"} />
                    <XAxis type="number" allowDecimals={false} stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                    <YAxis type="category" dataKey="bidder" stroke={theme === "dark" ? "#9ca3af" : "#6b7280"} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                        border: theme === "dark" ? "1px solid #374151" : "1px solid #e5e7eb",
                        color: theme === "dark" ? "#f3f4f6" : "#111827"
                      }}
                    />
                    <Bar dataKey="count" isAnimationActive={false}>
                      {interviewsPerBidder.map((entry, idx) => (
                        <Cell
                          key={`cell-${entry.bidder}`}
                          fill={bidderColorMap[entry.bidder] || `hsl(${(idx * 67) % 360}, 70%, 50%)`}
                        />
                      ))}
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ 
                          fontSize: 12, 
                          fontWeight: "bold",
                          fill: theme === "dark" ? "#f3f4f6" : "#111827"
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
