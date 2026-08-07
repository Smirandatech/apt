import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { createEvents, EventAttributes } from "ics";

export function InterviewExportButtons({ data }: { data: any[] }) {
  const handleExportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Interviews");
    XLSX.writeFile(wb, "interviews.xlsx");
  };

  const handleExportICS = () => {
    const events = data
      .filter((intv) => intv.scheduled_at)
      .map((intv) => {
        const date = new Date(intv.scheduled_at);
        return {
          title: `${intv.company_name} – ${intv.stage_name}`,
          description: intv.notes || "",
          start: [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
          ],
          duration: { hours: 1 },
        };
      });

    createEvents(events as EventAttributes[], (err, value) => {
      if (err) return console.error(err);
      const blob = new Blob([value], { type: "text/calendar;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "interviews.ics";
      a.click();
    });
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExportExcel}>
        Export Excel
      </Button>
      <Button variant="outline" onClick={handleExportICS}>
        Export iCal
      </Button>
    </div>
  );
}
