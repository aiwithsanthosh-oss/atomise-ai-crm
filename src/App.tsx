import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "./components/theme-provider";

// Pages
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Pipeline from "./pages/Pipeline";
import Tasks from "./pages/Tasks";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Campaigns from "./pages/Campaigns";
import Onboarding from "./pages/Onboarding";
import Appointments from "./pages/Appointments";

const queryClient = new QueryClient();

// ─── Role Guard ───────────────────────────────────────────────────────────────
// Wraps any route that should only be accessible by specific roles.
// If the user's role is not in `allowedRoles`, redirect to "/" instead.
// Shows nothing while role is still loading to prevent content flash.

function RoleGuard({
  allowedRoles,
  userRole,
  roleLoading,
}: {
  allowedRoles: string[];
  userRole: string | null;
  roleLoading: boolean;
}) {
  // While fetching role from Supabase, render nothing (prevents flash)
  if (roleLoading) return null;

  // Role loaded — check permission
  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => {
  const [session, setSession]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [userRole, setUserRole]     = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // ── Auth session listener ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (!session) {
        // Logged out — clear role
        setUserRole(null);
        setRoleLoading(false);
      } else {
        // Logged in — immediately set roleLoading true
        // so routes don't render before role is fetched
        setRoleLoading(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch role once session is established ─────────────────────────────────
  useEffect(() => {
    if (!session?.user) {
      setRoleLoading(false);
      return;
    }
    const fetchRole = async () => {
      setRoleLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setUserRole(data?.role || "sales"); // default to sales (least privilege)
      setRoleLoading(false);
    };
    fetchRole();
  }, [session]);

  // ── Loading screen ─────────────────────────────────────────────────────────
  // Show spinner while:
  // 1. Initial auth session is being checked (loading)
  // 2. Session exists but role is still being fetched (roleLoading)
  // This prevents the brief 404 flash between login and dashboard render
  if (loading || (session && roleLoading)) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center text-foreground font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading Atomise CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="atomise-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {!session ? (
                // ── PUBLIC: unauthenticated users ──────────────────────────
                <>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="*" element={<Navigate to="/auth" replace />} />
                </>
              ) : (
                // ── PROTECTED: authenticated users inside AppLayout ─────────
                <Route element={<AppLayout userRole={userRole} children={<Outlet />} />}>

                  {/* ── Accessible by ALL roles ── */}
                  <Route path="/"             element={<Dashboard />} />
                  <Route path="/contacts"     element={<Contacts />} />
                  <Route path="/tasks"        element={<Tasks />} />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/onboarding"   element={<Onboarding />} />

                  {/* ── Admin only routes ── */}
                  <Route element={
                    <RoleGuard
                      allowedRoles={["admin"]}
                      userRole={userRole}
                      roleLoading={roleLoading}
                    />
                  }>
                    <Route path="/pipeline"  element={<Pipeline />} />
                    <Route path="/settings"  element={<Settings />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Route>
              )}
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;