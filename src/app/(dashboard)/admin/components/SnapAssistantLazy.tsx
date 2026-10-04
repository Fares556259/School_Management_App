"use client";

import dynamic from "next/dynamic";

const SnapAssistant = dynamic(() => import("./SnapAssistant"), {
  ssr: false,
  loading: () => null,
});

export default SnapAssistant;
