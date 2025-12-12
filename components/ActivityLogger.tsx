"use client";

import { useActivityLog } from "@/lib/hooks/useActivityLog";

export function ActivityLogger() {
  useActivityLog();
  return null;
}

