import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Mail, MessageSquare, GitBranch, Clock,
  Trash2, ToggleLeft, ToggleRight, Send, ChevronDown, ChevronUp,
  Megaphone, X, ChevronLeft, ChevronRight,
  Bold, Italic, Underline, Link, Palette,
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
import { formatDistanceToNow } from "date-fns";

// ─── Constants ────────────────────────────────────────────────────────────────

// ── FIXED: increased from 8 to 10 ──
const CAMPAIGNS_PER_PAGE = 10;

const STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed"];

const STAGE_COLORS: Record<string, string> = {
  Lead:        "border-blue-500/30 bg-blue-500/10 text-blue-400",
  Qualified:   "border-purple-500/30 bg-purple-500/10 text-purple-400",
  Proposal:    "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Negotiation: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  Closed:      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

const emptyForm = {
  name: "",
  trigger_type: "stage" as "stage" | "time",
  stage: "Qualified",
  days_after: 3,
  email_subject: "",
  email_body: "",
  whatsapp_message: "",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  name: string;
  trigger_type: "stage" | "time";
  stage: string | null;
  days_after: number | null;
  email_subject: string;
  email_body: string;
  whatsapp_message: string;
  is_active: boolean;
  created_at: string;
};

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: "White",   value: "#ffffff" },
  { label: "Red",     value: "#f87171" },
  { label: "Green",   value: "#4ade80" },
  { label: "Blue",    value: "#60a5fa" },
  { label: "Yellow",  value: "#facc15" },
  { label: "Purple",  value: "#c084fc" },
  { label: "Orange",  value: "#fb923c" },
];

function RichTextEditor({
  value, onChange, placeholder, rows = 5,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const editorRef  = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [showLink, setShowLink]     = useState(false);
  const [linkUrl, setLinkUrl]       = useState("");
  const savedRange = useRef<Range | null>(null);
  const isInternal = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      isInternal.current = false;
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    if (!savedRange.current) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    isInternal.current = true;
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleInput = () => {
    isInternal.current = true;
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleLink = () => {
    restoreSelection();
    if (linkUrl.trim()) exec("createLink", linkUrl.trim());
    setShowLink(false);
    setLinkUrl("");
  };

  const minHeight = `${rows * 1.75}rem`;

  return (
    <div className="rounded-xl border border-border overflow-hidden focus-within:border-primary/50 transition-colors">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-background/80 flex-wrap">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all" title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all" title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all" title="Underline">
          <Underline className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <div className="relative">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); saveSelection(); setShowColors((v) => !v); setShowLink(false); }} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all" title="Text Color">
            <Palette className="h-3.5 w-3.5" />
          </button>
          {showColors && (
            <div className="absolute top-8 left-0 z-[99999] bg-popover border border-border rounded-xl p-2 shadow-xl flex flex-wrap gap-1.5 w-40">
              {TEXT_COLORS.map((c) => (
                <button key={c.value} type="button" title={c.label} onMouseDown={(e) => { e.preventDefault(); restoreSelection(); exec("foreColor", c.value); setShowColors(false); }} className="h-6 w-6 rounded-full border-2 border-border hover:scale-110 transition-transform" style={{ backgroundColor: c.value }} />
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button type="button" onMouseDown={(e) => { e.preventDefault(); saveSelection(); setShowLink((v) => !v); setShowColors(false); }} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all" title="Insert Link">
            <Link className="h-3.5 w-3.5" />
          </button>
          {showLink && (
            <div className="absolute top-8 left-0 z-[99999] bg-popover border border-border rounded-xl p-2 shadow-xl w-56 space-y-2">
              <input autoFocus placeholder="https://example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLink()} className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
              <div className="flex gap-1.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleLink(); }} className="flex-1 text-xs font-bold bg-primary text-white rounded-lg py-1 hover:bg-primary/90 transition-colors">Insert</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setShowLink(false); setLinkUrl(""); }} className="flex-1 text-xs font-bold border border-border rounded-lg py-1 text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }} className="h-7 px-2 flex items-center justify-center rounded-md text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all" title="Clear Formatting">
          Clear
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={() => setShowColors(false)}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="w-full bg-background/50 text-foreground text-sm px-3 py-2.5 focus:outline-none leading-relaxed [&[data-placeholder]:empty:before]:content-[attr(data-placeholder)] [&[data-placeholder]:empty:before]:text-muted-foreground/40 [&[data-placeholder]:empty:before]:pointer-events-none"
      />
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign, onToggle, onDelete, onExpand, expanded,
}: {
  campaign: Campaign;
  onToggle: () => void;
  onDelete: () => void;
  onExpand: () => void;
  expanded: boolean;
}) {
  const isStage = campaign.trigger_type === "stage";
  return (
    <div className={`rounded-[16px] border card-bg transition-all duration-200 ${
      campaign.is_active ? "border-border hover:border-primary/30" : "border-border opacity-60"
    }`}>
      {/* ── FIXED: reduced padding from p-4 to p-3 ── */}
      <div className="flex items-center gap-3 p-3">
        {/* ── FIXED: reduced icon size from h-10 w-10 to h-8 w-8 ── */}
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
          isStage ? "bg-purple-500/10 border border-purple-500/20" : "bg-amber-500/10 border border-amber-500/20"
        }`}>
          {/* ── FIXED: reduced icon from h-4 w-4 to h-3.5 w-3.5 ── */}
          {isStage ? <GitBranch className="h-3.5 w-3.5 text-purple-400" /> : <Clock className="h-3.5 w-3.5 text-amber-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{campaign.name}</span>
            {!campaign.is_active && (
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground/50">Paused</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {isStage && campaign.stage && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STAGE_COLORS[campaign.stage] ?? "border-border text-muted-foreground"}`}>
                When deal → {campaign.stage}
              </span>
            )}
            {!isStage && campaign.days_after && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                {campaign.days_after} days after lead added
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
              <Mail className="h-2.5 w-2.5" /> Email
            </span>
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
              <MessageSquare className="h-2.5 w-2.5" /> WhatsApp
            </span>
            <span className="text-[10px] text-muted-foreground/35">
              · Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onExpand} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={onToggle} className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${
            campaign.is_active
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              : "border-border text-muted-foreground/40 hover:text-foreground"
          }`}>
            {campaign.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button onClick={onDelete} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-background/50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Email</span>
              </div>
              <p className="text-xs font-bold text-foreground">Subject: {campaign.email_subject}</p>
              <div className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-3" dangerouslySetInnerHTML={{ __html: campaign.email_body }} />
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">WhatsApp</span>
              </div>
              <div className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-4" dangerouslySetInnerHTML={{ __html: campaign.whatsapp_message }} />
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
            <span className="text-[10px] font-bold text-primary/70 leading-relaxed">
              💡 Variables: <code className="bg-primary/10 px-1 rounded">{"{{contact_name}}"}</code> <code className="bg-primary/10 px-1 rounded">{"{{deal_name}}"}</code> <code className="bg-primary/10 px-1 rounded">{"{{stage}}"}</code> <code className="bg-primary/10 px-1 rounded">{"{{assignee_name}}"}</code>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Campaigns Page ───────────────────────────────────────────────────────────

const Campaigns = () => {
  const [createOpen, setCreateOpen]             = useState(false);
  const modalOpenRef = useRef(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [expandedId, setExpandedId]             = useState<string | null>(null);
  const [form, setForm]                         = useState(emptyForm);
  const [filterType, setFilterType]             = useState<"all" | "stage" | "time">("all");
  const [currentPage, setCurrentPage]           = useState(1);

  const queryClient = useQueryClient();

  useEffect(() => {
    modalOpenRef.current = createOpen;
    document.body.style.overflow = createOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [createOpen]);

  useEffect(() => {
    const noop = (e: Event) => { if (modalOpenRef.current) e.stopImmediatePropagation(); };
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

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim())             throw new Error("Campaign name is required");
      if (!form.email_subject.trim())    throw new Error("Email subject is required");
      if (!form.email_body.trim())       throw new Error("Email body is required");
      if (!form.whatsapp_message.trim()) throw new Error("WhatsApp message is required");
      if (form.trigger_type === "stage" && !form.stage) throw new Error("Please select a stage");
      if (form.trigger_type === "time" && (!form.days_after || form.days_after < 1)) throw new Error("Please enter valid number of days");
      const { error } = await supabase.from("campaigns").insert({
        name:             form.name.trim(),
        trigger_type:     form.trigger_type,
        stage:            form.trigger_type === "stage" ? form.stage : null,
        days_after:       form.trigger_type === "time" ? form.days_after : null,
        email_subject:    form.email_subject.trim(),
        email_body:       form.email_body.trim(),
        whatsapp_message: form.whatsapp_message.trim(),
        is_active:        true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast.success("Campaign created successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("campaigns").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCampaignToDelete(null);
      toast.success("Campaign deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Filtered + Pagination ──────────────────────────────────────────────────

  const filtered = campaigns.filter((c) =>
    filterType === "all" ? true : c.trigger_type === filterType
  );

  const activeCount = campaigns.filter((c) => c.is_active).length;
  const stageCount  = campaigns.filter((c) => c.trigger_type === "stage").length;
  const timeCount   = campaigns.filter((c) => c.trigger_type === "time").length;

  const totalPages     = Math.max(1, Math.ceil(filtered.length / CAMPAIGNS_PER_PAGE));
  const safePage       = Math.min(currentPage, totalPages);
  const pagedCampaigns = filtered.slice((safePage - 1) * CAMPAIGNS_PER_PAGE, safePage * CAMPAIGNS_PER_PAGE);

  const handleFilterChange = (f: typeof filterType) => {
    setFilterType(f);
    setCurrentPage(1);
  };

  const fieldLabel = "text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block";
  const fieldInput = "w-full bg-background/50 border-border text-foreground text-sm";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    // ── FIXED: reduced pt-5 pb-5 gap-4 to pt-3 pb-3 gap-2 ──
    <div className="h-full w-full flex flex-col overflow-hidden page-bg px-6 pt-3 pb-3 gap-2">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          {/* ── FIXED: reduced heading from text-2xl md:text-3xl to text-xl md:text-2xl ── */}
          <h1 className="text-xl md:text-2xl font-display font-bold tracking-tighter text-foreground">Campaigns</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Automated messages triggered by pipeline stage or time</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 font-bold">
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        {[
          { label: "Total Campaigns", value: campaigns.length, color: "text-foreground"  },
          { label: "Active",          value: activeCount,       color: "text-emerald-400" },
          { label: "Stage Triggered", value: stageCount,        color: "text-purple-400"  },
        ].map((s) => (
          // ── FIXED: reduced py-3 to py-1.5, px-4 to px-3, text sizes reduced ──
          <div key={s.label} className="card-bg border border-border rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{s.label}</span>
            <span className={`text-lg font-black tabular-nums ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {(["all", "stage", "time"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
                filterType === f
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground/50 hover:text-muted-foreground border border-transparent"
              }`}
            >
              {f === "all" ? `All (${campaigns.length})` : f === "stage" ? `Stage (${stageCount})` : `Time (${timeCount})`}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground/40 font-medium">
          {filtered.length} campaign{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Campaign list ── */}
      {/* ── FIXED: reduced space-y-3 to space-y-1.5 ── */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-[16px] bg-muted/20 animate-pulse" />)}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 border border-primary/10">
              <Megaphone className="h-6 w-6 text-primary/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground/50">No campaigns yet</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Click "New Campaign" to create your first one</p>
          </div>
        )}
        {!isLoading && pagedCampaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            expanded={expandedId === campaign.id}
            onExpand={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
            onToggle={() => toggleMutation.mutate({ id: campaign.id, is_active: !campaign.is_active })}
            onDelete={() => setCampaignToDelete(campaign)}
          />
        ))}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/40 font-medium">
            Page {safePage} of {totalPages} · {filtered.length} campaigns
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setCurrentPage(p)} className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold border transition-all ${
                p === safePage
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border text-muted-foreground/50 hover:text-foreground hover:border-primary/20"
              }`}>
                {p}
              </button>
            ))}
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      {/* ── FIXED: reduced p-3 to p-2 ── */}
      <div className="shrink-0 flex items-start gap-3 p-2 rounded-[12px] bg-primary/5 border border-primary/15">
        <Send className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground/60 leading-relaxed">
          <strong className="text-primary/80">How it works:</strong> Stage campaigns fire when a deal moves to the selected stage in Pipeline. Time-based campaigns run daily at 9AM and send to contacts added exactly X days ago. Both send Email + WhatsApp to the <strong>contact</strong> and their <strong>assigned sales person</strong> via n8n.
        </div>
      </div>

      {/* ── Custom Modal ── */}
      {createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: createOpen ? "flex" : "none",
            pointerEvents: createOpen ? "all" : "none",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="card-bg border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">New Campaign</h2>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Automated Email + WhatsApp triggered by pipeline stage or time.</p>
              </div>
              <button onClick={() => { setCreateOpen(false); setForm(emptyForm); }} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all shrink-0 ml-4">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className={fieldLabel}>Campaign Name *</label>
                <Input className={fieldInput} placeholder="e.g. Qualified Lead Welcome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div>
                <label className={fieldLabel}>Trigger Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: "stage" as const, icon: GitBranch, label: "Stage Change", sub: "When deal moves to a stage", color: "border-purple-500/50 bg-purple-500/10 text-purple-400" },
                    { type: "time"  as const, icon: Clock,     label: "Time-Based",   sub: "X days after lead added",     color: "border-amber-500/50 bg-amber-500/10 text-amber-400"  },
                  ].map(({ type, icon: Icon, label, sub, color }) => (
                    <button key={type} type="button" onClick={() => setForm({ ...form, trigger_type: type })} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${form.trigger_type === type ? color : "border-border text-muted-foreground"}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs font-bold">{label}</p>
                        <p className="text-[10px] opacity-70">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {form.trigger_type === "stage" ? (
                <div>
                  <label className={fieldLabel}>Trigger Stage *</label>
                  <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                    <SelectTrigger className={`${fieldInput} h-10`}><SelectValue placeholder="Select stage" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border" style={{ zIndex: 99999 }}>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s} className="text-sm">
                          <span className={`inline-flex items-center gap-2 text-xs font-bold px-2 py-0.5 rounded-full border ${STAGE_COLORS[s]}`}>{s}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Campaign fires when any deal moves to this stage</p>
                </div>
              ) : (
                <div>
                  <label className={fieldLabel}>Days After Lead Added *</label>
                  <div className="flex items-center gap-3">
                    <Input type="number" min={1} max={365} className={`${fieldInput} w-24`} value={form.days_after} onChange={(e) => setForm({ ...form, days_after: parseInt(e.target.value) || 1 })} />
                    <span className="text-sm text-muted-foreground">days after contact was created</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Runs daily at 9AM, sends to matching contacts</p>
                </div>
              )}

              <div className="border-t border-border" />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">Email Content</span>
                </div>
                <div>
                  <label className={fieldLabel}>Subject *</label>
                  <Input className={fieldInput} placeholder="e.g. Great news, {{contact_name}}! 🎉" value={form.email_subject} onChange={(e) => setForm({ ...form, email_subject: e.target.value })} />
                </div>
                <div>
                  <label className={fieldLabel}>Body *</label>
                  <RichTextEditor value={form.email_body} onChange={(html) => setForm((f) => ({ ...f, email_body: html }))} placeholder={`Hi {{contact_name}},\n\nThank you for your interest...\n\nBest regards,\n{{assignee_name}}`} rows={5} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-foreground">WhatsApp Message</span>
                </div>
                <div>
                  <label className={fieldLabel}>Message *</label>
                  <RichTextEditor value={form.whatsapp_message} onChange={(html) => setForm((f) => ({ ...f, whatsapp_message: html }))} placeholder={`Hi {{contact_name}} 👋\n\nWe are excited to move forward...\n\n- {{assignee_name}}`} rows={4} />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Available Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {["{{contact_name}}", "{{contact_email}}", "{{contact_phone}}", "{{deal_name}}", "{{stage}}", "{{assignee_name}}"].map((v) => (
                    <code key={v} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">{v}</code>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/50">n8n replaces these with real values when the campaign fires.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(emptyForm); }}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="gap-2 font-bold">
                <Send className="h-4 w-4" />
                {createMutation.isPending ? "Creating…" : "Create Campaign"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!campaignToDelete} onOpenChange={(o) => { if (!o) setCampaignToDelete(null); }}>
        <AlertDialogContent className="card-bg border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{campaignToDelete?.name}</strong>. The campaign will stop firing immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white rounded-xl" onClick={() => campaignToDelete && deleteMutation.mutate(campaignToDelete.id)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Campaigns;