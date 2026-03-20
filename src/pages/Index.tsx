import { Users, DollarSign, TrendingUp, CheckCircle, UserPlus, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

type ActivityItem = { id: string; name: string; type: "contact" | "deal"; created_at: string; };

const STAGE_COLORS: Record<string, string> = {
  Lead: "#60a5fa",
  Qualified: "#a78bfa",
  Proposal: "#f59e0b",
  Negotiation: "#facc15",
  Closed: "#10b981",
};

const Dashboard = () => {
  // ... Queries remain exactly same for performance integrity ...
  const { data: contactsCount } = useQuery({
    queryKey: ["contacts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("contacts").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: totalRevenue } = useQuery({
    queryKey: ["revenue"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("value");
      return (data || []).reduce((acc, deal) => acc + (parseFloat(deal.value.replace(/[^0-9.-]+/g, "")) || 0), 0);
    },
  });

  const { data: tasksDoneCount } = useQuery({
    queryKey: ["tasks-done-count"],
    queryFn: async () => {
      const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed");
      return count || 0;
    },
  });

  const { data: conversionRate } = useQuery({
    queryKey: ["conversion-rate"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("stage");
      const totalDeals = data?.length ?? 0;
      return totalDeals ? ((data || []).filter((d) => d.stage === "Closed").length / totalDeals) * 100 : 0;
    },
  });

  const { data: pipelineData = [] } = useQuery({
    queryKey: ["pipeline-chart"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("stage");
      const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed"];
      const counts: Record<string, number> = {};
      stages.forEach((s) => (counts[s] = 0));
      (data || []).forEach((d) => { if (counts[d.stage] !== undefined) counts[d.stage]++; });
      return stages.map((s) => ({ stage: s, deals: counts[s] }));
    },
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const [contactsRes, dealsRes] = await Promise.all([
        supabase.from("contacts").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("deals").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      const contacts = (contactsRes.data || []).map((c) => ({ ...c, type: "contact" as const }));
      const deals = (dealsRes.data || []).map((d) => ({ ...d, type: "deal" as const }));
      return [...contacts, ...deals].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    },
  });

  const kpis = [
    { label: "Total Leads", value: contactsCount?.toLocaleString() || "0", icon: Users },
    { label: "Revenue", value: `$${(totalRevenue || 0).toLocaleString()}`, icon: DollarSign },
    { label: "Conversion", value: `${(conversionRate ?? 0).toFixed(1)}%`, icon: TrendingUp },
    { label: "Tasks Done", value: tasksDoneCount?.toLocaleString() || "0", icon: CheckCircle },
  ];

  return (
    <div className="p-8 space-y-10 font-sans bg-[#0a0a0a] min-h-screen">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-4xl font-display font-bold tracking-tight text-white">Intelligence Center</h1>
        <p className="text-muted-foreground font-medium mt-1">Welcome back to Atomise CRM</p>
      </motion.div>

      {/* KPI SECTION WITH HEAVY AI GLOW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
            whileHover={{ y: -8 }}
            className="group relative"
          >
            {/* The "Glow Backdrop" - Becomes visible on hover */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-0 group-hover:opacity-40 transition duration-500 group-hover:duration-200"></div>
            
            <div className="relative glass-card rounded-2xl p-6 space-y-4 border border-white/10 bg-card/60 backdrop-blur-xl shadow-2xl flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60 group-hover:text-primary transition-colors">{stat.label}</span>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-display font-bold text-white tabular-nums group-hover:drop-shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-all">
                  {stat.value}
                </span>
                {/* Visual "Pulse" line under number */}
                <div className="h-0.5 w-0 group-hover:w-full bg-primary transition-all duration-500 rounded-full" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline Chart - Branded with custom visibility fix */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
          className="glass-card rounded-3xl p-8 h-[450px] flex flex-col border border-white/5 shadow-3xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <TrendingUp className="h-24 w-24 text-primary" />
          </div>
          <h3 className="text-xl font-display font-bold mb-10 text-white tracking-tight">Pipeline Velocity</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 5, right: 30, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="stage" tick={{ fill: "#888", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} tickMargin={15} />
                <YAxis allowDecimals={false} tick={{ fill: "#666", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
                  contentStyle={{ 
                    backgroundColor: "#050505", 
                    border: "1px solid rgba(139, 92, 246, 0.4)", 
                    borderRadius: "16px", 
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                  }}
                  labelStyle={{ fontWeight: 900, color: '#fff', marginBottom: '8px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}
                  itemStyle={{ color: '#8B5CF6', fontWeight: 700 }}
                />
                <Bar dataKey="deals" radius={[10, 10, 0, 0]} barSize={40}>
                  {pipelineData.map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] || "#8B5CF6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Real-time activity - Modern tech look */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
          className="glass-card rounded-3xl p-8 h-[450px] flex flex-col border border-white/5 shadow-3xl"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-display font-bold text-white tracking-tight">Intelligence Stream</h3>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
               <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
               <span className="text-[9px] font-black uppercase tracking-widest text-primary">Live</span>
            </div>
          </div>
          <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {recentActivity.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-5 group/item">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 transition-all duration-300 group-hover/item:border-primary/50 group-hover/item:shadow-[0_0_15px_rgba(139,92,246,0.3)] ${
                  item.type === "contact" ? "bg-blue-500/5 text-blue-400" : "bg-emerald-500/5 text-emerald-400"
                }`}>
                  {item.type === "contact" ? <UserPlus className="h-5 w-5" /> : <Handshake className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-white/90 group-hover/item:text-primary transition-colors truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground/60 font-medium">
                    {item.type === "contact" ? "New Lead Identified" : "Deal Pipeline Updated"} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;