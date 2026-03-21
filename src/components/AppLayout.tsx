import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { User, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

// userRole is passed down from App.tsx — single source of truth
export function AppLayout({
  children,
  userRole,
}: {
  children: React.ReactNode;
  userRole: string | null;
}) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    };
    getUser();
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <SidebarProvider>
      {/* h-screen + overflow-hidden here — ONE scroll context for the whole app */}
      <div className="h-screen flex w-full bg-background transition-colors duration-300 overflow-hidden">
        <AppSidebar userRole={userRole} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Fixed header — never scrolls */}
          <header className="h-14 shrink-0 flex items-center justify-between border-b border-border px-4 bg-card/50 backdrop-blur-md z-50">
            <div className="flex items-center">
              <SidebarTrigger />
            </div>

            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                title="Toggle Theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-[1.2rem] w-[1.2rem]" />
                ) : (
                  <Moon className="h-[1.2rem] w-[1.2rem]" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>

              <div className="h-4 w-[1px] bg-border mx-1" />

              {/* User info */}
              <div className="flex items-center gap-3">
                {userEmail && (
                  <span className="text-xs text-muted-foreground hidden md:inline-block">
                    {userEmail}
                  </span>
                )}
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
          </header>

          {/* Page content — fills remaining height, no overflow here.
              Each page (Dashboard, Contacts, Pipeline, Tasks) manages
              its own internal scroll so there is only ONE scrollbar. */}
          <main className="flex-1 overflow-hidden overflow-y-auto bg-background">
            {children}
          </main>

        </div>
      </div>
    </SidebarProvider>
  );
}