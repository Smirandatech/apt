import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** ---------------------------------------
 *  Inline, dependency-free checkbox dropdown
 * --------------------------------------- */
function BidderMultiSelect({
  all,
  selected,
  onChange,
  label = "Bidders",
}: {
  all: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((n) => n.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((s) => s !== name)
        : [...selected, name]
    );
  };

  const selectAll = () => onChange(all);
  const clearAll = () => onChange([]);

  return (
    <div className="min-w-[280px]" ref={wrapperRef}>
      <Label className="text-sm mb-1 block">{label}</Label>

      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selected.length ? `${selected.length} selected` : "Select bidders"}
        <span className="ml-2 text-gray-500">▾</span>
      </Button>

      {open && (
        <div
          className="absolute z-50 mt-2 w-[320px] rounded-lg border bg-white dark:bg-card p-2 shadow-lg"
          role="listbox"
        >
          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder="Search bidders..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
            />
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              All
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
          </div>

          <div className="max-h-64 overflow-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-3">No bidders found.</p>
            )}
            <ul className="space-y-1">
              {filtered.map((name) => {
                const checked = selected.includes(name);
                return (
                  <li key={name}>
                    <label className="flex items-center gap-2 rounded px-2 py-2 hover:bg-gray-50 dark:hover:bg-accent cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(name)}
                        className="h-4 w-4"
                      />
                      <span className="flex-1 text-sm">{name}</span>
                      {checked && <span className="text-xs text-blue-600 dark:text-blue-400">✓</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 px-1">
              {selected.slice(0, 6).map((b) => (
                <span
                  key={b}
                  className="text-xs bg-gray-100 dark:bg-gray-700 border rounded-full px-2 py-1 cursor-pointer"
                  title="Click to remove"
                  onClick={() => toggle(b)}
                >
                  {b} ×
                </span>
              ))}
              {selected.length > 6 && (
                <span className="text-xs border rounded-full px-2 py-1 bg-white dark:bg-card">
                  +{selected.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** ---------------------------------------
 *  Main Component
 * --------------------------------------- */
export default function DeveloperBidderPayments() {
  const { user } = useAuth();
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const [rateTiers, setRateTiers] = useState([
    { min: 0, max: 49, rate: 0.04 },
    { min: 50, max: 79, rate: 0.05 },
    { min: 80, max: 99, rate: 0.06 },
    { min: 100, max: Infinity, rate: 0.07 },
  ]);

  const [selectedBidders, setSelectedBidders] = useState<string[]>([]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const rolePath = user?.role === "manager" ? "/manager" : "/developer";
      const dailyRes = await api.get(`${rolePath}/analytics/bidder-activity`, {
        params: {
          interval: "daily",
          start: format(startDate, "yyyy-MM-dd"),
          end: format(endDate, "yyyy-MM-dd"),
        },
      });
      setDailyData(dailyRes.data);
    } catch {
      toast.error("Failed to load daily analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const getRate = (count: number) => {
    for (const tier of rateTiers) {
      if (count >= tier.min && count <= tier.max) return tier.rate;
    }
    return 0;
  };

  const calculatePaymentPerBidder = (data: any[]) => {
    const totals: Record<string, { total: number; breakdown: any[] }> = {};
    data.forEach((row) => {
      const label = row.label;
      Object.entries(row).forEach(([bidder, value]) => {
        if (bidder === "label") return;
        const count = Number(value);
        const rate = getRate(count);
        const payment = +(count * rate).toFixed(2);
        if (!totals[bidder]) totals[bidder] = { total: 0, breakdown: [] };
        totals[bidder].total += payment;
        totals[bidder].breakdown.push({ date: label, count, rate, payment });
      });
    });

    return Object.entries(totals).map(([bidder, { total, breakdown }]) => ({
      bidder,
      total: +total.toFixed(2),
      breakdown,
    }));
  };

  const paymentData = useMemo(
    () => calculatePaymentPerBidder(dailyData),
    [dailyData]
  );

  const allBidders = useMemo(() => {
    const set = new Set<string>();
    dailyData.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "label") set.add(k);
      });
    });
    if (set.size === 0) paymentData.forEach((p) => set.add(p.bidder));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dailyData, paymentData]);

  useEffect(() => {
    if (allBidders.length && selectedBidders.length === 0) {
      setSelectedBidders(allBidders);
    }
  }, [allBidders, selectedBidders.length]);

  const filteredPaymentData = useMemo(
    () => paymentData.filter((entry) => selectedBidders.includes(entry.bidder)),
    [paymentData, selectedBidders]
  );

  const totalPaymentAmount = filteredPaymentData.reduce(
    (sum, entry) => sum + entry.total,
    0
  );

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">Bidder Daily Payment Report</h2>

      <div className="flex flex-wrap items-end gap-4 relative">
        <div>
          <Label className="text-sm">Start Date</Label>
          <DatePicker
            selected={startDate}
            onChange={(date) => date && setStartDate(date)}
            className="border dark:border-gray-700 dark:bg-input/30 dark:text-foreground px-2 py-1 rounded"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        <div>
          <Label className="text-sm">End Date</Label>
          <DatePicker
            selected={endDate}
            onChange={(date) => date && setEndDate(date)}
            className="border dark:border-gray-700 dark:bg-input/30 dark:text-foreground px-2 py-1 rounded"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        {/* Dependency-free, styled checkbox dropdown */}
        <BidderMultiSelect
          all={allBidders}
          selected={selectedBidders}
          onChange={setSelectedBidders}
        />

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default">Edit Rate Tiers</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Rate Tiers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {rateTiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={tier.min}
                    onChange={(e) => {
                      const updated = [...rateTiers];
                      updated[index].min = Number(e.target.value);
                      setRateTiers(updated);
                    }}
                    placeholder="Min"
                    className="w-20"
                  />
                  <span>-</span>
                  <Input
                    type="number"
                    value={tier.max === Infinity ? "" : tier.max}
                    onChange={(e) => {
                      const updated = [...rateTiers];
                      updated[index].max =
                        e.target.value === "" ? Infinity : Number(e.target.value);
                      setRateTiers(updated);
                    }}
                    placeholder="Max"
                    className="w-20"
                  />
                  <span>@</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={tier.rate}
                    onChange={(e) => {
                      const updated = [...rateTiers];
                      updated[index].rate = Number(e.target.value);
                      setRateTiers(updated);
                    }}
                    placeholder="Rate"
                    className="w-20"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      setRateTiers(rateTiers.filter((_, i) => i !== index))
                    }
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setRateTiers([...rateTiers, { min: 0, max: 0, rate: 0 }])
                }
              >
                + Add Tier
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <p className="text-lg font-semibold text-blue-800 dark:text-blue-400">
          Total Payment to Selected: ${totalPaymentAmount.toFixed(2)}
        </p>
      </div>

      {loading ? (
        <p className="p-4 bg-white dark:bg-card rounded-xl shadow-md">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPaymentData.map((entry) => (
            <div
              key={entry.bidder}
              className="bg-white dark:bg-card shadow-md rounded-xl p-4"
            >
              <h3 className="text-lg font-semibold mb-2">{entry.bidder}</h3>
              <p className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                Total Payment:{" "}
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  ${entry.total.toFixed(2)}
                </span>
              </p>
              <table className="w-full table-auto text-sm border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-1 border dark:border-gray-700">Date</th>
                    <th className="px-3 py-1 border dark:border-gray-700">Applications</th>
                    <th className="px-3 py-1 border dark:border-gray-700">Rate</th>
                    <th className="px-3 py-1 border dark:border-gray-700">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.breakdown.map((row, idx) => (
                    <tr key={idx} className="text-center">
                      <td className="border dark:border-gray-700 px-3 py-1">{row.date}</td>
                      <td className="border dark:border-gray-700 px-3 py-1">{row.count}</td>
                      <td className="border dark:border-gray-700 px-3 py-1">
                        ${row.rate.toFixed(2)}
                      </td>
                      <td className="border dark:border-gray-700 px-3 py-1 text-blue-700 dark:text-blue-400 font-semibold">
                        ${row.payment.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {filteredPaymentData.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400 text-sm col-span-full text-center">
              No payment data found for the selected bidders in the chosen range.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
