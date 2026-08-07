import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminAnalyticsProps {
  stats: {
    totalDevelopers: number;
    totalBidders: number;
    developers: {
      username: string;
      application_count: number;
      bidder_count: number;
      bidders: {
        username: string;
        application_count: number;
        unpaid_count: number;
        rate: number;
        paid_amount: number;
      }[];
    }[];
  };
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
}

export function AdminAnalytics({
  stats,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
}: AdminAnalyticsProps) {
  if (!stats)
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );

  const devChartData = stats.developers.map((dev) => {
    const row: Record<string, any> = { username: dev.username };
    dev.bidders.forEach((b: any) => {
      row[b.username] = b.application_count;
    });
    return row;
  });

  const allBidderNames = Array.from(
    new Set(
      stats.developers.flatMap((d: any) =>
        d.bidders.map((b: any) => b.username)
      )
    )
  );

  const exportTable = () => {
    const data = stats.developers.flatMap((dev) =>
      dev.bidders.map((b) => ({
        Developer: dev.username,
        "Total Dev Applications": dev.application_count,
        "Bidder Count": dev.bidder_count,
        Bidder: b.username,
        "Total Apps": b.application_count,
        "Unpaid Apps": b.unpaid_count,
        Rate: b.rate,
        "Due Payment": b.unpaid_count * b.rate,
        "Total Paid ($)": b.paid_amount,
      }))
    );

    const sheet = XLSX.utils.json_to_sheet(data);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Developer Breakdown");
    XLSX.writeFile(book, "developer_breakdown.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Chart + Filters */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row justify-between items-center gap-4">
          <CardTitle>Applications by Developer</CardTitle>
          <div className="flex gap-2 items-center">
            <div className="text-sm">From:</div>
            <DatePicker
              selected={startDate}
              onChange={setStartDate}
              placeholderText="Start date"
              className="border px-2 py-1 text-sm rounded"
            />
            <div className="text-sm">To:</div>
            <DatePicker
              selected={endDate}
              onChange={setEndDate}
              placeholderText="End date"
              className="border px-2 py-1 text-sm rounded"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
              }}
            >
              Clear
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={devChartData}>
              <XAxis dataKey="username" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Developer" stackId="a" fill="#6366f1" />
              {allBidderNames.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  stackId="a"
                  fill={`hsl(${(i * 47) % 360}, 70%, 60%)`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Developer Table */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Developer Breakdown</CardTitle>
          <Button size="sm" variant="outline" onClick={exportTable}>
            Export
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Developer</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Bidders</TableHead>
                <TableHead>Bidder</TableHead>
                <TableHead>Total Apps</TableHead>
                <TableHead>Unpaid Apps</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Due Payment</TableHead>
                <TableHead>Total Paid ($)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.developers.map((dev) =>
                dev.bidders.map((b, idx) => (
                  <TableRow key={`${dev.username}-${b.username}`}>
                    {idx === 0 && (
                      <>
                        <TableCell rowSpan={dev.bidders.length}>
                          {dev.username}
                        </TableCell>
                        <TableCell rowSpan={dev.bidders.length}>
                          {dev.application_count}
                        </TableCell>
                        <TableCell rowSpan={dev.bidders.length}>
                          {dev.bidder_count}
                        </TableCell>
                      </>
                    )}
                    <TableCell>{b.username}</TableCell>
                    <TableCell>{b.application_count}</TableCell>
                    <TableCell>{b.unpaid_count}</TableCell>
                    <TableCell>${b.rate}</TableCell>
                    <TableCell>${b.unpaid_count * b.rate}</TableCell>
                    <TableCell>${b.paid_amount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Developers</CardTitle>
          </CardHeader>
          <CardContent>{stats.totalDevelopers}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Bidders</CardTitle>
          </CardHeader>
          <CardContent>{stats.totalBidders}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Developers", value: stats.totalDevelopers },
                    { name: "Bidders", value: stats.totalBidders },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  <Cell fill="#6366f1" />
                  <Cell fill="#10b981" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
