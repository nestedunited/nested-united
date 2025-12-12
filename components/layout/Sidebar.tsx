"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, Wrench, Users, LayoutDashboard, Globe, ClipboardCheck, Calendar, Info, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User, UserRole } from "@/lib/types/database";

interface SidebarProps {
  user: User;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    label: "لوحة التحكم",
    href: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["super_admin", "admin"],
  },
  {
    label: "الحسابات",
    href: "/dashboard/accounts",
    icon: Home,
    allowedRoles: ["super_admin", "admin"],
  },
  {
    label: "الوحدات",
    href: "/dashboard/units",
    icon: Building2,
    allowedRoles: ["super_admin", "admin"],
  },
  {
    label: "جاهزية الوحدات",
    href: "/dashboard/unit-readiness",
    icon: ClipboardCheck,
    allowedRoles: ["super_admin", "admin"],
  },
  {
    label: "الحجوزات",
    href: "/dashboard/bookings",
    icon: Calendar,
    allowedRoles: ["super_admin", "admin"],
  },
  {
    label: "الصيانة",
    href: "/dashboard/maintenance",
    icon: Wrench,
    // All roles can see maintenance
  },
  {
    label: "حسابات المتصفح",
    href: "/dashboard/browser-accounts",
    icon: Globe,
    allowedRoles: ["super_admin", "admin"],
  },
  {
    label: "المستخدمون",
    href: "/dashboard/users",
    icon: Users,
    allowedRoles: ["super_admin"],
  },
  {
    label: "سجل الأنشطة",
    href: "/dashboard/activity-logs",
    icon: FileText,
    allowedRoles: ["super_admin"],
  },
  {
    label: "حول التطبيق",
    href: "/about",
    icon: Info,
    // All roles can see about page
  },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter((item) => {
    // If no allowedRoles specified, all roles can see it
    if (!item.allowedRoles) {
      return true;
    }
    return item.allowedRoles.includes(user.role);
  });

  return (
    <aside className="w-64 bg-white border-l border-gray-200 min-h-screen p-4">
      <nav className="space-y-2">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}



