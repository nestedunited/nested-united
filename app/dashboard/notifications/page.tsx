import { createClient } from "@/lib/supabase/server";
import { Bell } from "lucide-react";
import { NotificationItem } from "./NotificationItem";
import { MarkAllReadButton } from "./MarkAllReadButton";
import { getCurrentUser } from "@/lib/auth";

async function getNotifications() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return [];
  }

  // Get notifications for current user:
  // 1. Notifications specifically sent to this user (recipient_user_id = current user)
  // 2. General notifications based on audience (all_users, all_admins, etc.)
  
  let query = supabase
    .from("notifications")
    .select(`*, unit:units(unit_name)`)
    .eq("recipient_user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: userSpecificNotifications } = await query;

  // Also get general notifications based on audience
  const audienceConditions = ["all_users"];
  if (currentUser.role === "admin" || currentUser.role === "super_admin") {
    audienceConditions.push("all_admins");
  }
  if (currentUser.role === "super_admin") {
    audienceConditions.push("all_super_admins");
  }

  const { data: generalNotifications } = await supabase
    .from("notifications")
    .select(`*, unit:units(unit_name)`)
    .in("audience", audienceConditions)
    .is("recipient_user_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  // Combine and deduplicate
  const allNotifications = [
    ...(userSpecificNotifications || []),
    ...(generalNotifications || []),
  ];

  // Remove duplicates based on id
  const uniqueNotifications = Array.from(
    new Map(allNotifications.map((n) => [n.id, n])).values()
  );

  return uniqueNotifications.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const unread = notifications.filter((n) => !n.is_read);
  const read = notifications.filter((n) => n.is_read);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الإشعارات</h1>
          <p className="text-gray-600 mt-1">جميع الإشعارات والتحديثات</p>
        </div>
        {unread.length > 0 && <MarkAllReadButton />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-blue-500">
          <p className="text-gray-600 text-sm">غير مقروءة</p>
          <p className="text-3xl font-bold">{unread.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-gray-300">
          <p className="text-gray-600 text-sm">مقروءة</p>
          <p className="text-3xl font-bold">{read.length}</p>
        </div>
      </div>

      {/* Unread Notifications */}
      {unread.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold text-lg">غير مقروءة ({unread.length})</h2>
          </div>
          <div className="divide-y">
            {unread.map((notif) => (
              <NotificationItem key={notif.id} notification={notif} />
            ))}
          </div>
        </div>
      )}

      {/* Read Notifications */}
      {read.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold text-lg text-gray-500">مقروءة ({read.length})</h2>
          </div>
          <div className="divide-y opacity-75">
            {read.map((notif) => (
              <NotificationItem key={notif.id} notification={notif} />
            ))}
          </div>
        </div>
      )}

      {notifications.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">لا توجد إشعارات</p>
        </div>
      )}
    </div>
  );
}
