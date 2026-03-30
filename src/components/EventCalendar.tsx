import Image from "next/image";
import prisma from "@/lib/prisma";
import EventCalendarClient from "./EventCalendarClient";

const EventCalendar = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const dateParam = searchParams?.date;
  const selectedDate = dateParam ? new Date(dateParam) : new Date();

  // Start and end of the selected day
  const start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(selectedDate);
  end.setHours(23, 59, 59, 999);

  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: start, lte: end },
    },
    orderBy: { startTime: "asc" },
    take: 10,
  });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="glass-card p-6 rounded-3xl">
      <EventCalendarClient />

      <div className="flex items-center justify-between my-6">
        <h1 className="text-xl font-bold text-slate-800">
          Timeline —{" "}
          <span className="text-indigo-500 font-semibold">
            {selectedDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </h1>
        <div className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
          <Image src="/moreDark.png" alt="" width={20} height={20} className="opacity-40" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm font-medium">No events for this day.</p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h1 className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors leading-snug">
                  {event.title}
                </h1>
                <span className="text-slate-400 font-semibold text-[10px] bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm whitespace-nowrap shrink-0">
                  {formatTime(event.startTime)} – {formatTime(event.endTime)}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                {event.description}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventCalendar;
