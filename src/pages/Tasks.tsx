import { useState } from "react";
import { CheckCircle2, Circle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const priorityColors: Record<string, string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-muted-foreground",
};

const Tasks = () => {
  const [newTask, setNewTask] = useState("");
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const addMutation = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from("tasks").insert({ title, priority: "medium" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTask("");
      toast.success("Task added");
    },
    onError: () => toast.error("Failed to add task"),
  });

  const addTask = () => {
    if (!newTask.trim()) return;
    addMutation.mutate(newTask);
  };

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">Stay on top of your work</p>
      </div>

      <div className="flex gap-3 max-w-lg">
        <Input
          placeholder="Add a new task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          className="bg-card border-border"
        />
        <Button onClick={addTask} size="icon" className="shrink-0" disabled={addMutation.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Pending ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleMutation.mutate({ id: task.id, completed: true })}
                className="flex items-center gap-3 bg-card rounded-lg border border-border px-5 py-4 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm">{task.title}</span>
                <span className={`text-xs font-medium ${priorityColors[task.priority] || "text-muted-foreground"}`}>
                  {task.priority}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.due_date}
                </span>
              </div>
            ))}
          </div>
        </div>

        {completed.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Completed ({completed.length})
            </h2>
            <div className="space-y-2">
              {completed.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleMutation.mutate({ id: task.id, completed: false })}
                  className="flex items-center gap-3 bg-card rounded-lg border border-border px-5 py-4 hover:bg-muted/50 cursor-pointer transition-colors opacity-60"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="flex-1 text-sm line-through">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
