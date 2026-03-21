import { useState, useRef } from "react";
import { Users, DollarSign, TrendingUp, CheckCircle, UserPlus, Handshake, CheckSquare, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { motion, useMotionValue, useTransform } from "framer-motion";

const STAGE_COLORS: Record<string, string> = {
  Lead: "#60a5fa", Qualified: "#a78bfa", Proposal: "#f59e0b", Negotiation: "#facc15", Closed: "#10b981",
};

// ─── KPI Card (unchanged) ────────────────────────────────────────────────────
const BrandedKPICard = ({ label, value, icon: Icon, delay }: any) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  const backgroundGlow = useTransform(
    [mouseX, mouseY],
    ([x, y]) => `radial-gradient(400px circle at ${x}px ${y}px, rgba(139, 92, 246, 0.25), transparent 80%)`
  );

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 15 }}
      animate={{
        opacity: 1,
        y: 0,
        x: [0, 6, 0, -6, 0],
      }}
      transition={{
        opacity: { delay, duration: 0.5 },
        y: { delay, duration: 0.5 },
        x: { duration: 8, repeat: Infinity, ease: "linear" },
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group p-[1px] rounded-[20px] overflow-hidden bg-white/5 h-[110px]"
    >
      {isHovered && (
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[-200%] bg-[conic-gradient(from_0deg,transparent_0%,#8B5CF6_40%,transparent_100%)] z-0"
        />
      )}
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: backgroundGlow }}
      />
      <div className="relative h-full card-bg rounded-[19px] p-4 flex flex-col justify-between z-20">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground/50 group-hover:text-primary transition-colors">
            {label}
          </span>
          <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all border border-border">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mb-1">
          <span className="text-2xl font-display font-bold text-foreground tabular-nums">{value}</span>
          <div className="h-[1px] w-8 bg-primary/20 rounded-full mt-2 group-hover:w-full group-hover:bg-primary transition-all duration-500" />
        </div>
      </div>
    </motion.div>
  );
};

// ─── Hover-popup panel wrapper ────────────────────────────────────────────────
const PopPanel = ({
  delay,
  children,
  className,
}: {
  delay: number;
  children: (hovered: boolean) => React.ReactNode;
  className?: string;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        y: -6,
        scale: 1.012,
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(139,92,246,0.75), 0 0 50px rgba(139,92,246,0.15)",
      }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay, duration: 0.4 } as any}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`rounded-[24px] p-5 flex flex-col border card-bg overflow-hidden cursor-default transition-colors duration-300 ${
        hovered ? "border-purple-500/60" : "border-border"
      } ${className ?? ""}`}
    >
      {children(hovered)}
    </motion.div>
  );
};

// ─── Custom label rendered above each bar ────────────────────────────────────
const BarCountLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fill="#a78bfa"
      fontSize={12}
      fontWeight={900}
      fontFamily="inherit"
    >
      {value}
    </text>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { data: contactsCount } = useQuery({ queryKey: ["contacts-count"], queryFn: async () => { const { count } = await supabase.from("contacts").select("*", { count: "exact", head: true }); return count || 0; } });
  const { data: totalRevenue } = useQuery({ queryKey: ["revenue"], queryFn: async () => { const { data } = await supabase.from("deals").select("value"); return (data || []).reduce((acc, deal) => acc + (parseFloat(deal.value.replace(/[^0-9.-]+/g, "")) || 0), 0); } });
  const { data: tasksDoneCount } = useQuery({ queryKey: ["tasks-done-count"], queryFn: async () => { const { count } = await supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "completed"); return count || 0; } });
  const { data: conversionRate } = useQuery({ queryKey: ["conversion-rate"], queryFn: async () => { const { data } = await supabase.from("deals").select("stage"); const totalDeals = data?.length ?? 0; return totalDeals ? ((data || []).filter((d) => d.stage === "Closed").length / totalDeals) * 100 : 0; } });
  const { data: pipelineData = [] } = useQuery({ queryKey: ["pipeline-chart"], queryFn: async () => { const { data } = await supabase.from("deals").select("stage"); const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed"]; const counts: Record<string, number> = {}; stages.forEach((s) => (counts[s] = 0)); (data || []).forEach((d) => { if (counts[d.stage] !== undefined) counts[d.stage]++; }); return stages.map((s) => ({ stage: s, deals: counts[s] })); } });
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const [contactsRes, dealsRes, tasksRes] = await Promise.all([
        supabase.from("contacts").select("id, name, created_at, status").order("created_at", { ascending: false }).limit(5),
        supabase.from("deals").select("id, name, created_at, stage, value").order("created_at", { ascending: false }).limit(5),
        supabase.from("tasks").select("id, title, created_at, status, priority").order("created_at", { ascending: false }).limit(5),
      ]);
      const contacts = (contactsRes.data || []).map((c) => ({
        id: c.id,
        type: "contact" as const,
        label: "New Lead Added",
        name: c.name,
        meta: c.status ? `Status: ${c.status}` : "",
        created_at: c.created_at,
      }));
      const deals = (dealsRes.data || []).map((d) => ({
        id: d.id,
        type: "deal" as const,
        label: "New Deal Created",
        name: d.name,
        meta: `${d.stage} · $${d.value}`,
        created_at: d.created_at,
      }));
      const tasks = (tasksRes.data || []).map((t) => ({
        id: t.id,
        type: t.status === "completed" ? "task_done" as const : "task" as const,
        label: t.status === "completed" ? "Task Completed" : "Task Created",
        name: t.title,
        meta: `Priority: ${t.priority ?? "medium"}`,
        created_at: t.created_at,
      }));
      return [...contacts, ...deals, ...tasks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);
    },
  });

  const kpis = [
    { label: "Total Leads",  value: contactsCount?.toLocaleString() || "0",       icon: Users       },
    { label: "Revenue",      value: `$${(totalRevenue || 0).toLocaleString()}`,    icon: DollarSign  },
    { label: "Conversion",   value: `${(conversionRate ?? 0).toFixed(1)}%`,        icon: TrendingUp  },
    { label: "Tasks Done",   value: tasksDoneCount?.toLocaleString() || "0",       icon: CheckCircle },
  ];

  return (
    <div className="h-full w-full flex flex-col overflow-y-auto md:overflow-hidden page-bg px-4 md:px-6 pt-4 md:pt-5 pb-5 gap-3 md:gap-4">

      {/* ── HEADER ── */}
      <div className="shrink-0">
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tighter text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Welcome to the Atomise CRM</p>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 shrink-0">
        {kpis.map((stat, i) => (
          <BrandedKPICard key={stat.label} {...stat} delay={i * 0.1} />
        ))}
      </div>

      {/* ── BOTTOM PANELS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 flex-none lg:flex-1 lg:min-h-0">

        {/* ── Pipeline Overview ── */}
        <PopPanel delay={0.4}>
          {(hovered) => (<>
          <h3 className={`text-sm font-display font-bold mb-3 uppercase tracking-widest shrink-0 transition-colors duration-300 ${hovered ? "text-purple-400" : "text-foreground/60"}`}>
            Pipeline Overview
          </h3>
          {/* top margin on chart to give LabelList space above bars */}
          <div className="h-[250px] md:h-auto md:flex-1 md:min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 30, right: 20, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="stage"
                  tick={{ fill: "#666", fontSize: 9, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis allowDecimals={false} tick={{ fill: "#444", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(139, 92, 246, 0.05)" }}
                  contentStyle={{ backgroundColor: "#050505", border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: "12px", color: "#fff" }}
                  labelStyle={{ fontWeight: 900, color: "#fff", fontSize: "9px", letterSpacing: "0.1em" }}
                />
                <Bar dataKey="deals" radius={[6, 6, 0, 0]} barSize={30}>
                  {/* COUNT LABEL above each bar */}
                  <LabelList dataKey="deals" content={<BarCountLabel />} />
                  {pipelineData.map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] || "#8B5CF6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </>)}
        </PopPanel>

        {/* ── Recent Activity ── */}
        <PopPanel delay={0.5}>
          {(hovered) => (<>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className={`text-sm font-display font-bold uppercase tracking-widest transition-colors duration-300 ${hovered ? "text-purple-400" : "text-foreground/60"}`}>Recent Activity</h3>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest text-primary">Live</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 min-h-0 space-y-2">
            {recentActivity.map((item) => {
              // Icon + colour per event type
              const iconMap = {
                contact:   { icon: UserPlus,   bg: "bg-blue-500/15",    border: "border-blue-500/25",    color: "text-blue-400"    },
                deal:      { icon: Handshake,  bg: "bg-emerald-500/15", border: "border-emerald-500/25", color: "text-emerald-400" },
                task:      { icon: CheckSquare,bg: "bg-amber-500/15",   border: "border-amber-500/25",   color: "text-amber-400"   },
                task_done: { icon: CheckCircle,bg: "bg-primary/15",     border: "border-primary/25",     color: "text-primary"     },
              };
              const { icon: Icon, bg, border, color } = iconMap[item.type] ?? iconMap.contact;
              return (
                <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 group/item p-2 rounded-xl hover:bg-primary/5 transition-colors">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${bg} ${border} mt-0.5`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Action label */}
                    <p className={`text-[10px] font-black uppercase tracking-widest ${color} leading-none mb-0.5`}>
                      {item.label}
                    </p>
                    {/* Name */}
                    <p className="text-sm font-bold text-foreground group-hover/item:text-primary transition-colors truncate leading-snug">
                      {item.name}
                    </p>
                    {/* Meta + time */}
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.meta && (
                        <span className="text-[10px] text-muted-foreground/50 font-medium truncate">{item.meta}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground/35 font-medium shrink-0">
                        · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {recentActivity.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <RefreshCw className="h-6 w-6 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground/40">No recent activity yet</p>
              </div>
            )}
          </div>
          </>)}
        </PopPanel>

      </div>
    </div>
  );
};

export default Dashboard;