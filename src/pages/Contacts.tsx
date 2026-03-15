import { useState } from "react";
import { Search, Plus, Mail, Phone, Building2, X } from "lucide-react";
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

const statusBadgeClass = (status: string) => {
  if (status === "New" || status === "Lead") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (status === "Negotiation") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  if (status === "Proposal") return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (status === "Closed" || status === "Closed Won") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (status === "Closed Lost") return "border-red-500/30 bg-red-500/10 text-red-400";
  return "border-border bg-muted text-muted-foreground";
};

const Contacts = () => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
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
      const { error } = await supabase.from("contacts").insert({
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        company: form.company || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setForm({ name: "", email: "", phone: "", company: "" });
      setOpen(false);
      toast.success("Lead added");
    },
    onError: (error: Error) => toast.error(`Failed to add lead: ${error.message}`),
  });

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      (l.company || "").toLowerCase().includes(search.toLowerCase())
  );

  const addLead = () => {
    if (!form.name || !form.email) return;
    addMutation.mutate();
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
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
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
              <Button onClick={addLead} className="w-full" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adding..." : "Add Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-surface-elevated/50">
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Email</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider hidden md:table-cell">Phone</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider hidden lg:table-cell">Company</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">Loading...</td></tr>
            ) : filtered.map((lead) => (
              <tr key={lead.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-4 text-sm font-medium">
                  <button
                    onClick={() => setSelectedLead(lead)}
                    className="text-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                  >
                    {lead.name}
                  </button>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {lead.email}</span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">
                  <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {lead.phone}</span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                  <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> {lead.company}</span>
                </td>
                <td className="px-5 py-4">
                  <Badge variant="outline" className={statusBadgeClass(lead.status)}>
                    {lead.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">No contacts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Contact Detail Sheet */}
      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="glass-card border-l border-border/50 overflow-y-auto">
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
                      <div key={deal.id} className="glass-card rounded-md p-3 space-y-1">
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
    </div>
  );
};

export default Contacts;
