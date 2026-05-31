"use client";

import { useState, useEffect } from "react";
import AISchedulerIntro from "./AISchedulerIntro";

export default function AISchedulerWrapper({ children }: { children: React.ReactNode }) {
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if the user has already seen the intro
    const seen = localStorage.getItem("hasSeenAiIntro") === "true";
    setHasSeenIntro(seen);
  }, []);

  const handleIntroComplete = () => {
    localStorage.setItem("hasSeenAiIntro", "true");
    setHasSeenIntro(true);
  };

  // Prevent hydration mismatch by not rendering anything until mounted
  if (hasSeenIntro === null) return null;

  if (!hasSeenIntro) {
    return <AISchedulerIntro onComplete={handleIntroComplete} />;
  }

  return <>{children}</>;
}
