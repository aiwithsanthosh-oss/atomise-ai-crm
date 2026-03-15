import { useState } from "react";
import { DollarSign, User, GripVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed"];

const Pipeline = () => {
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
    onError: (error: Error) => toast.error(`Failed to update deal: ${error.message}`),
  });

  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-chart"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-activity"] }),
      ]);
      setDealToDelete(null);
      toast.success("Deal deleted");
    },
    onError: (error: Error) => toast.error(`Failed to delete deal: ${error.message}`),
  });

  const handleDrop = (stage: string) => {
    if (!draggedDeal) return;
    updateStage.mutate({ id: draggedDeal, stage });
    setDraggedDeal(null);
  };

  const selectedDeal = deals.find((deal) => deal.id === dealToDelete);

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
              className="flex-shrink-0 w-72 flex flex-col animate-[fade-in_0.2s_ease-out]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="flex items-center justify-between px-3 py-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-display font-semibold">{stage}</h3>
                  <Badge
                    variant="outline"
                    className={`${
                      stage === "Lead"
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                        : stage === "Negotiation"
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                        : stage === "Proposal"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : stage === "Closed"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {stageDeals.length}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 bg-surface rounded-lg p-2 space-y-2 min-h-[200px]">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDraggedDeal(deal.id)}
                    className={`bg-surface-elevated rounded-lg p-4 border border-border cursor-grab active:cursor-grabbing transition-all duration-200 hover:border-primary/30 animate-[fade-in_0.2s_ease-out] ${
                      draggedDeal === deal.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium">{deal.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors duration-200"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDealToDelete(deal.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
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

      <AlertDialog open={!!dealToDelete} onOpenChange={(dialogOpen) => !dialogOpen && setDealToDelete(null)}>
        <AlertDialogContent className="animate-[fade-in_0.2s_ease-out]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedDeal?.name || "this deal"} from your pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => dealToDelete && deleteDeal.mutate(dealToDelete)}
            >
              {deleteDeal.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Pipeline;
