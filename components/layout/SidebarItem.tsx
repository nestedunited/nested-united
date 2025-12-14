"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Cache for sidebar permissions
const sidebarPermissionCache = new Map<string, { hasPermission: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Clear sidebar cache (called when permissions are updated)
export function clearSidebarCache() {
  sidebarPermissionCache.clear();
}

// Listen for permission updates
if (typeof window !== "undefined") {
  window.addEventListener("permissions-updated", () => {
    clearSidebarCache();
  });
}

export function SidebarItem({ label, href, icon: Icon }: SidebarItemProps) {
  const pathname = usePathname();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const isActive = pathname === href;

  useEffect(() => {
    const checkPermission = async () => {
      // Check cache first
      const cacheKey = `sidebar:${href}`;
      const cached = sidebarPermissionCache.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        setHasPermission(cached.hasPermission);
        return;
      }

      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          setHasPermission(false);
          return;
        }

        // Check permission via API
        const response = await fetch(
          `/api/permissions/check?page_path=${encodeURIComponent(href)}&action=view`
        );
        
        if (response.ok) {
          const data = await response.json();
          const hasPerm = data.hasPermission || false;
          
          // Cache the result
          sidebarPermissionCache.set(cacheKey, {
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

    checkPermission();
  }, [href]);

  // Don't render if no permission
  if (hasPermission === false) {
    return null;
  }

  // Show loading state while checking permission (return null to avoid layout shift)
  if (hasPermission === null) {
    return null;
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        isActive
          ? "bg-blue-50 text-blue-600 font-medium"
          : "text-gray-700 hover:bg-gray-50"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm sm:text-base">{label}</span>
    </Link>
  );
}

