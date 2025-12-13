import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { ElectronNotificationHandler } from "@/components/ElectronNotificationHandler";
import { NotificationManager } from "@/components/NotificationManager";
import { ActivityLogger } from "@/components/ActivityLogger";
import { AutoSync } from "@/components/AutoSync";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // Get current auth user
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  if (!authUser) {
    redirect("/login");
  }

  // Get user data from users table
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!user || !user.is_active) {
    redirect("/login");
  }

  // Get unread notifications count
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  const unreadCount = count || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <ElectronNotificationHandler />
      <NotificationManager />
      <ActivityLogger />
      <AutoSync />
      <Header user={user} unreadCount={unreadCount} />
      <TabBar />
      <div className="flex flex-col lg:flex-row">
        <Sidebar user={user} />
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
