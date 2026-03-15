import { useState } from "react";
import { Search, Plus, Mail, Phone, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  added_at: string;
};

type Deal = {
  id: string;
  name: string;
  company: string;
  value: string;
  stage: string;
};

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
};

const EMPTY_LEAD_FORM: LeadForm = { name: "", email: "", phone: "", company: "" };

const statusBadgeClass = (status: string) => {
  if (status === "New" || status === "Lead") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (status === "Negotiation") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  if (status === "Proposal") return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (status === "Closed" || status === "Closed Won") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (status === "Closed Lost") return "border-red-500/30 bg-red-500/10 text-red-400";
  return "border-border bg-muted text-muted-foreground";
};

const normalizeLeadForm = (form: LeadForm) => ({
  name: form.name.trim(),
  email: form.email.trim().toLowerCase(),
  phone: form.phone.trim(),
  company: form.company.trim(),
});

const validateLeadForm = (form: LeadForm) => {
  const normalized = normalizeLeadForm(form);

  if (!normalized.name) return "Name is required";
  if (!normalized.email) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) return "Please enter a valid email address";
  if (normalized.name.length > 100) return "Name must be 100 characters or less";
  if (normalized.email.length > 255) return "Email must be 255 characters or less";
  if (normalized.phone.length > 30) return "Phone must be 30 characters or less";
  if (normalized.company.length > 120) return "Company must be 120 characters or less";

  return null;
};

const Contacts = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(EMPTY_LEAD_FORM);
  const [editForm, setEditForm] = useState<LeadForm>(EMPTY_LEAD_FORM);
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: selectedLeadDeals = [] } = useQuery({
    queryKey: ["contact-deals", selectedLead?.company],
    queryFn: async () => {
      if (!selectedLead?.company) return [];
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("company", selectedLead.company)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!selectedLead?.company,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizeLeadForm(form);

      const { data: insertedLead, error: contactError } = await supabase
        .from("contacts")
        .insert({
          name: normalized.name,
          email: normalized.email,
          phone: normalized.phone || null,
          company: normalized.company || null,
        })
        .select("id")
        .maybeSingle();

      if (contactError) throw contactError;

      const { error: dealError } = await supabase.from("deals").insert({
        name: normalized.name,
        company: normalized.company || "Unknown",
        stage: "Lead",
        value: "$0",
      });

      if (dealError) {
        if (insertedLead?.id) {
          await supabase.from("contacts").delete().eq("id", insertedLead.id);
        }
        throw new Error(`Lead created but deal auto-sync failed: ${dealError.message}`);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["pipeline-chart"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-activity"] }),
      ]);
      setForm(EMPTY_LEAD_FORM);
      setOpen(false);
      toast.success("Lead added and synced to pipeline");
    },
    onError: (error: Error) => toast.error(`Failed to add lead: ${error.message}`),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingLead) throw new Error("No lead selected for editing");
      const normalized = normalizeLeadForm(editForm);

      const { error } = await supabase
        .from("contacts")
        .update({
          name: normalized.name,
          email: normalized.email,
          phone: normalized.phone || null,
          company: normalized.company || null,
        })
        .eq("id", editingLead.id);

      if (error) throw error;

      return {
        id: editingLead.id,
        name: normalized.name,
        email: normalized.email,
        phone: normalized.phone || null,
        company: normalized.company || null,
      };
    },
    onSuccess: async (updatedLead) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["contact-deals"] }),
      ]);

      setSelectedLead((current) => (current?.id === updatedLead.id ? { ...current, ...updatedLead } : current));
      setEditOpen(false);
      setEditingLead(null);
      toast.success("Lead updated");
    },
    onError: (error: Error) => toast.error(`Failed to update lead: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (lead: Lead) => {
      const { error } = await supabase.from("contacts").delete().eq("id", lead.id);
      if (error) throw error;
      return lead.id;
    },
    onSuccess: async (deletedId) => {
      await queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedLead((current) => (current?.id === deletedId ? null : current));
      setContactToDelete(null);
      toast.success("Lead deleted");
    },
    onError: (error: Error) => toast.error(`Failed to delete lead: ${error.message}`),
  });

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      (l.company || "").toLowerCase().includes(search.toLowerCase())
  );

  const addLead = () => {
    const validationError = validateLeadForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    addMutation.mutate();
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || "",
      company: lead.company || "",
    });
    setEditOpen(true);
  };

  const saveEditLead = () => {
    const validationError = validateLeadForm(editForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    editMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Contacts</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your leads and contacts</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 transition-all duration-200">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border animate-[fade-in_0.2s_ease-out]">
            <DialogHeader>
              <DialogTitle className="font-display">Add New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="bg-muted border-border" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" className="bg-muted border-border" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0100" className="bg-muted border-border" />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" className="bg-muted border-border" />
              </div>
              <Button onClick={addLead} className="w-full transition-all duration-200" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adding..." : "Add Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border animate-[fade-in_0.2s_ease-out]">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="bg-muted border-border" />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="bg-muted border-border" />
            </div>
            <Button onClick={saveEditLead} className="w-full transition-all duration-200" disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="glass-card rounded-lg overflow-hidden animate-[fade-in_0.2s_ease-out]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-surface-elevated/50">
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Email</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider hidden md:table-cell">Phone</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider hidden lg:table-cell">Company</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">Loading...</td></tr>
            ) : filtered.map((lead) => (
              <tr key={lead.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors duration-200 animate-[fade-in_0.2s_ease-out]">
                <td className="px-5 py-4 text-sm font-medium">
                  <button
                    onClick={() => setSelectedLead(lead)}
                    className="text-foreground hover:text-primary transition-colors duration-200 underline-offset-2 hover:underline"
                  >
                    {lead.name}
                  </button>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {lead.email}</span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">
                  <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {lead.phone || "—"}</span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                  <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> {lead.company || "—"}</span>
                </td>
                <td className="px-5 py-4">
                  <Badge variant="outline" className={statusBadgeClass(lead.status)}>
                    {lead.status}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 transition-colors duration-200"
                      onClick={() => openEditDialog(lead)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive transition-colors duration-200"
                      onClick={() => setContactToDelete(lead)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">No contacts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedLead} onOpenChange={(sheetOpen) => !sheetOpen && setSelectedLead(null)}>
        <SheetContent className="glass-card border-l border-border/50 overflow-y-auto animate-[fade-in_0.2s_ease-out]">
          <SheetHeader>
            <SheetTitle className="font-display text-lg">{selectedLead?.name}</SheetTitle>
          </SheetHeader>
          {selectedLead && (
            <div className="mt-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Details</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{selectedLead.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{selectedLead.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{selectedLead.company || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={statusBadgeClass(selectedLead.status)}>
                    {selectedLead.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Added on {new Date(selectedLead.added_at).toLocaleDateString()}
                </p>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Associated Deals</h4>
                {selectedLeadDeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deals found</p>
                ) : (
                  <div className="space-y-2">
                    {selectedLeadDeals.map((deal) => (
                      <div key={deal.id} className="glass-card rounded-md p-3 space-y-1 animate-[fade-in_0.2s_ease-out]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{deal.name}</span>
                          <span className="text-xs text-primary font-medium">{deal.value}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(deal.stage)}`}>
                          {deal.stage}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!contactToDelete} onOpenChange={(dialogOpen) => !dialogOpen && setContactToDelete(null)}>
        <AlertDialogContent className="animate-[fade-in_0.2s_ease-out]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {contactToDelete?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => contactToDelete && deleteMutation.mutate(contactToDelete)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Contacts;
