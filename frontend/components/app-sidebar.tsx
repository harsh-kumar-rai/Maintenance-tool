"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Cog,
  Sparkles,
  ClipboardList,
  BookOpen,
  Wrench,
  FileText,
  Loader2,
  TriangleAlert,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Equipment", href: "/equipment", icon: Cog },
  { title: "AI Investigation", href: "/investigation", icon: Sparkles },
  { title: "Planner", href: "/planner", icon: ClipboardList },
  { title: "Predictions", href: "/predictions", icon: TriangleAlert },
  { title: "Knowledge Base", href: "/knowledge", icon: BookOpen },
  { title: "Reports & Logbook", href: "/reports", icon: FileText },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // Clear the pending indicator once the route has actually changed
  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#1B589E] text-white">
            <Wrench className="size-5" />
          </div>
          <span className="text-sm font-semibold text-sidebar-accent-foreground">
            Maintenance Tool
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href)
                const pending = pendingHref === item.href && !active
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={item.href}
                          onClick={() => {
                            if (!active) setPendingHref(item.href)
                          }}
                        />
                      }
                      isActive={active}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {pending && (
                        <Loader2
                          className="ml-auto size-3.5 animate-spin text-sidebar-foreground/60"
                          aria-label="Loading page"
                        />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  )
}
