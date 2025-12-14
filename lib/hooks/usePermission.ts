"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Cache permissions in memory to reduce API calls
const permissionCache = new Map<string, { hasPermission: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function usePermission(action: "view" | "edit") {
  const pathname = usePathname();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermission();
  }, [pathname, action]);

  const checkPermission = async () => {
    if (!pathname) {
      setHasPermission(false);
      return;
    }

    // Check cache first
    const cacheKey = `${pathname}:${action}`;
    const cached = permissionCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setHasPermission(cached.hasPermission);
      return;
    }

    try {
      const response = await fetch(
        `/api/permissions/check?page_path=${encodeURIComponent(pathname)}&action=${action}`
      );
      if (response.ok) {
        const data = await response.json();
        const hasPerm = data.hasPermission;
        
        // Cache the result
        permissionCache.set(cacheKey, {
          hasPermission: hasPerm,
          timestamp: now,
        });
        
        setHasPermission(hasPerm);
      } else {
        setHasPermission(false);
      }
    } catch (error) {
      console.error("Error checking permission:", error);
      setHasPermission(false);
    }
  };

  return hasPermission;
}

