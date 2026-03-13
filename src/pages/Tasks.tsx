import { useState } from "react";
import { CheckCircle2, Circle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate: string;
}

const initialTasks: Task[] = [
  { id: "1", title: "Follow up with Sarah Chen re: Acme proposal", completed: false, priority: "high", dueDate: "2026-03-14" },
  { id: "2", title: "Prepare demo for Globex meeting", completed: false, priority: "medium", dueDate: "2026-03-15" },
  { id: "3", title: "Send contract to Wayne Enterprises", completed: true, priority: "high", dueDate: "2026-03-12" },
  { id: "4", title: "Update CRM pipeline stages", completed: false, priority: "low", dueDate: "2026-03-16" },
  { id: "5", title: "Call David Park about pricing", completed: false, priority: "medium", dueDate: "2026-03-14" },
];

const priorityColors = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-muted-foreground",
};

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState("");

  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([
      {
        id: Date.now().toString(),
        title: newTask,
        completed: false,
        priority: "medium",
        dueDate: new Date().toISOString().split("T")[0],
      },
      ...tasks,
    ]);
    setNewTask("");
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
        <Button onClick={addTask} size="icon" className="shrink-0">
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
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-3 bg-card rounded-lg border border-border px-5 py-4 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm">{task.title}</span>
                <span className={`text-xs font-medium ${priorityColors[task.priority]}`}>
                  {task.priority}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.dueDate}
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
                  onClick={() => toggleTask(task.id)}
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
