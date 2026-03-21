import { useState } from "react";
import { DollarSign, User, GripVertical, Trash2, Pencil, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed"];

const STAGE_META: Record<string, { color: string; badge: string; dot: string }> = {
  Lead:        { color: "#60a5fa", badge: "border-blue-500/30 bg-blue-500/10 text-blue-400",      dot: "bg-blue-400"    },
  Qualified:   { color: "#a78bfa", badge: "border-purple-500/30 bg-purple-500/10 text-purple-400", dot: "bg-purple-400"  },
  Proposal:    { color: "#f59e0b", badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",    dot: "bg-amber-400"   },
  Negotiation: { color: "#facc15", badge: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-400"  },
  Closed:      { color: "#10b981", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const stripCurrency = (raw: unknown) => String(raw ?? "").replace(/[^0-9.-]/g, "");
const formatForDb   = (raw: string)  => { const c = stripCurrency(raw); return c === "" ? "0" : c; };
const formatForCard = (raw: unknown) => { const c = stripCurrency(raw); return c === "" ? "0" : c; };
const columnTotal   = (deals: any[]) => {
  const t = deals.reduce((acc, d) => acc + (parseFloat(stripCurrency(d.value)) || 0), 0);
  return t === 0 ? "$0" : `$${t.toLocaleString()}`;
};

// ─── Contact Search Dropdown ─────────────────────────────────────────────────

type Contact = { id: string; name: string; email: string; company: string | null };

function ContactPicker({
  contacts,
  value,       // currently selected contact_id
  onChange,
}: {
  contacts: Contact[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = contacts.find((c) => c.id === value) ?? null;

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative">
      {/* Selected contact chip OR search trigger */}
      {selected && !open ? (
        <div className="flex items-center justify-between h-10 px-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground">
          <span className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-medium">{selected.name}</span>
            <span className="text-muted-foreground text-xs">{selected.email}</span>
          </span>
          <button
            type="button"
            onClick={() => { onChange(null); setSearch(""); }}
            className="text-muted-foreground hover:text-foreground transition-colors ml-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search contact by name, email or company…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="pl-8 bg-muted border-border text-foreground placeholder:text-muted-foreground/50 h-10"
          />
        </div>
      )}

      {/* Dropdown list */}
      {open && !selected && (
        <>
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full rounded-[12px] card-bg border border-border shadow-2xl shadow-black/50 overflow-hidden">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground/60 text-center">No contacts found</p>
            ) : (
              <ul className="max-h-48 overflow-y-auto">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(c.id); setOpen(false); setSearch(""); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-purple-500/10 transition-colors text-left"
                    >
                      <div className="h-7 w-7 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-purple-400">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground/60 truncate">{c.email}</p>
                      </div>
                      {c.company && (
                        <span className="ml-auto text-[10px] text-muted-foreground/40 shrink-0">{c.company}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* Option to clear / unlink */}
            {value && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
                className="w-full px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-t border-border text-left"
              >
                Remove contact link
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Pipeline Page ────────────────────────────────────────────────────────────

const Pipeline = () => {
  const [draggedDeal, setDraggedDeal]     = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete]   = useState<string | null>(null);

  // ── Touch drag state for mobile ────────────────────────────────────────────
  const touchDealRef = { current: null as string | null };

  const handleTouchStart = (dealId: string) => {
    touchDealRef.current = dealId;
    setDraggedDeal(dealId);
  };

  const handleTouchEnd = (e: React.TouchEvent, stage: string) => {
    e.preventDefault();
    if (!touchDealRef.current) return;
    const deal = deals.find((d: any) => d.id === touchDealRef.current);
    if (deal && deal.stage !== stage) {
      updateStage.mutate({ id: touchDealRef.current, stage });
    }
    touchDealRef.current = null;
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  // Edit dialog state
  const [editDealId, setEditDealId]   = useState<string | null>(null);
  const [editName, setEditName]       = useState("");
  const [editValue, setEditValue]     = useState("");
  const [editContactId, setEditContactId] = useState<string | null>(null);

  // Add dialog state
  const [addStage, setAddStage]       = useState<string | null>(null);
  const [addName, setAddName]         = useState("");
  const [addValue, setAddValue]       = useState("");
  const [addContactId, setAddContactId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Load all contacts for the picker
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-for-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, company")
        .order("name");
      if (error) throw error;
      return data as Contact[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
    onError: (e: Error) => toast.error(`Failed to update: ${e.message}`),
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
    onError: (e: Error) => toast.error(`Failed to delete: ${e.message}`),
  });

  const updateDeal = useMutation({
    mutationFn: async ({ id, name, value, contact_id }: { id: string; name: string; value: string; contact_id: string | null }) => {
      // If a contact is linked, also sync the company name
      const linkedContact = contacts.find((c) => c.id === contact_id);
      const { error } = await supabase.from("deals").update({
        name: name.trim(),
        value: formatForDb(value),
        contact_id: contact_id ?? null,
        company: linkedContact?.company ?? linkedContact?.name ?? "Manual",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-chart"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-activity"] }),
      ]);
      setEditDealId(null);
      toast.success("Deal updated");
    },
    onError: (e: Error) => toast.error(`Failed to update: ${e.message}`),
  });

  const addDeal = useMutation({
    mutationFn: async ({ stage, name, value, contact_id }: { stage: string; name: string; value: string; contact_id: string | null }) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const linkedContact = contacts.find((c) => c.id === contact_id);
      const { error } = await supabase.from("deals").insert({
        name: trimmed,
        company: linkedContact?.company ?? linkedContact?.name ?? "Manual",
        stage,
        value: formatForDb(value),
        contact_id: contact_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-chart"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-activity"] }),
      ]);
      setAddStage(null);
      setAddName("");
      setAddValue("");
      setAddContactId(null);
      toast.success("Deal added");
    },
    onError: (e: Error) => toast.error(`Failed to add: ${e.message}`),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleDrop = (stage: string) => {
    if (!draggedDeal) return;
    updateStage.mutate({ id: draggedDeal, stage });
    setDraggedDeal(null);
    setDragOverStage(null);
  };

  const openEdit = (deal: any) => {
    setEditDealId(deal.id);
    setEditName(deal.name ?? "");
    setEditValue(formatForCard(deal.value));
    setEditContactId(deal.contact_id ?? null);
  };

  const selectedDeal   = deals.find((d) => d.id === dealToDelete);
  const editDealObject = deals.find((d) => d.id === editDealId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col overflow-hidden page-bg px-6 pt-5 pb-5">

      {/* Header */}
      <div className="mb-5 shrink-0">
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tighter text-foreground">Pipeline</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Drag deals between stages to update their status</p>
      </div>

      {/* Kanban board */}
      <div className="flex-1 flex gap-3 md:gap-4 overflow-x-auto pb-2 min-h-0 touch-pan-x">
        {stages.map((stage) => {
          const meta       = STAGE_META[stage];
          const stageDeals = deals.filter((d) => d.stage === stage);
          const isOver     = dragOverStage === stage;

          return (
            <div
              key={stage}
              className="flex-shrink-0 w-[17rem] flex flex-col"
              onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
              onDragLeave={() => setDragOverStage(null)}
              onTouchMove={(e) => { e.preventDefault(); setDragOverStage(stage); }}
              onTouchEnd={(e) => handleTouchEnd(e, stage)}
              onDrop={() => handleDrop(stage)}
            >
              {/* Column header */}
              <div
                className="rounded-[16px] px-3 py-3 mb-3 border card-bg transition-all duration-200"
                style={{
                  borderColor: isOver ? meta.color + "60" : "rgba(255,255,255,0.06)",
                  boxShadow:   isOver ? `0 0 18px ${meta.color}25` : "none",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    <h3 className="text-sm font-bold tracking-wide" style={{ color: meta.color }}>{stage}</h3>
                    <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${meta.badge}`}>
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setAddStage(stage); setAddName(""); setAddValue(""); setAddContactId(null); }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] font-bold mt-1.5 tabular-nums" style={{ color: meta.color + "99" }}>
                  {columnTotal(stageDeals)}
                </p>
              </div>

              {/* Cards */}
              <div
                className="flex-1 rounded-[16px] p-2 space-y-2 overflow-y-auto transition-all duration-200"
                style={{
                  background: isOver ? `${meta.color}08` : "rgba(255,255,255,0.015)",
                  border: `1px solid ${isOver ? meta.color + "30" : "rgba(255,255,255,0.04)"}`,
                  minHeight: "120px",
                }}
              >
                {stageDeals.map((deal) => {
                  // Resolve linked contact name for display
                  const linkedContact = contacts.find((c) => c.id === deal.contact_id);

                  return (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggedDeal(deal.id)}
                      onDragEnd={() => { setDraggedDeal(null); setDragOverStage(null); }}
                      onTouchStart={() => handleTouchStart(deal.id)}
                      className="group rounded-[12px] p-3.5 border border-border card-bg cursor-grab active:cursor-grabbing transition-all duration-200 hover:border-purple-500/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10"
                      style={{ opacity: draggedDeal === deal.id ? 0.45 : 1 }}
                    >
                      {/* Deal name + action buttons */}
                      <div className="flex items-start justify-between mb-2.5">
                        <span className="text-sm font-semibold text-foreground leading-snug pr-1">{deal.name}</span>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => { e.stopPropagation(); openEdit(deal); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-400 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setDealToDelete(deal.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 ml-0.5" />
                        </div>
                      </div>

                      {/* Linked contact — shows name if linked, company if not */}
                      <div className="flex items-center gap-1.5 text-[11px] mb-2">
                        <User className="h-3 w-3 shrink-0" style={{ color: linkedContact ? meta.color : undefined }} />
                        {linkedContact ? (
                          <span className="font-semibold" style={{ color: meta.color }}>
                            {linkedContact.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">{deal.company}</span>
                        )}
                      </div>

                      {/* Value chip */}
                      <div
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: meta.color, background: meta.color + "15", border: `1px solid ${meta.color}30` }}
                      >
                        <DollarSign className="h-3 w-3" />
                        {formatForCard(deal.value)}
                      </div>
                    </div>
                  );
                })}

                {/* Empty state */}
                {stageDeals.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="h-8 w-8 rounded-full mb-2 flex items-center justify-center" style={{ background: meta.color + "15" }}>
                      <Plus className="h-4 w-4" style={{ color: meta.color + "80" }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground/40">No deals yet</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ADD DEAL DIALOG ── */}
      <Dialog open={!!addStage} onOpenChange={(o) => { if (!o) setAddStage(null); }}>
        <DialogContent className="card-bg border border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Deal</DialogTitle>
            <DialogDescription>
              Create a new deal in{" "}
              <span className="font-semibold" style={{ color: addStage ? STAGE_META[addStage]?.color : undefined }}>
                {addStage}
              </span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Deal name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Deal Name *</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Website Redesign"
                className="bg-muted border-border text-foreground"
              />
            </div>

            {/* Value */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Value ($)</Label>
              <Input
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className="bg-muted border-border text-foreground"
              />
            </div>

            {/* Contact picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Linked Contact <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span>
              </Label>
              <ContactPicker contacts={contacts} value={addContactId} onChange={setAddContactId} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStage(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!addStage) return;
                if (!addName.trim()) { toast.error("Deal name is required"); return; }
                addDeal.mutate({ stage: addStage, name: addName, value: addValue, contact_id: addContactId });
              }}
              disabled={addDeal.isPending}
            >
              {addDeal.isPending ? "Adding…" : "Add Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DEAL DIALOG ── */}
      <Dialog open={!!editDealId} onOpenChange={(o) => { if (!o) setEditDealId(null); }}>
        <DialogContent className="card-bg border border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Deal</DialogTitle>
            <DialogDescription>Update the deal name, value and linked contact.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Deal name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Deal Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>

            {/* Value */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Value ($)</Label>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className="bg-muted border-border text-foreground"
              />
            </div>

            {/* Contact picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Linked Contact <span className="text-muted-foreground/40 normal-case font-normal">(optional)</span>
              </Label>
              <ContactPicker contacts={contacts} value={editContactId} onChange={setEditContactId} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDealId(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editDealId) return;
                if (!editName.trim()) { toast.error("Deal name is required"); return; }
                updateDeal.mutate({ id: editDealId, name: editName, value: editValue, contact_id: editContactId });
              }}
              disabled={updateDeal.isPending || !editDealObject}
            >
              {updateDeal.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRMATION ── */}
      <AlertDialog open={!!dealToDelete} onOpenChange={(o) => !o && setDealToDelete(null)}>
        <AlertDialogContent className="card-bg border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete deal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold text-foreground">{selectedDeal?.name || "this deal"}</span>{" "}
              from your pipeline. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-foreground"
              onClick={() => dealToDelete && deleteDeal.mutate(dealToDelete)}
            >
              {deleteDeal.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Pipeline;