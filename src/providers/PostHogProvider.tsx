'use client';
import { ReactNode } from 'react';
// Analytics collection is disabled while privacy declarations and retention are reviewed.
export function PostHogProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
