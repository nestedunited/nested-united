"use client";

import { Bell, LogOut, User as UserIcon, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import type { User } from "@/lib/types/database";

interface HeaderProps {
  user: User;
  unreadCount?: number;
}

export function Header({ user, unreadCount: initialUnreadCount = 0 }: HeaderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    // Listen for unread count updates from NotificationManager
    const handleUnreadCountUpdate = (event: CustomEvent<{ count: number }>) => {
      setUnreadCount(event.detail.count);
    };

    window.addEventListener("unread-count-updated", handleUnreadCountUpdate as EventListener);

    return () => {
      window.removeEventListener("unread-count-updated", handleUnreadCountUpdate as EventListener);
    };
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const roleLabel = user.role === "super_admin" ? "مشرف أعلى" : "مشرف";

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center overflow-hidden bg-white border border-gray-200 flex-shrink-0">
            {logoError ? (
              <div className="bg-blue-600 text-white w-full h-full flex items-center justify-center font-bold text-sm sm:text-xl">
                شعار
              </div>
            ) : (
              <img
                src="/logo.png"
                alt="شعار المنصة"
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-lg md:text-xl font-bold text-gray-900 truncate">
              لوحة التحكم
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
              Airbnb & Gathern
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
          {/* Notification Bell */}
          <button
            onClick={() => router.push("/dashboard/notifications")}
            className={`relative p-1.5 sm:p-2 rounded-lg transition-all ${
              unreadCount > 0
                ? "text-red-600 hover:bg-red-50 animate-pulse"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            title={unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات"}
          >
            <Bell className={`w-5 h-5 sm:w-6 sm:h-6 ${unreadCount > 0 ? "fill-current" : ""}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-4.5 sm:h-5 flex items-center justify-center px-1 sm:px-1.5 shadow-lg animate-bounce text-[10px] sm:text-xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* About Link */}
          <Link
            href="/about"
            className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            title="حول التطبيق"
          >
            <Info className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>

          {/* User Menu - Hidden on mobile, show on tablet+ */}
          <div className="hidden md:flex items-center gap-3 border-r pr-3 lg:pr-4">
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{user.name}</p>
              <p className="text-xs text-gray-500">{roleLabel}</p>
            </div>
            <div className="bg-blue-100 text-blue-600 w-9 h-9 lg:w-10 lg:h-10 rounded-full flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
          </div>

          {/* Sign Out Button - Icon only on mobile */}
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
}




