import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

// Server-side cache for permissions (in-memory, resets on server restart)
const serverPermissionCache = new Map<string, { result: boolean; timestamp: number }>();
const SERVER_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Clear cache for a specific user (called when permissions are updated)
export function clearPermissionCacheForUser(userId: string) {
  const keysToDelete: string[] = [];
  for (const key of serverPermissionCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => serverPermissionCache.delete(key));
}

export async function checkUserPermission(
  userId: string,
  pagePath: string,
  action: "view" | "edit"
): Promise<boolean> {
  // Check server-side cache first
  const cacheKey = `${userId}:${pagePath}:${action}`;
  const cached = serverPermissionCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < SERVER_CACHE_DURATION) {
    return cached.result;
  }

  const supabase = await createClient();

  // Get user role and permission in parallel to reduce queries
  const [userResult, permissionResult] = await Promise.all([
    supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_permissions")
      .select("*")
      .eq("user_id", userId)
      .eq("page_path", pagePath)
      .single(),
  ]);

  const user = userResult.data;
  const permission = permissionResult.data;

  if (!user) {
    serverPermissionCache.set(cacheKey, { result: false, timestamp: now });
    return false;
  }

  // Super admins have all permissions - can do everything
  if (user.role === "super_admin") {
    serverPermissionCache.set(cacheKey, { result: true, timestamp: now });
    return true;
  }

  // For maintenance workers, check permissions table first
  // If a permission exists in the database, use it
  // Otherwise, give them default access to maintenance + unit readiness pages
  if (user.role === "maintenance_worker") {
    if (permission) {
      // Permission exists in database, use it
      let result: boolean;
      if (action === "view") {
        result = permission.can_view;
      } else {
        result = permission.can_edit && permission.can_view;
      }
      serverPermissionCache.set(cacheKey, { result, timestamp: now });
      return result;
    } else {
      // No permission in database, use default:
      // - /dashboard/maintenance
      // - /dashboard/unit-readiness
      const defaultPages = ["/dashboard/maintenance", "/dashboard/unit-readiness"];
      const canView = defaultPages.includes(pagePath);
      const canEdit = canView; // السماح بالتعديل في الصفحتين بشكل افتراضي
      const result = action === "view" ? canView : canEdit;
      serverPermissionCache.set(cacheKey, { result, timestamp: now });
      return result;
    }
  }

  // For admins, check permissions table
  if (!permission) {
    // إذا لم يكن هناك صلاحيات محددة في الجدول، نعطي المدراء (admin) صلاحية كاملة افتراضيًا
    if (user.role === "admin") {
      serverPermissionCache.set(cacheKey, { result: true, timestamp: now });
      return true;
    }

    // أي دور آخر بدون صلاحية صريحة → رفض
    serverPermissionCache.set(cacheKey, { result: false, timestamp: now });
    return false;
  }

  let result: boolean;
  if (action === "view") {
    result = permission.can_view;
  } else {
    result = permission.can_edit && permission.can_view;
  }

  serverPermissionCache.set(cacheKey, { result, timestamp: now });
  return result;
}

// Only log important actions, not page views
const IMPORTANT_ACTIONS = ["create", "update", "delete", "export"];

export async function logActivityInServer(data: {
  userId: string;
  action_type: string;
  page_path?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  description?: string | null;
  metadata?: any;
}) {
  // Skip logging page views to reduce database load
  // Only log important actions (create, update, delete, export)
  if (data.action_type === "page_view") {
    return;
  }

  // Only log if it's an important action
  if (!IMPORTANT_ACTIONS.includes(data.action_type)) {
    return;
  }

  const supabase = await createClient();

  // Get IP and user agent from request (if available)
  // For now, we'll just log without IP/user agent in server context
  const { error } = await supabase.from("user_activity_logs").insert({
    user_id: data.userId,
    action_type: data.action_type,
    page_path: data.page_path,
    resource_type: data.resource_type,
    resource_id: data.resource_id,
    description: data.description,
    metadata: data.metadata,
  });

  if (error) {
    console.error("Failed to log activity:", error);
  }
}

