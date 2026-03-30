"use client";

import Image from "next/image";
import { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useRouter } from "next/navigation";

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

const EventCalendarClient = () => {
  const [value, onChange] = useState<Value>(new Date());
  const router = useRouter();

  const handleDateChange = (val: Value) => {
    onChange(val);
    if (val instanceof Date) {
      const formatted = val.toISOString().split("T")[0]; // YYYY-MM-DD
      router.push(`?date=${formatted}`);
    }
  };

  return (
    <div>
      <Calendar onChange={handleDateChange} value={value} />
    </div>
  );
};

export default EventCalendarClient;
