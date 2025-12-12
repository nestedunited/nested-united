import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { checkUserPermission } from "@/lib/permissions";

/**
 * Check if user has permission to access a page
 * Redirects to dashboard if no permission
 */
export async function requirePermission(
  pagePath: string,
  action: "view" | "edit"
): Promise<void> {
  const supabase = await createClient();
  
  // Get current auth user
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    redirect("/login");
  }

  // Check permission
  const hasPermission = await checkUserPermission(authUser.id, pagePath, action);
  
  if (!hasPermission) {
    redirect("/dashboard?error=no_permission");
  }
}

/**
 * Check if user has permission (returns boolean, doesn't redirect)
 */
export async function hasPermission(
  pagePath: string,
  action: "view" | "edit"
): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return false;
  }

  return await checkUserPermission(authUser.id, pagePath, action);
}

