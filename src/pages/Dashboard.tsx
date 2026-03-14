import { Users, DollarSign, TrendingUp, CheckCircle, UserPlus, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

type ActivityItem = {
  id: string;
  name: string;
  type: "contact" | "deal";
  created_at: string;
};

const Dashboard = () => {
  const { data: contactsCount } = useQuery({
    queryKey: ["contacts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalRevenue } = useQuery({
    queryKey: ["revenue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("value");
      if (error) throw error;
      const sum = (data || []).reduce((acc, deal) => {
        const value = parseFloat(deal.value.replace(/[^0-9.-]+/g, "")) || 0;
        return acc + value;
      }, 0);
      return sum;
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const [contactsRes, dealsRes] = await Promise.all([
        supabase.from("contacts").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("deals").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      if (contactsRes.error) throw contactsRes.error;
      if (dealsRes.error) throw dealsRes.error;

      const contacts: ActivityItem[] = (contactsRes.data || []).map((c) => ({ ...c, type: "contact" as const }));
      const deals: ActivityItem[] = (dealsRes.data || []).map((d) => ({ ...d, type: "deal" as const }));

      return [...contacts, ...deals]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    },
  });

  const stats = [
    { label: "Total Leads", value: contactsCount?.toLocaleString() || "0", icon: Users, change: "+12.5%" },
    { label: "Revenue", value: `$${(totalRevenue || 0).toLocaleString()}`, icon: DollarSign, change: "+8.2%" },
    { label: "Conversion", value: "24.3%", icon: TrendingUp, change: "+3.1%" },
    { label: "Tasks Done", value: "156", icon: CheckCircle, change: "+18.7%" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back to Atomise CRM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card rounded-lg border border-border p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-display font-bold">{stat.value}</span>
              <span className="text-xs text-emerald-400 mb-1">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border border-border p-5 h-64 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Pipeline Overview Chart</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-5 h-64 flex flex-col">
          <h3 className="text-sm font-display font-semibold mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1">
              {recentActivity.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                    item.type === "contact"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {item.type === "contact" ? (
                      <UserPlus className="h-4 w-4" />
                    ) : (
                      <Handshake className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type === "contact" ? "Lead" : "Deal"} added{" "}
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
