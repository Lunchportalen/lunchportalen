"use client";

// STATUS: ARCHIVE

import { useState } from "react";
import WeekPreview from "./WeekPreview";
import NextWeekOrderClient from "./NextWeekOrderClient";

export default function TodayView() {
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  return (
    <>
      <WeekPreview onWeekOffsetChange={setWeekOffset} />
      {weekOffset === 1 ? <NextWeekOrderClient /> : null}
    </>
  );
}
