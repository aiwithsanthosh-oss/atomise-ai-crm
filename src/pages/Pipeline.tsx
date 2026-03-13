import { useState } from "react";
import { DollarSign, User, GripVertical } from "lucide-react";

interface Deal {
  id: string;
  name: string;
  company: string;
  value: string;
  stage: string;
}

const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed"];

const initialDeals: Deal[] = [
  { id: "1", name: "Sarah Chen", company: "Acme Corp", value: "$12,000", stage: "Lead" },
  { id: "2", name: "James Wilson", company: "Globex Inc", value: "$28,500", stage: "Lead" },
  { id: "3", name: "Maria Rodriguez", company: "Wayne Enterprises", value: "$45,000", stage: "Qualified" },
  { id: "4", name: "David Park", company: "Stark Industries", value: "$67,000", stage: "Proposal" },
  { id: "5", name: "Emily Thompson", company: "Oscorp", value: "$34,200", stage: "Proposal" },
  { id: "6", name: "Alex Morgan", company: "Umbrella Corp", value: "$89,000", stage: "Negotiation" },
  { id: "7", name: "Lisa Wang", company: "Cyberdyne", value: "$52,300", stage: "Closed" },
  { id: "8", name: "Tom Baker", company: "Initech", value: "$18,700", stage: "Qualified" },
];

const Pipeline = () => {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);

  const handleDragStart = (dealId: string) => {
    setDraggedDeal(dealId);
  };

  const handleDrop = (stage: string) => {
    if (!draggedDeal) return;
    setDeals(deals.map((d) => (d.id === draggedDeal ? { ...d, stage } : d)));
    setDraggedDeal(null);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">Drag deals between stages</p>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage);
          return (
            <div
              key={stage}
              className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="flex items-center justify-between px-3 py-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-display font-semibold">{stage}</h3>
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                    {stageDeals.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 bg-surface rounded-lg p-2 space-y-2 min-h-[200px]">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => handleDragStart(deal.id)}
                    className={`bg-surface-elevated rounded-lg p-4 border border-border cursor-grab active:cursor-grabbing transition-all hover:border-primary/30 ${
                      draggedDeal === deal.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium">{deal.name}</span>
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <User className="h-3 w-3" />
                      {deal.company}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                      <DollarSign className="h-3 w-3" />
                      {deal.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Pipeline;
