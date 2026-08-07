import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import { useMemo } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

export default function InterviewCalendar({
  interviews,
  onSelect,
}: {
  interviews: any[];
  onSelect?: (event: any) => void;
}) {
  const events = useMemo(() => {
    return interviews
      .filter((i) => i.scheduled_at)
      .map((i) => ({
        title: `${i.company_name} – ${i.stage_name}`,
        start: new Date(i.scheduled_at),
        end: new Date(new Date(i.scheduled_at).getTime() + 60 * 60 * 1000),
        resource: i,
      }));
  }, [interviews]);

  return (
    <div className="border rounded-md bg-white">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        onSelectEvent={(event) => onSelect?.(event.resource)}
      />
    </div>
  );
}
