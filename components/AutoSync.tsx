"use client";

import { useEffect, useRef } from "react";

/**
 * AutoSync component - Automatically syncs calendars every 10-12 minutes
 * Runs silently in the background without showing UI feedback
 */
export function AutoSync() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    // Function to perform sync
    const performSync = async () => {
      try {
        // Only sync if at least 10 minutes have passed since last sync
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncRef.current;
        const minInterval = 10 * 60 * 1000; // 10 minutes

        if (timeSinceLastSync < minInterval) {
          console.log("[AutoSync] Skipping sync - too soon since last sync");
          return;
        }

        console.log("[AutoSync] Starting automatic sync...");
        lastSyncRef.current = now;

        const response = await fetch("/api/sync", { method: "POST" });
        const data = await response.json();

        if (data.success) {
          console.log("[AutoSync] ✅ Sync completed:", data.message);
        } else {
          console.error("[AutoSync] ❌ Sync failed:", data.error);
        }
      } catch (error) {
        console.error("[AutoSync] Error during sync:", error);
      }
    };

    // Initial sync after 1 minute (to avoid immediate sync on page load)
    const initialTimeout = setTimeout(() => {
      performSync();
    }, 60 * 1000); // 1 minute

    // Set up interval for periodic syncs
    // Random interval between 10-12 minutes (600000-720000 ms)
    const getRandomInterval = () => {
      const min = 10 * 60 * 1000; // 10 minutes
      const max = 12 * 60 * 1000; // 12 minutes
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const scheduleNextSync = () => {
      const interval = getRandomInterval();
      console.log(`[AutoSync] Next sync scheduled in ${Math.round(interval / 1000 / 60)} minutes`);
      
      intervalRef.current = setTimeout(() => {
        performSync();
        scheduleNextSync(); // Schedule next sync after this one completes
      }, interval);
    };

    // Start the periodic sync cycle
    scheduleNextSync();

    // Cleanup on unmount
    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  return null; // This component doesn't render anything
}

