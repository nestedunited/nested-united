import { createClient } from "./supabase/server";

export type UserRole = "super_admin" | "admin" | "maintenance_worker";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  is_active: boolean;
  created_at: string;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!userData || !userData.is_active) {
    return null;
  }

  return userData as AppUser;
}

export async function requireAuth(): Promise<AppUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }
  
  return user;
}

export async function requireSuperAdmin(): Promise<AppUser> {
  const user = await requireAuth();
  
  if (user.role !== "super_admin") {
    throw new Error("Forbidden: Super admin access required");
  }
  
  return user;
}

export function isSuperAdmin(user: AppUser | null): boolean {
  return user?.role === "super_admin";
}

export function isAdmin(user: AppUser | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}

export function isMaintenanceWorker(user: AppUser | null): boolean {
  return user?.role === "maintenance_worker";
}

export function canManageUnits(user: AppUser | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}

export function canManageMaintenance(user: AppUser | null): boolean {
  // All roles can interact with maintenance (workers can accept/update their tickets)
  return user !== null;
}



