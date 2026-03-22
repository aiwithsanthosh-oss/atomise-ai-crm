import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2, Circle, Plus, ChevronRight, Users,
  ClipboardList, Trophy, Calendar, FileText, X,
  Search, Trash2, AlertTriangle, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { formatDistanceToNow, format, isPast, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type Contact = { id: string; name: string; email: string; phone: string | null };

type Template = { id: string; name: string };

type TemplateStep = {
  id: string; template_id: string; title: string;
  description: string | null; order_index: number;
};

type Tracker = {
  id: string; contact_id: string; template_id: string | null;
  name: string; created_at: string;
};

type OnboardingItem = {
  id: string; tracker_id: string; title: string;
  description: string | null; is_completed: boolean;
  notes: string | null; due_date: string | null;
  order_index: number; completed_at: string | null;
};

type TrackerWithContact = Tracker & {
  contact: Contact | null;
  items: OnboardingItem[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONE_BADGES = [
  { pct: 25,  label: "Getting Started", color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  { pct: 50,  label: "Halfway There",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30"   },
  { pct: 75,  label: "Almost Done",     color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30"  },
  { pct: 100, label: "Completed! 🎉",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
];

const CLIENTS_PER_PAGE = 8;

function getMilestone(pct: number) {
  if (pct >= 100) return MILESTONE_BADGES[3];
  if (pct >= 75)  return MILESTONE_BADGES[2];
  if (pct >= 50)  return MILESTONE_BADGES[1];
  if (pct >= 25)  return MILESTONE_BADGES[0];
  return null;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-purple-500" : pct >= 50 ? "bg-amber-500" : pct >= 25 ? "bg-blue-500" : "bg-primary";
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

// ─── Onboarding Page ──────────────────────────────────────────────────────────

const Onboarding = () => {
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [search, setSearch]                       = useState("");
  const [currentPage, setCurrentPage]             = useState(1);

  // Add tracker modal
  const [addOpen, setAddOpen]           = useState(false);
  const [selContact, setSelContact]     = useState("");
  const [selTemplate, setSelTemplate]   = useState("");

  // Add item to tracker
  const [addItemOpen, setAddItemOpen]   = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDesc, setNewItemDesc]   = useState("");
  const [newItemDue, setNewItemDue]     = useState("");

  // Notes editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText]           = useState("");

  // Delete confirmation
  const [trackerToDelete, setTrackerToDelete] = useState<TrackerWithContact | null>(null);

  const queryClient = useQueryClient();

  // ── Track all modal open states via ref ───────────────────────────────────
  const anyModalOpen = useRef(false);

  useEffect(() => {
    anyModalOpen.current = addOpen || addItemOpen;
  }, [addOpen, addItemOpen]);

  // ── Block tab/window switch from closing modals — mounted once ────────────
  useEffect(() => {
    const noop = (e: Event) => {
      if (anyModalOpen.current) e.stopImmediatePropagation();
    };
    document.addEventListener("visibilitychange", noop, true);
    document.addEventListener("focusout", noop, true);
    window.addEventListener("blur", noop, true);
    window.addEventListener("pagehide", noop, true);
    return () => {
      document.removeEventListener("visibilitychange", noop, true);
      document.removeEventListener("focusout", noop, true);
      window.removeEventListener("blur", noop, true);
      window.removeEventListener("pagehide", noop, true);
    };
  }, []);

  // ── Prevent body scroll when any modal open ───────────────────────────────
  useEffect(() => {
    document.body.style.overflow = (addOpen || addItemOpen) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [addOpen, addItemOpen]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, phone")
        .order("name");
      if (error) { console.error("Contacts error:", error); return []; }
      return (data || []) as Contact[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["onboarding-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_templates")
        .select("id, name")
        .order("name");
      if (error) { console.error("Templates error:", error); return []; }
      return (data || []) as Template[];
    },
  });

  const { data: templateSteps = [] } = useQuery({
    queryKey: ["template-steps", selTemplate],
    enabled: !!selTemplate,
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_template_steps")
        .select("*").eq("template_id", selTemplate).order("order_index");
      return (data || []) as TemplateStep[];
    },
  });

  const { data: trackersRaw = [], isLoading } = useQuery({
    queryKey: ["onboarding-trackers"],
    queryFn: async () => {
      const { data: trackers } = await supabase
        .from("onboarding_trackers").select("*").order("created_at", { ascending: false });
      if (!trackers?.length) return [];

      const { data: items } = await supabase
        .from("onboarding_items").select("*").order("order_index");

      const contactIds = [...new Set(trackers.map((t) => t.contact_id))];
      const { data: contactsData } = await supabase
        .from("contacts").select("id, name, email, phone").in("id", contactIds);

      return trackers.map((t) => ({
        ...t,
        contact: contactsData?.find((c) => c.id === t.contact_id) || null,
        items: (items || []).filter((i) => i.tracker_id === t.id),
      })) as TrackerWithContact[];
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────

  // Available contacts — those not already assigned a tracker
  const availableContacts = useMemo(() =>
    contacts.filter((c) => !trackersRaw.find((t) => t.contact_id === c.id)),
    [contacts, trackersRaw]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return trackersRaw.filter((t) =>
      !q ||
      t.contact?.name.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q)
    );
  }, [trackersRaw, search]);

  const totalPages    = Math.max(1, Math.ceil(filtered.length / CLIENTS_PER_PAGE));
  const safePage      = Math.min(currentPage, totalPages);
  const pagedTrackers = filtered.slice((safePage - 1) * CLIENTS_PER_PAGE, safePage * CLIENTS_PER_PAGE);

  const selectedTracker = trackersRaw.find((t) => t.id === selectedTrackerId) || null;

  const selectedPct = selectedTracker
    ? selectedTracker.items.length === 0
      ? 0
      : Math.round((selectedTracker.items.filter((i) => i.is_completed).length / selectedTracker.items.length) * 100)
    : 0;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createTrackerMutation = useMutation({
    mutationFn: async () => {
      if (!selContact) throw new Error("Please select a client");
      // Check not already onboarding this contact
      const existing = trackersRaw.find((t) => t.contact_id === selContact);
      if (existing) throw new Error("This client already has an onboarding tracker");

      // Create tracker
      const { data: tracker, error: tErr } = await supabase
        .from("onboarding_trackers")
        .insert({
          contact_id:  selContact,
          template_id: selTemplate || null,
          name:        templates.find((t) => t.id === selTemplate)?.name || "Custom Onboarding",
        })
        .select().single();
      if (tErr) throw tErr;

      // Copy template steps as items if template selected
      if (selTemplate && templateSteps.length > 0) {
        const items = templateSteps.map((s) => ({
          tracker_id:  tracker.id,
          title:       s.title,
          description: s.description,
          order_index: s.order_index,
          is_completed: false,
        }));
        const { error: iErr } = await supabase.from("onboarding_items").insert(items);
        if (iErr) throw iErr;
      }
      return tracker;
    },
    onSuccess: (tracker) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-trackers"] });
      setAddOpen(false);
      setSelContact(""); setSelTemplate("");
      setSelectedTrackerId(tracker.id);
      toast.success("Onboarding tracker created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase.from("onboarding_items").update({
        is_completed,
        completed_at: is_completed ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding-trackers"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const saveNoteMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("onboarding_items").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-trackers"] });
      setEditingNoteId(null);
      toast.success("Note saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTrackerId) throw new Error("No tracker selected");
      if (!newItemTitle.trim()) throw new Error("Step title is required");
      const maxOrder = selectedTracker?.items.length || 0;
      const { error } = await supabase.from("onboarding_items").insert({
        tracker_id:  selectedTrackerId,
        title:       newItemTitle.trim(),
        description: newItemDesc.trim() || null,
        due_date:    newItemDue || null,
        order_index: maxOrder,
        is_completed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-trackers"] });
      setAddItemOpen(false);
      setNewItemTitle(""); setNewItemDesc(""); setNewItemDue("");
      toast.success("Step added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-trackers"] });
      toast.success("Step removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTrackerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("onboarding_trackers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-trackers"] });
      setTrackerToDelete(null);
      if (selectedTrackerId === trackerToDelete?.id) setSelectedTrackerId(null);
      toast.success("Tracker deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col overflow-y-auto lg:overflow-hidden page-bg px-4 lg:px-6 pt-4 lg:pt-5 pb-5 gap-3 lg:gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tighter text-foreground">Onboarding</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Post-sale client onboarding tracker with milestone tracking</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 font-bold">
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-2 lg:gap-3 shrink-0">
        {[
          { label: "Total Clients",  value: trackersRaw.length, color: "text-foreground"  },
          { label: "In Progress",    value: trackersRaw.filter((t) => { try { const p = (t.items || []).length ? Math.round(((t.items || []).filter((i) => i.is_completed).length / (t.items || []).length) * 100) : 0; return p > 0 && p < 100; } catch { return false; } }).length, color: "text-amber-400" },
          { label: "Completed",      value: trackersRaw.filter((t) => (t.items || []).length > 0 && (t.items || []).every((i) => i.is_completed)).length, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="card-bg border border-border rounded-[14px] px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{s.label}</span>
            <span className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Main content — split panel ── */}
      <div className="flex-none lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 lg:overflow-hidden">

        {/* ── LEFT: Client list ── */}
        <div className="flex flex-col h-[320px] lg:h-auto lg:flex-1 lg:min-h-0 card-bg border border-border rounded-[16px] overflow-hidden">

          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-8 h-8 text-xs bg-background/50 border-border"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-3 space-y-2">
                {[1,2,3,4].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />)}
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                <Users className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground/40 font-medium">No clients yet</p>
                <p className="text-[10px] text-muted-foreground/30">Click "Add Client" to start</p>
              </div>
            )}
            {!isLoading && pagedTrackers.map((tracker) => {
              const pct = tracker.items.length === 0 ? 0
                : Math.round((tracker.items.filter((i) => i.is_completed).length / tracker.items.length) * 100);
              const milestone = getMilestone(pct);
              const isSelected = selectedTrackerId === tracker.id;
              return (
                <button
                  key={tracker.id}
                  onClick={() => setSelectedTrackerId(tracker.id)}
                  className={`w-full text-left p-3 border-b border-border/50 transition-all hover:bg-primary/5 ${
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                      pct >= 100 ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/15 text-primary"
                    }`}>
                      {(tracker.contact?.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{tracker.contact?.name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground/50 truncate">{tracker.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <ProgressBar pct={pct} />
                        <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0">{pct}%</span>
                      </div>
                    </div>
                    {milestone && pct >= 100 && (
                      <Trophy className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                    <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground/30"}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/40">{safePage}/{totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-6 w-6 flex items-center justify-center rounded border border-border text-muted-foreground disabled:opacity-30 hover:border-primary/30 transition-all"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-6 w-6 flex items-center justify-center rounded border border-border text-muted-foreground disabled:opacity-30 hover:border-primary/30 transition-all"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Checklist detail ── */}
        <div className="flex flex-col h-[500px] lg:h-auto lg:flex-1 lg:min-h-0 card-bg border border-border rounded-[16px] overflow-hidden">
          {!selectedTracker ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <ClipboardList className="h-12 w-12 text-muted-foreground/15 mb-3" />
              <p className="text-sm font-bold text-muted-foreground/40">Select a client</p>
              <p className="text-xs text-muted-foreground/30 mt-1">Choose a client from the left to view their onboarding checklist</p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-foreground">{selectedTracker.contact?.name}</h2>
                      {(() => {
                        const m = getMilestone(selectedPct);
                        return m ? (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${m.bg} ${m.border} ${m.color}`}>
                            {m.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{selectedTracker.name}</p>
                    {selectedTracker.contact?.email && (
                      <p className="text-[11px] text-muted-foreground/40 mt-0.5">{selectedTracker.contact.email}</p>
                    )}
                  </div>
                  {/* Delete tracker */}
                  <button
                    onClick={() => setTrackerToDelete(selectedTracker)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Progress section */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">Progress</span>
                    <span className="text-sm font-black text-foreground tabular-nums">
                      {selectedTracker.items.filter((i) => i.is_completed).length} / {selectedTracker.items.length} steps
                    </span>
                  </div>
                  <ProgressBar pct={selectedPct} />
                  {/* Milestone markers */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {MILESTONE_BADGES.map((m) => (
                      <div
                        key={m.pct}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold transition-all ${
                          selectedPct >= m.pct
                            ? `${m.bg} ${m.border} ${m.color}`
                            : "border-border text-muted-foreground/25 bg-transparent"
                        }`}
                      >
                        {selectedPct >= m.pct && <CheckCircle2 className="h-2.5 w-2.5" />}
                        {m.pct}%
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Checklist items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedTracker.items.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground/40">No steps yet — add a step below</p>
                  </div>
                )}

                {selectedTracker.items.map((item) => {
                  const isOverdue = (() => { try { return item.due_date && !item.is_completed && isPast(parseISO(item.due_date)); } catch { return false; } })();
                  const isEditingNote = editingNoteId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-2.5 transition-all ${
                        item.is_completed
                          ? "border-border bg-muted/10 opacity-70"
                          : isOverdue
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-border bg-background/50 hover:border-primary/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleItemMutation.mutate({ id: item.id, is_completed: !item.is_completed })}
                          className="shrink-0 mt-0.5 transition-transform hover:scale-110"
                        >
                          {item.is_completed
                            ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            : <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary transition-colors" />
                          }
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-bold ${item.is_completed ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
                              {item.title}
                            </span>
                            {isOverdue && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="h-2.5 w-2.5" /> Overdue
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{item.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {item.due_date && (
                              <span className={`text-[10px] flex items-center gap-1 font-medium ${isOverdue ? "text-red-400" : "text-muted-foreground/50"}`}>
                                <Calendar className="h-2.5 w-2.5" />
                                Due {(() => { try { return format(parseISO(item.due_date!), "dd MMM yyyy"); } catch { return item.due_date; } })()}
                              </span>
                            )}
                            {item.is_completed && item.completed_at && (
                              <span className="text-[10px] text-emerald-500/70 font-medium">
                                ✓ Done {formatDistanceToNow(new Date(item.completed_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>

                          {/* Notes */}
                          {isEditingNote ? (
                            <div className="mt-2 space-y-1.5">
                              <textarea
                                rows={2}
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add a note..."
                                className="w-full text-xs bg-background/80 border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary/50 resize-none"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveNoteMutation.mutate({ id: item.id, notes: noteText })}
                                  className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
                                >Save</button>
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="text-[10px] font-bold text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                >Cancel</button>
                              </div>
                            </div>
                          ) : item.notes ? (
                            <div
                              onClick={() => { setEditingNoteId(item.id); setNoteText(item.notes || ""); }}
                              className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/15 cursor-pointer hover:border-primary/30 transition-all"
                            >
                              <p className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5">
                                <FileText className="h-3 w-3 text-primary/50 shrink-0 mt-0.5" />
                                {item.notes}
                              </p>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingNoteId(item.id); setNoteText(""); }}
                              className="mt-1.5 text-[10px] text-muted-foreground/30 hover:text-primary/60 transition-colors flex items-center gap-1"
                            >
                              <FileText className="h-2.5 w-2.5" /> Add note
                            </button>
                          )}
                        </div>

                        {/* Delete step */}
                        <button
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-muted-foreground/30 hover:text-red-400 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add step button */}
              <div className="p-3 border-t border-border">
                <button
                  onClick={() => setAddItemOpen(true)}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground/50 hover:text-primary hover:border-primary/40 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Step
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Add Client Modal — always mounted, controlled by CSS ── */}
      {createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: addOpen ? "flex" : "none",
            pointerEvents: addOpen ? "all" : "none",
          }}
        >
          <div
            className="card-bg border border-border rounded-2xl w-full max-w-md shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">Add Client Onboarding</h2>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Select a client and apply an onboarding template</p>
              </div>
              <button
                onClick={() => { setAddOpen(false); setSelContact(""); setSelTemplate(""); }}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Client *</label>
                <Select value={selContact} onValueChange={setSelContact}>
                  <SelectTrigger className="bg-background/50 border-border text-foreground">
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60" style={{ zIndex: 99999 }}>
                    {availableContacts.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground/50">
                        All contacts already have trackers
                      </div>
                    ) : availableContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Onboarding Template</label>
                <Select value={selTemplate} onValueChange={setSelTemplate}>
                  <SelectTrigger className="bg-background/50 border-border text-foreground">
                    <SelectValue placeholder="Select template (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border" style={{ zIndex: 99999 }}>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/40 mt-1">
                  {selTemplate
                    ? `${templateSteps.length} steps will be added automatically`
                    : "No template — you can add steps manually after"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => { setAddOpen(false); setSelContact(""); setSelTemplate(""); }}>
                Cancel
              </Button>
              <Button
                onClick={() => createTrackerMutation.mutate()}
                disabled={createTrackerMutation.isPending || !selContact}
                className="gap-2 font-bold"
              >
                <Plus className="h-4 w-4" />
                {createTrackerMutation.isPending ? "Creating..." : "Start Onboarding"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Step Modal — always mounted, controlled by CSS ── */}
      {createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: addItemOpen ? "flex" : "none",
            pointerEvents: addItemOpen ? "all" : "none",
          }}
        >
          <div
            className="card-bg border border-border rounded-2xl w-full max-w-md shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">Add Step</h2>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Add a custom checklist step for this client</p>
              </div>
              <button onClick={() => setAddItemOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Step Title *</label>
                <Input
                  className="bg-background/50 border-border text-foreground"
                  placeholder="e.g. Send welcome email"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Description</label>
                <Input
                  className="bg-background/50 border-border text-foreground"
                  placeholder="Optional description"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block">Due Date</label>
                <input
                  type="date"
                  value={newItemDue}
                  onChange={(e) => setNewItemDue(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-background/50 border border-border rounded-xl text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
              <Button onClick={() => addItemMutation.mutate()} disabled={addItemMutation.isPending || !newItemTitle.trim()} className="gap-2 font-bold">
                <Plus className="h-4 w-4" />
                {addItemMutation.isPending ? "Adding..." : "Add Step"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Delete Tracker Confirmation ── */}
      <AlertDialog open={!!trackerToDelete} onOpenChange={(o) => { if (!o) setTrackerToDelete(null); }}>
        <AlertDialogContent className="card-bg border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete onboarding tracker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the onboarding tracker for <strong>{trackerToDelete?.contact?.name}</strong> and all its checklist items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              onClick={() => trackerToDelete && deleteTrackerMutation.mutate(trackerToDelete.id)}
            >
              {deleteTrackerMutation.isPending ? "Deleting..." : "Delete Tracker"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Onboarding;