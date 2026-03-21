import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Kanban, CheckSquare, Settings, LogOut, Megaphone, ClipboardList, CalendarDays } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

// ─── Nav items with role permissions ─────────────────────────────────────────
// admin  → all pages
// sales  → dashboard, contacts, tasks only

const navItems = [
  { title: "Dashboard", url: "/",         icon: LayoutDashboard, roles: ["admin", "sales"] },
  { title: "Contacts",  url: "/contacts", icon: Users,           roles: ["admin", "sales"] },
  { title: "Pipeline",  url: "/pipeline", icon: Kanban,          roles: ["admin"]           },
  { title: "Tasks",     url: "/tasks",    icon: CheckSquare,     roles: ["admin", "sales"] },
  { title: "Campaigns",  url: "/campaigns", icon: Megaphone,       roles: ["admin"]           },
  { title: "Onboarding",   url: "/onboarding",   icon: ClipboardList, roles: ["admin", "sales"] },
  { title: "Appointments",  url: "/appointments", icon: CalendarDays,  roles: ["admin", "sales"] },
];

type Props = { userRole: string | null };

export function AppSidebar({ userRole }: Props) {
  const { state } = useSidebar();
  const location  = useLocation();
  const navigate  = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // While role is loading, show empty nav (prevents flash of wrong items)
  const role = userRole ?? "";

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border glass-card z-50">
      <div className="flex h-full flex-col">

        {/* ── BRANDING HEADER ── */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border transition-all duration-300 shrink-0">
          <div className="h-11 w-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20" style={{ boxShadow: "0 0 12px hsl(262 83% 58% / 0.2)" }}>
            <img
              src="/logo.png"
              alt="Logo"
              className="h-full w-full object-contain p-0.5"
              onError={(e) => {
                e.currentTarget.src = "https://ui-avatars.com/api/?name=A&background=7c3aed&color=fff&size=128";
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-foreground text-sm md:text-base leading-tight tracking-tight">
              Atomise AI
            </span>
            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-widest leading-none mt-0.5">
              CRM
            </span>
          </div>
        </div>

        {/* ── MAIN NAV ── */}
        <SidebarContent className="flex-1 pt-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  if (!item.roles.includes(role)) return null;
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                            isActive
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-medium">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── FOOTER ── */}
        <SidebarFooter className="shrink-0 border-t border-border p-2">
          <SidebarMenu>

            {/* Settings — Admin only */}
            {role === "admin" && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/settings")}
                  className={`w-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all ${
                    location.pathname === "/settings" ? "bg-muted text-foreground" : ""
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {/* Logout — all roles */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="w-full hover:bg-red-500/10 text-red-500 transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

          </SidebarMenu>
        </SidebarFooter>

      </div>
    </Sidebar>
  );
}