import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
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

function isRecoveryUrl(): boolean {
  const hash = window.location.hash || "";
  const params = new URLSearchParams(hash.replace("#", ""));
  if (params.get("type") === "recovery") return true;
  if (params.get("error") === "access_denied") return true;
  if (params.get("error_code") === "otp_expired") return true;
  const search = window.location.search || "";
  const searchParams = new URLSearchParams(search);
  if (searchParams.get("type") === "recovery") return true;
  return false;
}

const INITIAL_IS_RECOVERY = isRecoveryUrl();

function RoleGuard({
  allowedRoles,
  userRole,
  roleLoading,
}: {
  allowedRoles: string[];
  userRole: string | null;
  roleLoading: boolean;
}) {
  if (roleLoading) return null;
  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function SaveAndRedirect() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    if (path !== "/auth" && path !== "/") {
      sessionStorage.setItem("intended_url", path);
    }
  }, [location]);
  return <Navigate to="/auth" replace />;
}

function AppRoutes({ session, loading, userRole, roleLoading, isRecovery }: {
  session: any;
  loading: boolean;
  userRole: string | null;
  roleLoading: boolean;
  isRecovery: boolean;
}) {
  const isFullyReady = !loading && !roleLoading;

  if (!isFullyReady && !isRecovery) {
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
    <Routes>
      {isRecovery ? (
        <Route path="*" element={<Auth />} />
      ) : !session ? (
        <>
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<SaveAndRedirect />} />
        </>
      ) : (
        <Route element={<AppLayout userRole={userRole} children={<Outlet />} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/pipeline" element={<Pipeline />} />

          <Route
            element={
              <RoleGuard
                allowedRoles={["admin"]}
                userRole={userRole}
                roleLoading={roleLoading}
              />
            }
          >
            <Route path="/settings" element={<Settings />} />
            <Route path="/campaigns" element={<Campaigns />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      )}
    </Routes>
  );
}

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(INITIAL_IS_RECOVERY);

  useEffect(() => {
    if (INITIAL_IS_RECOVERY) {
      setLoading(false);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setSession(session);
        setRoleLoading(false);
        setLoading(false);
        return;
      }

      if (_event === "SIGNED_IN" && INITIAL_IS_RECOVERY) {
        setIsRecovery(true);
        setSession(session);
        setRoleLoading(false);
        setLoading(false);
        return;
      }

      setSession(session);
      setLoading(false);

      if (!session) {
        setUserRole(null);
        setRoleLoading(false);
        setIsRecovery(false);
      } else {
        setRoleLoading(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setRoleLoading(false);
      return;
    }
    if (isRecovery) {
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
      setUserRole(data?.role || "sales");
      setRoleLoading(false);
    };
    fetchRole();
  }, [session, isRecovery]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="atomise-ui-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes
              session={session}
              loading={loading}
              userRole={userRole}
              roleLoading={roleLoading}
              isRecovery={isRecovery}
            />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;