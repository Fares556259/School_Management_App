"use client";

import { useState, useEffect } from "react";
import AISchedulerIntro from "./AISchedulerIntro";

export default function AISchedulerWrapper({ children }: { children: React.ReactNode }) {
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean>(false);

  const handleIntroComplete = () => {
    setHasSeenIntro(true);
  };

  if (!hasSeenIntro) {
    return <AISchedulerIntro onComplete={handleIntroComplete} />;
  }

  return <>{children}</>;
}
