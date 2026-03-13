import { useState } from "react";
import { Search, Plus, Mail, Phone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  addedAt: string;
}

const initialLeads: Lead[] = [
  { id: "1", name: "Sarah Chen", email: "sarah@acme.co", phone: "+1 555-0101", company: "Acme Corp", status: "Qualified", addedAt: "2026-03-10" },
  { id: "2", name: "James Wilson", email: "james@globex.io", phone: "+1 555-0102", company: "Globex Inc", status: "Lead", addedAt: "2026-03-11" },
  { id: "3", name: "Maria Rodriguez", email: "maria@wayne.com", phone: "+1 555-0103", company: "Wayne Enterprises", status: "Proposal", addedAt: "2026-03-12" },
  { id: "4", name: "David Park", email: "david@stark.tech", phone: "+1 555-0104", company: "Stark Industries", status: "Negotiation", addedAt: "2026-03-12" },
  { id: "5", name: "Emily Thompson", email: "emily@oscorp.net", phone: "+1 555-0105", company: "Oscorp", status: "Closed", addedAt: "2026-03-13" },
];

const Contacts = () => {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.company.toLowerCase().includes(search.toLowerCase())
  );

  const addLead = () => {
    if (!form.name || !form.email) return;
    const newLead: Lead = {
      id: Date.now().toString(),
      ...form,
      status: "Lead",
      addedAt: new Date().toISOString().split("T")[0],
    };
    setLeads([newLead, ...leads]);
    setForm({ name: "", email: "", phone: "", company: "" });
    setOpen(false);
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
              <Button onClick={addLead} className="w-full">Add Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-elevated">
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Email</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider hidden md:table-cell">Phone</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider hidden lg:table-cell">Company</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-5 py-4 text-sm font-medium">{lead.name}</td>
                <td className="px-5 py-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" /> {lead.email}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">
                  <span className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> {lead.phone}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" /> {lead.company}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    lead.status === "Closed" ? "bg-emerald-500/10 text-emerald-400" :
                    lead.status === "Qualified" ? "bg-primary/10 text-primary" :
                    lead.status === "Proposal" ? "bg-amber-500/10 text-amber-400" :
                    lead.status === "Negotiation" ? "bg-blue-500/10 text-blue-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {lead.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                  No contacts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Contacts;
