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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg p-2 shadow-lg"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white border-l border-gray-200 min-h-screen p-4 fixed lg:static inset-y-0 right-0 z-40 transform transition-transform duration-300 ease-in-out",
          "w-64",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <nav className="space-y-2 pt-12 lg:pt-0">
          {navItems.map((item) => (
            <div key={item.href} onClick={() => setIsOpen(false)}>
              <SidebarItem {...item} />
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}



