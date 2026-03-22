import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, Mail, Pencil, Trash2, Clock,
  MessageSquare, UserCheck, Flame, Phone,
  ChevronLeft, ChevronRight, Tag, Sparkles, X,
  RefreshCw, Briefcase, CheckSquare, Calendar, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { PhoneInput, joinPhone, splitPhone, COUNTRY_CODES } from "@/components/PhoneInput";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  tags: string[] | null;
  custom_values: Record<string, any> | null;
  assigned_to: string | null;
  lead_score: number | null;
  created_at: string;
  last_contacted_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
};

type Activity = {
  id: string;
  type: "note" | "status_change" | "system";
  content: string;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTACTS_PER_PAGE = 10;

const STATUS_OPTIONS = ["lead", "new", "negotiation", "closed won", "lost"];

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  lead:        { label: "Lead",        color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  new:         { label: "New",         color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  negotiation: { label: "Negotiation", color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30"  },
  "closed won":{ label: "Closed Won",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  lost:        { label: "Lost",        color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
};

const getStatusMeta = (s: string) =>
  STATUS_META[(s || "lead").toLowerCase()] ?? { label: s, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border" };

// ─── Shared field styles ──────────────────────────────────────────────────────

const fieldLabel = "block text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1.5";
const fieldInput = "w-full h-11 card-elevated border border-border text-foreground text-sm font-medium rounded-xl px-3 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all";

// ─── Reusable form field ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

// ─── Contacts Page ────────────────────────────────────────────────────────────

export default function Contacts() {
  const [userRole, setUserRole]     = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField]     = useState<"name" | "owner" | "status" | null>(null);
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("asc");

  const handleSort = (field: "name" | "owner" | "status") => {
    if (sortField === field) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const [addOpen, setAddOpen]               = useState(false);
  const [editOpen, setEditOpen]             = useState(false);
  const [selectedLead, setSelectedLead]     = useState<Lead | null>(null);
  const [editingLead, setEditingLead]       = useState<Lead | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Lead | null>(null);

  const emptyForm = { name: "", email: "", phone: "", countryCode: "+91", company: "", tags: "", status: "lead", lead_score: 50, assigned_to: "none" };
  const [form, setForm]       = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [newNote, setNewNote] = useState("");

  const queryClient = useQueryClient();

  // ── Block tab/window switch from closing modals ────────────────────────────
  const anyModalOpen = useRef(false);
  useEffect(() => {
    anyModalOpen.current = addOpen || editOpen;
  }, [addOpen, editOpen]);
  useEffect(() => {
    const noop = (e: Event) => { if (anyModalOpen.current) e.stopImmediatePropagation(); };
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

  // ── AI Summary state ───────────────────────────────────────────────────────
  const [aiLead, setAiLead]           = useState<Lead | null>(null);
  const [aiSummary, setAiSummary]     = useState<string>("");
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState<string | null>(null);

  const generateAiSummary = async (lead: Lead) => {
    setAiLead(lead);
    setAiSummary("");
    setAiError(null);
    setAiLoading(true);

    try {
      // Fetch all related data in parallel
      const [dealsRes, tasksRes, apptsRes, onboardingRes] = await Promise.all([
        supabase.from("deals").select("name, stage, value").eq("contact_id", lead.id),
        supabase.from("tasks").select("title, status, priority, due_date").eq("contact_id", lead.id),
        supabase.from("appointments").select("title, appointment_date, start_time, status").eq("contact_id", lead.id).order("appointment_date"),
        supabase.from("onboarding_trackers").select("name, onboarding_items(title, is_completed)").eq("contact_id", lead.id).single(),
      ]);

      const deals        = dealsRes.data || [];
      const tasks        = tasksRes.data || [];
      const appointments = apptsRes.data || [];
      const onboarding   = onboardingRes.data;

      // Build context for Claude
      const today = new Date().toISOString().split("T")[0];
      const overdueTasks = tasks.filter((t: any) => t.status === "pending" && t.due_date && t.due_date < today);
      const pendingTasks = tasks.filter((t: any) => t.status === "pending");
      const completedTasks = tasks.filter((t: any) => t.status === "completed");
      const upcomingAppts = appointments.filter((a: any) => a.status === "scheduled" && a.appointment_date >= today);
      const onboardingItems = (onboarding as any)?.onboarding_items || [];
      const onboardingPct = onboardingItems.length
        ? Math.round((onboardingItems.filter((i: any) => i.is_completed).length / onboardingItems.length) * 100)
        : null;

      const dealsText = deals.length
        ? deals.map((d: any) => "- " + d.name + ": " + d.stage + " stage, $" + d.value).join("\n")
        : "No deals";

      const overdueText = overdueTasks.length
        ? "\n- Overdue tasks: " + overdueTasks.map((t: any) => t.title).join(", ")
        : "";

      const pendingText = pendingTasks.length
        ? "\n- Pending: " + pendingTasks.map((t: any) => t.title + " (" + t.priority + ")").join(", ")
        : "";

      const apptsText = upcomingAppts.length
        ? upcomingAppts.slice(0, 3).map((a: any) =>
            "- " + a.title + " on " + a.appointment_date + " at " + (a.start_time?.slice(0, 5) || "")
          ).join("\n")
        : "No upcoming appointments";

      const onboardingText = onboardingPct !== null
        ? "- Progress: " + onboardingPct + "% complete (" +
          onboardingItems.filter((i: any) => i.is_completed).length + "/" + onboardingItems.length + " steps)"
        : "- No onboarding tracker";

      const prompt = [
        "You are a CRM assistant. Analyze this lead data and provide a concise summary with a recommended next action.",
        "",
        "LEAD INFORMATION:",
        "- Name: " + lead.name,
        "- Email: " + lead.email,
        "- Phone: " + (lead.phone || "Not provided"),
        "- Company: " + (lead.company || "Not provided"),
        "- Status: " + lead.status,
        "- Lead Score: " + (lead.lead_score ?? 0) + "%",
        "- Tags: " + ((lead.tags || []).join(", ") || "None"),
        "- Added: " + (lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "Unknown"),
        "",
        "DEALS (" + deals.length + " total):",
        dealsText,
        "",
        "TASKS:",
        "- Total: " + tasks.length + " | Pending: " + pendingTasks.length + " | Completed: " + completedTasks.length + " | Overdue: " + overdueTasks.length,
        overdueText,
        pendingText,
        "",
        "APPOINTMENTS:",
        "- Upcoming: " + upcomingAppts.length,
        apptsText,
        "",
        "ONBOARDING:",
        onboardingText,
        "",
        "Today's date: " + today,
        "",
        "Provide a response in this exact format:",
        "**SUMMARY**",
        "[2-3 sentences covering the lead's current status, deals, and engagement level]",
        "",
        "**STATUS ACROSS MODULES**",
        "[3-4 bullet points covering deals, tasks, appointments, onboarding]",
        "",
        "**RECOMMENDED NEXT ACTION**",
        "[1-2 specific actionable steps the sales person should take right now]",
        "",
        "Keep the response concise and practical.",
      ].join("\n");

      // Using Groq — 100% free, no credit card, no billing needed
      const groqKey = import.meta.env.VITE_GROQ_API_KEY || "";
      if (!groqKey) throw new Error("Groq API key not found. Add VITE_GROQ_API_KEY to your .env file. Get free key at console.groq.com");

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + groqKey,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 1000,
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content: "You are a CRM assistant that analyzes lead data and provides concise summaries with actionable next steps. Be practical and specific.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.message || "Groq API request failed: " + response.status);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "Unable to generate summary.";
      setAiSummary(text);
    } catch (err: any) {
      setAiError(err.message || "Failed to generate summary. Please try again.");
      console.error("AI Summary error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(data?.role || "sales");
      }
    };
    fetchUser();
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: leads = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-profiles-dropdown"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, mobile_number");
      return (data || []) as Profile[];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead?.id) return [];
      const { data } = await supabase.from("activities").select("*").eq("contact_id", selectedLead.id).order("created_at", { ascending: false });
      return (data || []) as Activity[];
    },
    enabled: !!selectedLead?.id,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.email.trim()) throw new Error("Name and Email are mandatory.");
      const { data: existing } = await supabase.from("contacts").select("email").eq("email", form.email.trim()).maybeSingle();
      if (existing) throw new Error("Email already exists.");
      const { error } = await supabase.from("contacts").insert({
        name: form.name.trim(), email: form.email.trim(),
        phone: form.phone ? joinPhone(form.countryCode, form.phone) : null, company: form.company || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        status: form.status, lead_score: form.lead_score,
        assigned_to: form.assigned_to === "none" ? null : form.assigned_to,
      }).select().single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-count"] });
      setAddOpen(false);
      setForm(emptyForm);
      setCurrentPage(1);
      toast.success("Lead created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingLead) return;
      const { error } = await supabase.from("contacts").update({
        name: editForm.name.trim(), email: editForm.email.trim(),
        phone: editForm.phone ? joinPhone(editForm.countryCode, editForm.phone) : null, company: editForm.company || null,
        tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        status: editForm.status, lead_score: editForm.lead_score,
        assigned_to: editForm.assigned_to === "none" ? null : editForm.assigned_to,
      }).eq("id", editingLead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setEditOpen(false);
      toast.success("Lead updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("contacts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-count"] });
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      toast.success("Selected contacts deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setContactToDelete(null);
      toast.success("Contact deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleEditClick = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm({
      name: lead.name, email: lead.email,
      phone: lead.phone ? splitPhone(lead.phone).number : "", countryCode: lead.phone ? splitPhone(lead.phone).code : "+91", company: lead.company || "",
      tags: (lead.tags || []).join(", "),
      status: (lead.status || "lead").toLowerCase(),
      lead_score: lead.lead_score || 50,
      assigned_to: lead.assigned_to || "none",
    });
    setEditOpen(true);
  };

  const logNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    await supabase.from("activities").insert({ contact_id: selectedLead.id, type: "note", content: newNote.trim() });
    queryClient.invalidateQueries({ queryKey: ["activities", selectedLead.id] });
    setNewNote("");
    toast.success("Note logged");
  };

  // ── Pagination ────────────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase();
    let result = leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.tags || []).some((t) => t.toLowerCase().includes(q))
    );
    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal = "";
        let bVal = "";
        if (sortField === "name") {
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
        } else if (sortField === "owner") {
          const aOwner = teamMembers.find((m) => m.id === a.assigned_to);
          const bOwner = teamMembers.find((m) => m.id === b.assigned_to);
          aVal = (aOwner?.full_name || "zzz").toLowerCase();
          bVal = (bOwner?.full_name || "zzz").toLowerCase();
        } else if (sortField === "status") {
          aVal = (a.status || "").toLowerCase();
          bVal = (b.status || "").toLowerCase();
        }
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [search, leads, sortField, sortDir, teamMembers]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / CONTACTS_PER_PAGE));
  const safePage   = Math.min(currentPage, totalPages);
  const pagedLeads = filteredLeads.slice((safePage - 1) * CONTACTS_PER_PAGE, safePage * CONTACTS_PER_PAGE);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col overflow-hidden page-bg px-6 pt-5 pb-5 gap-4">

        {/* ── Header ── */}
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tighter text-foreground">Contacts</h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5 font-medium">Communication Center · {leads.length} total</p>
          </div>
          {userRole === "admin" && (
            <>
            <Button onClick={() => setAddOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 font-bold h-10 px-4 rounded-xl">
              <Plus className="h-4 w-4" /> Add Lead
            </Button>
            <Dialog open={addOpen} onOpenChange={(v) => { if (!v) { setForm(emptyForm); setAddOpen(false); } }}>
              {/* ── CREATE LEAD DIALOG ── */}
              <DialogContent className="max-w-lg flex flex-col p-0 border border-border rounded-2xl card-bg gap-0 max-h-[90vh]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
                  <DialogTitle className="text-lg font-bold text-foreground">Create Lead</DialogTitle>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Fill in the details to add a new lead</p>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="px-6 py-5 space-y-4">
                    {/* Row 1 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Full Name *">
                        <input className={fieldInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
                      </Field>
                      <Field label="Email *">
                        <input className={fieldInput} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@company.com" />
                      </Field>
                    </div>
                    {/* Row 2 — Mobile full width */}
                    <Field label="Mobile">
                      <PhoneInput
                        countryCode={form.countryCode}
                        phoneNumber={form.phone}
                        onCountryCodeChange={(c) => setForm({ ...form, countryCode: c })}
                        onPhoneNumberChange={(n) => setForm({ ...form, phone: n })}
                        variant="form"
                      />
                    </Field>
                    <Field label="Company">
                      <input className={fieldInput} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Tata Consultancy Ltd" />
                    </Field>
                    {/* Row 3 */}
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Status">
                        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                          <SelectTrigger className="h-11 card-elevated border border-border text-foreground rounded-xl text-sm font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="card-bg border-border">
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="text-foreground capitalize">{getStatusMeta(s).label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Assign To">
                        <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                          <SelectTrigger className="h-11 card-elevated border border-border text-foreground rounded-xl text-sm font-medium">
                            <SelectValue placeholder="Select owner" />
                          </SelectTrigger>
                          <SelectContent className="card-bg border-border z-[100]">
                            <SelectItem value="none" className="text-muted-foreground italic">Unassigned</SelectItem>
                            {teamMembers.map((m) => (
                              <SelectItem key={m.id} value={m.id} className="text-foreground">{m.full_name || m.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {/* Tags */}
                    <Field label="Tags">
                      <input className={fieldInput} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Qualified, Hot Lead, Decision Maker" />
                    </Field>
                    {/* Lead Score */}
                    <Field label={`Lead Score — ${form.lead_score}%`}>
                      <div className="pt-1">
                        <input
                          type="range" min="0" max="100" value={form.lead_score}
                          onChange={(e) => setForm({ ...form, lead_score: parseInt(e.target.value) })}
                          className="w-full h-2 bg-border rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground/40 mt-1 font-medium">
                          <span>0%</span><span>50%</span><span>100%</span>
                        </div>
                      </div>
                    </Field>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-border card-elevated">
                  <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending} className="w-full font-bold h-11 rounded-xl bg-primary hover:bg-primary/90">
                    {addMutation.isPending ? "Saving…" : "Save Lead"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </>
          )}
        </div>

        {/* ── Search ── */}
        <div className="relative group shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
          <input
            placeholder="Search by name, email, phone or tags…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full max-w-xl h-11 pl-10 pr-4 card-bg border border-border rounded-xl text-sm text-foreground font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* ── Bulk Action Bar — appears when items selected ── */}
        {selectedIds.length > 0 && userRole === "admin" && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/25">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[10px] font-black text-foreground">{selectedIds.length}</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {selectedIds.length} contact{selectedIds.length > 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50"
              >
                Clear
              </button>
              <button
                onClick={() => setBulkDeleteOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:border-red-500 px-3 py-1.5 rounded-lg transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selectedIds.length > 1 ? `All ${selectedIds.length}` : ""}
              </button>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="flex-1 min-h-0 flex flex-col rounded-[18px] border border-border card-bg overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {/* Mobile card view */}
            <div className="block md:hidden">
              {pagedLeads.map((lead) => {
                const owner  = teamMembers.find((m) => m.id === lead.assigned_to);
                const status = getStatusMeta(lead.status);
                const isHot  = (lead.lead_score ?? 0) > 80;
                return (
                  <div key={lead.id} className="border-b border-border p-4 hover:bg-primary/5 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{lead.name}</span>
                          {isHot && <Flame className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{lead.email}</p>
                        {lead.phone && <p className="text-xs text-primary font-bold mt-0.5">{lead.phone}</p>}
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${status.bg} ${status.border} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        {owner && (
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-primary" />{owner.full_name}
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-foreground">{lead.lead_score ?? 0}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => generateAiSummary(lead)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-purple-400">
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedLead(lead)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary">
                          <Clock className="h-3.5 w-3.5" />
                        </Button>
                        {userRole === "admin" && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(lead)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setContactToDelete(lead)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table view */}
            <table className="hidden md:table w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 card-bg">
                <tr className="border-b border-border">
                  <th className="w-12 px-4 py-2.5 text-center">
                    <Checkbox
                      checked={selectedIds.length === pagedLeads.length && pagedLeads.length > 0}
                      onCheckedChange={(c) => setSelectedIds(c ? pagedLeads.map((l) => l.id) : [])}
                    />
                  </th>
                  {/* Sortable: Lead Information, Lead Owner, Status */}
                  {[
                    { label: "Lead Information", sortKey: "name"   as const, align: "left"   },
                    { label: "Tags",             sortKey: null,               align: "left"   },
                    { label: "Lead Owner",       sortKey: "owner"  as const, align: "center" },
                    { label: "Score",            sortKey: null,               align: "center" },
                    { label: "Status",           sortKey: "status" as const, align: "left"   },
                    { label: "Actions",          sortKey: null,               align: "center" },
                  ].map(({ label, sortKey, align }) => (
                    <th
                      key={label}
                      className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70 ${
                        align === "center" ? "text-center" : "text-left"
                      } ${label === "Actions" ? "pr-6" : ""} ${sortKey ? "cursor-pointer select-none group/th hover:text-primary transition-colors" : ""}`}
                      onClick={() => sortKey && handleSort(sortKey)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey && (
                          <span className="flex flex-col leading-none opacity-40 group-hover/th:opacity-100 transition-opacity">
                            <svg className={`h-2 w-2 ${sortField === sortKey && sortDir === "asc" ? "text-primary opacity-100" : ""}`} viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
                            <svg className={`h-2 w-2 ${sortField === sortKey && sortDir === "desc" ? "text-primary opacity-100" : ""}`} viewBox="0 0 8 5" fill="currentColor"><path d="M4 5L0 0h8z"/></svg>
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedLeads.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-primary/8 flex items-center justify-center border border-primary/10">
                          <UserCheck className="h-6 w-6 text-primary/30" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground/70">{search ? "No contacts match your search" : "No contacts yet"}</p>
                        {!search && userRole === "admin" && <p className="text-xs text-muted-foreground/50">Click "Add Lead" to get started</p>}
                      </div>
                    </td>
                  </tr>
                )}

                {pagedLeads.map((lead, idx) => {
                  const owner  = teamMembers.find((m) => m.id === lead.assigned_to);
                  const status = getStatusMeta(lead.status);
                  const isHot  = (lead.lead_score ?? 0) > 80;

                  return (
                    <tr
                      key={lead.id}
                      className={`border-b border-border hover:bg-white/[0.025] transition-colors group/row ${idx === pagedLeads.length - 1 ? "border-b-0" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-2 text-center">
                        <Checkbox
                          checked={selectedIds.includes(lead.id)}
                          onCheckedChange={(c) =>
                            setSelectedIds((prev) => c ? [...prev, lead.id] : prev.filter((id) => id !== lead.id))
                          }
                        />
                      </td>

                      {/* Lead info */}
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1">
                          {/* Name */}
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-bold text-foreground leading-none">{lead.name}</span>
                            {isHot && <Flame className="h-3.5 w-3.5 text-orange-400 animate-pulse shrink-0" />}
                          </div>
                          {/* Email */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[12px] text-foreground/60 font-medium">{lead.email}</span>
                          </div>
                          {/* Phone */}
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 w-fit group/phone">
                              <Phone className="h-3 w-3 text-primary/70 shrink-0" />
                              <span className="text-[12px] text-primary font-bold group-hover/phone:text-primary/80 transition-colors">{lead.phone}</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Tags */}
                      <td className="px-4 py-2 max-w-[160px]">
                        <div className="flex flex-wrap gap-1.5">
                          {(lead.tags || []).length === 0 && (
                            <span className="text-[11px] text-muted-foreground/50 font-medium">—</span>
                          )}
                          {lead.tags?.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-4 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`inline-flex items-center gap-2 py-1.5 px-3 rounded-xl border text-[12px] font-bold ${
                            owner ? "bg-muted/50 border-border text-foreground" : "bg-muted/30 border-border text-muted-foreground/70"
                          }`}>
                            <UserCheck className={`h-3.5 w-3.5 shrink-0 ${owner ? "text-primary" : "text-muted-foreground/50"}`} />
                            {owner?.full_name || "Unassigned"}
                          </div>
                          {owner?.mobile_number && (
                            <a href={`tel:${owner.mobile_number}`} className="flex items-center gap-1 text-[11px] font-bold text-primary/80 hover:text-primary transition-colors">
                              <Phone className="h-2.5 w-2.5" />{owner.mobile_number}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[13px] font-black tabular-nums ${isHot ? "text-orange-400" : "text-foreground/80"}`}>
                            {lead.lead_score ?? 0}%
                          </span>
                          <div className="w-16 h-1.5 bg-white/8 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isHot ? "bg-orange-400" : "bg-primary"}`}
                              style={{ width: `${lead.lead_score ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${status.bg} ${status.border} ${status.color}`}>
                          {status.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2 pr-6 text-center">
                        <div className="flex justify-center gap-1 opacity-60 group-hover/row:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => generateAiSummary(lead)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-all">
                                <Sparkles className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>AI Lead Summary</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setSelectedLead(lead)}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                                <Clock className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Activity History</TooltipContent>
                          </Tooltip>
                          {userRole === "admin" && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleEditClick(lead)}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Lead</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => setContactToDelete(lead)}
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground/70 font-medium">
                Page {safePage} of {totalPages} · {filteredLeads.length} contacts
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
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
                      <span key={`e-${idx}`} className="h-8 w-6 flex items-center justify-center text-xs text-muted-foreground/50">…</span>
                    ) : (
                      <button key={item} onClick={() => setCurrentPage(item as number)}
                        className={`h-8 min-w-[2rem] px-2 rounded-lg text-xs font-bold transition-all ${
                          safePage === item ? "bg-primary/20 text-primary border border-primary/40" : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                        }`}>
                        {item}
                      </button>
                    )
                  )}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── EDIT LEAD DIALOG ── */}
        <Dialog open={editOpen} onOpenChange={(v) => { if (!v) setEditOpen(false); }}>
          <DialogContent className="max-w-lg flex flex-col p-0 border border-border rounded-2xl card-bg gap-0 max-h-[90vh]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <DialogTitle className="text-lg font-bold text-foreground">Edit Lead</DialogTitle>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Update lead information</p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Full Name *">
                    <input className={fieldInput} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </Field>
                  <Field label="Email *">
                    <input className={fieldInput} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  </Field>
                </div>
                {/* Mobile full width */}
                <Field label="Mobile">
                  <PhoneInput
                    countryCode={editForm.countryCode || "+91"}
                    phoneNumber={editForm.phone}
                    onCountryCodeChange={(c) => setEditForm({ ...editForm, countryCode: c })}
                    onPhoneNumberChange={(n) => setEditForm({ ...editForm, phone: n })}
                    variant="form"
                  />
                </Field>
                <Field label="Company">
                  <input className={fieldInput} value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} placeholder="Tata Consultancy Ltd" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Status">
                    <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                      <SelectTrigger className="h-11 card-elevated border border-border text-foreground rounded-xl text-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="card-bg border-border">
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="text-foreground capitalize">{getStatusMeta(s).label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Assign To">
                    <Select value={editForm.assigned_to} onValueChange={(v) => setEditForm({ ...editForm, assigned_to: v })}>
                      <SelectTrigger className="h-11 card-elevated border border-border text-foreground rounded-xl text-sm font-medium">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent className="card-bg border-border z-[100]">
                        <SelectItem value="none" className="text-muted-foreground italic">Unassigned</SelectItem>
                        {teamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-foreground">{m.full_name || m.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Tags">
                  <input className={fieldInput} value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="Qualified, Hot Lead, Decision Maker" />
                </Field>
                <Field label={`Lead Score — ${editForm.lead_score}%`}>
                  <div className="pt-1">
                    <input
                      type="range" min="0" max="100" value={editForm.lead_score}
                      onChange={(e) => setEditForm({ ...editForm, lead_score: parseInt(e.target.value) })}
                      className="w-full h-2 bg-border rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground/40 mt-1 font-medium">
                      <span>0%</span><span>50%</span><span>100%</span>
                    </div>
                  </div>
                </Field>
              </div>
            </div>
            <div className="px-6 py-4 shrink-0 border-t border-border card-elevated">
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full font-bold h-11 rounded-xl bg-primary hover:bg-primary/90">
                {updateMutation.isPending ? "Saving…" : "Apply Updates"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── BULK DELETE CONFIRMATION ── */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => { if (!o) setBulkDeleteOpen(false); }}>
          <AlertDialogContent className="card-bg border border-border rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete {selectedIds.length} contact{selectedIds.length > 1 ? "s" : ""}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove{" "}
                <span className="font-bold text-foreground">{selectedIds.length} selected contact{selectedIds.length > 1 ? "s" : ""}</span>{" "}
                and all their activity history. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" onClick={() => setBulkDeleteOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              >
                {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${selectedIds.length} Contact${selectedIds.length > 1 ? "s" : ""}`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── DELETE CONFIRMATION ── */}
        <AlertDialog open={!!contactToDelete} onOpenChange={(o) => { if (!o) setContactToDelete(null); }}>
          <AlertDialogContent className="card-bg border border-border rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete contact?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove{" "}
                <span className="font-bold text-foreground">{contactToDelete?.name}</span> and all activity history. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                onClick={() => contactToDelete && deleteMutation.mutate(contactToDelete.id)}>
                {deleteMutation.isPending ? "Deleting…" : "Delete Contact"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── ACTIVITY HISTORY SHEET ── */}
        <Sheet open={!!selectedLead} onOpenChange={(v) => !v && setSelectedLead(null)}>
          <SheetContent className="sm:max-w-md border-l border-border card-bg p-0">
            <div className="flex flex-col h-full">
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
                <SheetTitle className="font-bold text-lg text-foreground leading-none">{selectedLead?.name}</SheetTitle>
                <p className="text-[11px] text-muted-foreground font-medium mt-1">{selectedLead?.email}</p>
              </SheetHeader>

              {/* Note input */}
              <div className="px-5 py-4 shrink-0 border-b border-border">
                <label className={fieldLabel}>Log a Note</label>
                <div className="flex gap-2 mt-1.5">
                  <input
                    className={`${fieldInput} flex-1`}
                    placeholder="Type a note and press Enter…"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && logNote()}
                  />
                  <Button onClick={logNote} size="icon" className="h-11 w-11 shrink-0 rounded-xl">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Activity feed */}
              <ScrollArea className="flex-1 px-5 py-4">
                <div className="space-y-3 pb-8">
                  {activities.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <Clock className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground/60 font-medium">No activity yet</p>
                    </div>
                  )}
                  {activities.map((act) => (
                    <div key={act.id} className="relative bg-muted/30 border border-border rounded-xl p-4 overflow-hidden">
                      <div className="absolute left-0 inset-y-0 w-0.5 bg-primary/50 rounded-r" />
                      <div className="flex justify-between items-center mb-1.5 pl-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">{act.type}</span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono">{formatDistanceToNow(new Date(act.created_at))} ago</span>
                      </div>
                      <p className="text-[13px] text-foreground/75 leading-relaxed font-medium pl-1">{act.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>

      </div>

      {/* ── AI Lead Summary Panel ── */}
      {aiLead && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-end p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
          onClick={() => { setAiLead(null); setAiSummary(""); setAiError(null); }}
        >
          <div
            className="card-bg border border-border rounded-2xl w-full max-w-md h-full max-h-[90vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">AI Lead Summary</h2>
                  <p className="text-[11px] text-muted-foreground/60">{aiLead.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Regenerate button */}
                {aiSummary && !aiLoading && (
                  <button
                    onClick={() => generateAiSummary(aiLead)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-purple-400 hover:border-purple-500/30 transition-all"
                    title="Regenerate"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setAiLead(null); setAiSummary(""); setAiError(null); }}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Lead quick info bar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0 bg-purple-500/5">
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 font-bold text-sm text-purple-400">
                {aiLead.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{aiLead.name}</p>
                <p className="text-[11px] text-muted-foreground/60 truncate">{aiLead.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 uppercase">
                  {aiLead.status}
                </span>
                <span className="text-[11px] font-bold text-foreground">{aiLead.lead_score ?? 0}%</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Loading state */}
              {aiLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">Analysing lead data...</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Claude is reading deals, tasks, appointments and onboarding</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {aiError && !aiLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
                  <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <X className="h-6 w-6 text-red-400" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Something went wrong</p>
                  <p className="text-xs text-muted-foreground/50">{aiError}</p>
                  <button
                    onClick={() => generateAiSummary(aiLead)}
                    className="mt-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Summary content */}
              {aiSummary && !aiLoading && (
                <div className="space-y-4">
                  {aiSummary.split("\n").map((line, i) => {
                    if (!line.trim()) return null;

                    // Bold headers like **SUMMARY**
                    if (line.startsWith("**") && line.endsWith("**")) {
                      const label = line.replace(/\*\*/g, "");
                      const iconMap: Record<string, any> = {
                        "SUMMARY": Sparkles,
                        "STATUS ACROSS MODULES": Briefcase,
                        "⚡ RECOMMENDED NEXT ACTION": CheckSquare,
                      };
                      const Icon = iconMap[label] || Sparkles;
                      return (
                        <div key={i} className="flex items-center gap-2 mt-5 first:mt-0">
                          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">{label}</span>
                        </div>
                      );
                    }

                    // Bullet points
                    if (line.startsWith("- ") || line.startsWith("• ")) {
                      return (
                        <div key={i} className="flex items-start gap-2 pl-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0 mt-1.5" />
                          <p className="text-sm text-muted-foreground/80 leading-relaxed">{line.replace(/^[-•]\s/, "")}</p>
                        </div>
                      );
                    }

                    // Recommended next action block
                    if (i > 0 && aiSummary.split("\n")[i-2]?.includes("RECOMMENDED NEXT ACTION")) {
                      return (
                        <div key={i} className="p-3 rounded-xl bg-primary/8 border border-primary/20">
                          <p className="text-sm text-foreground font-medium leading-relaxed">{line}</p>
                        </div>
                      );
                    }

                    // Regular paragraph
                    return (
                      <p key={i} className="text-sm text-muted-foreground/80 leading-relaxed">{line}</p>
                    );
                  })}

                  {/* Footer note */}
                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-[10px] text-muted-foreground/30 text-center">
                      Generated by Claude AI · Click ↻ to regenerate
                    </p>
                  </div>
                </div>
              )}

              {/* Initial empty state — before generation */}
              {!aiSummary && !aiLoading && !aiError && (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-12 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">AI Lead Summary</p>
                    <p className="text-xs text-muted-foreground/50 mt-1 max-w-[260px]">
                      Claude will analyse all data for {aiLead.name} — deals, tasks, appointments and onboarding — and suggest the best next action.
                    </p>
                  </div>
                  <button
                    onClick={() => generateAiSummary(aiLead)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 text-sm font-bold hover:bg-purple-500/25 transition-all"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Summary
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </TooltipProvider>
  );
}