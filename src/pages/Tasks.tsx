import { useState, useMemo } from "react";
import {
  CheckCircle2, Circle, Plus, Trash2,
  User, Flag, AlertTriangle, Clock,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { formatDistanceToNow, isPast, isToday, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskRow = {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  contact_id: string | null;
  created_at?: string;
};

type Contact = { id: string; name: string; email: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const TASKS_PER_PAGE = 10;

const PRIORITY = {
  high:   { label: "High",   color: "#f87171", bg: "bg-red-500/10",   border: "border-red-500/30",   dot: "bg-red-400"   },
  medium: { label: "Medium", color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" },
  low:    { label: "Low",    color: "#60a5fa", bg: "bg-blue-500/10",  border: "border-blue-500/30",  dot: "bg-blue-400"  },
} as const;

type Priority = keyof typeof PRIORITY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dueDateLabel(dateStr: string | null) {
  if (!dateStr) return { label: "", isOverdue: false, isToday: false };
  const date    = parseISO(dateStr);
  const overdue = isPast(date) && !isToday(date);
  const today   = isToday(date);
  const label   = today
    ? "Due today"
    : overdue
    ? `Overdue · ${formatDistanceToNow(date, { addSuffix: false })} ago`
    : `Due ${formatDistanceToNow(date, { addSuffix: true })}`;
  return { label, isOverdue: overdue, isToday: today };
}

// ─── Tasks Page ───────────────────────────────────────────────────────────────

const Tasks = () => {
  // New task dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle]           = useState("");
  const [priority, setPriority]     = useState<Priority>("medium");
  const [dueDate, setDueDate]       = useState("");
  const [contactId, setContactId]   = useState<string>("none");

  // Delete confirmation
  const [taskToDelete, setTaskToDelete] = useState<TaskRow | null>(null);

  // Filter + pagination
  const [filterStatus, setFilterStatus]     = useState<"all" | "pending" | "completed">("all");
  const [filterContact, setFilterContact]   = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo]     = useState<string>("");
  const [contactSearch, setContactSearch]   = useState<string>("");
  const [showFilters, setShowFilters]       = useState(false);
  const [currentPage, setCurrentPage]       = useState(1);

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as TaskRow[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-for-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email")
        .order("name");
      if (error) return [];
      return data as Contact[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async () => {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Task title is required");
      const { error } = await supabase.from("tasks").insert({
        title: trimmed,
        status: "pending",
        priority,
        due_date: dueDate || null,
        contact_id: contactId === "none" ? null : contactId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-done-count"] });
      setDialogOpen(false);
      resetForm();
      setCurrentPage(1);
      toast.success("Task created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-done-count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-done-count"] });
      setTaskToDelete(null);
      toast.success("Task deleted");
      if (pagedTasks.length === 1 && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setTitle(""); setPriority("medium"); setDueDate(""); setContactId("none");
  };

  const overdueCount = useMemo(() =>
    tasks.filter((t) => {
      if ((t.status ?? "pending") === "completed") return false;
      if (!t.due_date) return false;
      return isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
    }).length,
  [tasks]);

  const activeFilterCount = [
    filterContact !== "all",
    filterPriority !== "all",
    filterDateFrom !== "",
    filterDateTo !== "",
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    let result = tasks;
    if (filterStatus === "pending")   result = result.filter((t) => (t.status ?? "pending") !== "completed");
    if (filterStatus === "completed") result = result.filter((t) => (t.status ?? "pending") === "completed");
    if (filterContact !== "all") result = result.filter((t) => t.contact_id === filterContact);
    if (filterPriority !== "all") result = result.filter((t) => (t.priority ?? "medium") === filterPriority);
    if (filterDateFrom) result = result.filter((t) => t.due_date && t.due_date >= filterDateFrom);
    if (filterDateTo) result = result.filter((t) => t.due_date && t.due_date <= filterDateTo + "T23:59:59");
    return result;
  }, [tasks, filterStatus, filterContact, filterPriority, filterDateFrom, filterDateTo]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / TASKS_PER_PAGE));
  const safePage    = Math.min(currentPage, totalPages);
  const pagedTasks  = filtered.slice((safePage - 1) * TASKS_PER_PAGE, safePage * TASKS_PER_PAGE);

  const pending   = pagedTasks.filter((t) => (t.status ?? "pending") !== "completed");
  const completed = pagedTasks.filter((t) => (t.status ?? "pending") === "completed");

  const handleFilterChange = (f: typeof filterStatus) => {
    setFilterStatus(f);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilterContact("all");
    setFilterPriority("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setContactSearch("");
    setCurrentPage(1);
  };

  const filteredContactOptions = contacts.filter((c) =>
    contactSearch === "" || c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col overflow-hidden page-bg px-6 pt-5 pb-5">

      {/* ── Global style for date picker calendar icon ── */}
      {/* FIXED: using injected <style> tag to reliably make calendar icon white in dark theme */}
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1) brightness(3);
          cursor: pointer;
          opacity: 0.8;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
          filter: invert(0.5) sepia(1) saturate(5) hue-rotate(230deg) brightness(1.5);
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-5 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tighter text-foreground">Tasks</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Stay on top of your work</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-bold text-red-400">{overdueCount} overdue</span>
            </div>
          )}
          <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 font-bold">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      {/* ── Filter tabs + Filter toggle ── */}
      <div className="flex flex-wrap items-center justify-between mb-3 shrink-0 gap-2">
        <div className="flex gap-2">
          {(["all", "pending", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
                filterStatus === f
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground/50 hover:text-muted-foreground border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/40 font-medium">
            {filtered.length} task{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${
              showFilters || activeFilterCount > 0
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground/50 hover:text-muted-foreground border-transparent hover:border-border"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Expanded filter panel ── */}
      {showFilters && (
        <div className="shrink-0 mb-3 p-4 rounded-[14px] border border-border card-bg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Contact filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                Contact / Lead
              </label>
              <div className="relative">
                <Select
                  value={filterContact}
                  onValueChange={(v) => { setFilterContact(v); setCurrentPage(1); }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground">
                    <SelectValue placeholder="All contacts" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60">
                    <div className="px-2 py-1.5 border-b border-border">
                      <input
                        placeholder="Search contact..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="w-full text-xs bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="all" className="text-xs">All contacts</SelectItem>
                    {filteredContactOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-primary">{c.name.charAt(0).toUpperCase()}</span>
                          </div>
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                    {filteredContactOptions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground/50">No contacts found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                Priority
              </label>
              <Select
                value={filterPriority}
                onValueChange={(v) => { setFilterPriority(v); setCurrentPage(1); }}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all" className="text-xs">All priorities</SelectItem>
                  <SelectItem value="high" className="text-xs">
                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-red-400" />High</div>
                  </SelectItem>
                  <SelectItem value="medium" className="text-xs">
                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-amber-400" />Medium</div>
                  </SelectItem>
                  <SelectItem value="low" className="text-xs">
                    <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-blue-400" />Low</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due date range */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                Due Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                  className="flex-1 h-9 px-2 text-xs bg-background border border-border rounded-lg text-foreground [color-scheme:dark] focus:outline-none focus:border-primary/50"
                />
                <span className="text-muted-foreground/40 text-xs font-bold shrink-0">to</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                  className="flex-1 h-9 px-2 text-xs bg-background border border-border rounded-lg text-foreground [color-scheme:dark] focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex justify-end pt-1">
              <button onClick={clearAllFilters} className="text-xs font-bold text-red-400 hover:text-red-500 transition-colors">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Task list ── */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 min-h-0">

        {pending.length > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 px-1">
              Pending — {pending.length}
            </h2>
            <div className="space-y-2">
              {pending.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  contacts={contacts}
                  onToggle={() => toggleMutation.mutate({ id: task.id, status: "completed" })}
                  onDeleteRequest={() => setTaskToDelete(task)}
                />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3 px-1">
              Completed — {completed.length}
            </h2>
            <div className="space-y-2">
              {completed.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  contacts={contacts}
                  onToggle={() => toggleMutation.mutate({ id: task.id, status: "pending" })}
                  onDeleteRequest={() => setTaskToDelete(task)}
                  isCompleted
                />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-primary/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No tasks here</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Click "New Task" to get started</p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between pt-4 border-t border-border mt-2">
          <span className="text-[11px] text-muted-foreground/50 font-medium">
            Page {safePage} of {totalPages} · {filtered.length} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border card-bg text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "…" ? (
                  <span key={`ellipsis-${idx}`} className="h-8 w-6 flex items-center justify-center text-xs text-muted-foreground/40">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item as number)}
                    className={`h-8 min-w-[2rem] px-2 flex items-center justify-center rounded-lg text-xs font-bold transition-all duration-150 ${
                      safePage === item
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "border border-border card-bg text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border card-bg text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Add Task Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="card-bg border border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">New Task</DialogTitle>
            <DialogDescription>Create a task, set a due date and assign it to a contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Task *</Label>
              <Input
                placeholder="e.g. Follow up with Jane"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-muted border-border text-foreground"
                onKeyDown={(e) => e.key === "Enter" && addMutation.mutate()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger className="bg-muted border-border text-foreground h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="card-bg border-border">
                    {(Object.entries(PRIORITY) as [Priority, typeof PRIORITY[Priority]][]).map(([key, p]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${p.dot}`} />
                          <span className="text-foreground">{p.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── FIXED: Due Date with white calendar icon via injected style ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Due Date</Label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  className="w-full h-10 px-3 rounded-md bg-muted border border-border text-foreground text-sm cursor-pointer focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Assign to Contact <span className="normal-case font-normal text-muted-foreground/40">(optional)</span>
              </Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="bg-muted border-border text-foreground h-10">
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent className="card-bg border-border max-h-48">
                  <SelectItem value="none" className="text-muted-foreground italic">No contact</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-purple-400">{c.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-foreground">{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !title.trim()}>
              {addMutation.isPending ? "Creating…" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(o) => { if (!o) setTaskToDelete(null); }}>
        <AlertDialogContent className="card-bg border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">"{taskToDelete?.title}"</span>.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-foreground"
              onClick={() => taskToDelete && deleteMutation.mutate(taskToDelete.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task, contacts, onToggle, onDeleteRequest, isCompleted = false,
}: {
  task: TaskRow;
  contacts: Contact[];
  onToggle: () => void;
  onDeleteRequest: () => void;
  isCompleted?: boolean;
}) {
  const p       = PRIORITY[(task.priority as Priority) ?? "medium"] ?? PRIORITY.medium;
  const due     = dueDateLabel(task.due_date);
  const contact = contacts.find((c) => c.id === (task as any).contact_id);

  return (
    <div
      className={`group flex items-start gap-3 rounded-[14px] px-4 py-3.5 border card-bg transition-all duration-200 hover:border-purple-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10 ${
        due.isOverdue && !isCompleted ? "border-red-500/25" : "border-border"
      } ${isCompleted ? "opacity-55" : ""}`}
    >
      <button onClick={onToggle} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors">
        {isCompleted ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold text-foreground leading-snug ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.bg} ${p.border}`}
            style={{ color: p.color }}
          >
            <Flag className="h-2.5 w-2.5" />
            {p.label}
          </span>
          {due.label && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
              due.isOverdue && !isCompleted ? "text-red-400"
              : due.isToday && !isCompleted ? "text-amber-400"
              : "text-muted-foreground/50"
            }`}>
              {due.isOverdue && !isCompleted ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
              {due.label}
            </span>
          )}
          {contact && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-400">
              <User className="h-2.5 w-2.5" />
              {contact.name}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 mt-0.5"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default Tasks;