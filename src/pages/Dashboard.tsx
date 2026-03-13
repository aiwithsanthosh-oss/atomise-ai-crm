import { Users, DollarSign, TrendingUp, CheckCircle } from "lucide-react";

const stats = [
  { label: "Total Leads", value: "2,847", icon: Users, change: "+12.5%" },
  { label: "Revenue", value: "$184,290", icon: DollarSign, change: "+8.2%" },
  { label: "Conversion", value: "24.3%", icon: TrendingUp, change: "+3.1%" },
  { label: "Tasks Done", value: "156", icon: CheckCircle, change: "+18.7%" },
];

const Dashboard = () => {
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
        <div className="bg-card rounded-lg border border-border p-5 h-64 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Recent Activity Feed</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
