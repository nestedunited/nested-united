"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface PermissionGuardProps {
  children: React.ReactNode;
  action: "view" | "edit";
  fallback?: React.ReactNode;
}

export function PermissionGuard({ children, action, fallback = null }: PermissionGuardProps) {
  const pathname = usePathname();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermission();
  }, [pathname, action]);

  const checkPermission = async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      setHasPermission(false);
      return;
    }

    try {
      const response = await fetch(`/api/permissions/check?page_path=${encodeURIComponent(pathname)}&action=${action}`);
      if (response.ok) {
        const data = await response.json();
        setHasPermission(data.hasPermission);
      } else {
        setHasPermission(false);
      }
    } catch (error) {
      console.error("Error checking permission:", error);
      setHasPermission(false);
    }
  };

  if (hasPermission === null) {
    return null; // Loading state
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}


