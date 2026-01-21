"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Building2, Wrench, Users, LayoutDashboard, Globe, ClipboardCheck, Calendar, Info, FileText, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types/database";
import { SidebarItem } from "./SidebarItem";

interface SidebarProps {
  user: User;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    label: "لوحة التحكم",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "الحسابات",
    href: "/dashboard/accounts",
    icon: Home,
  },
  {
    label: "الوحدات",
    href: "/dashboard/units",
    icon: Building2,
  },
  {
    label: "جاهزية الوحدات",
    href: "/dashboard/unit-readiness",
    icon: ClipboardCheck,
  },
  {
    label: "الحجوزات",
    href: "/dashboard/bookings",
    icon: Calendar,
  },
  {
    label: "الصيانة",
    href: "/dashboard/maintenance",
    icon: Wrench,
  },
  {
    label: "حسابات المتصفح",
    href: "/dashboard/browser-accounts",
    icon: Globe,
  },
  {
    label: "المستخدمون",
    href: "/dashboard/users",
    icon: Users,
  },
  {
    label: "سجل الأنشطة",
    href: "/dashboard/activity-logs",
    icon: FileText,
  },
  {
    label: "حول التطبيق",
    href: "/about",
    icon: Info,
  },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  // Keep state in case we want to re-enable mobile drawer later, but sidebar is rendered as static now.
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Sidebar (static - always visible) */}
      <aside
        className={cn(
          "bg-white border-l border-gray-200 min-h-screen p-4 w-64 flex-shrink-0"
        )}
      >
        <nav className="space-y-2">
          {navItems.map((item) => {
            // Only super admins can see Users and Activity Logs
            if (
              (item.href === "/dashboard/users" ||
                item.href === "/dashboard/activity-logs") &&
              user.role !== "super_admin"
            ) {
              return null;
            }

            return (
              <div key={item.href}>
                <SidebarItem {...item} />
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}



