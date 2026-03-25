import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "@/components/theme-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  ShieldCheck,
  Moon,
  Sun,
  Monitor,
  Palette,
  Users,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Crown,
  User,
  Trash2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  GripVertical,
  Pencil,
  X,
  Check,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PASSWORD_RULES, validatePassword, passwordStrength } from "@/lib/passwordValidation";

// ─── Constants ────────────────────────────────────────────────────────────────
const MEMBERS_PER_PAGE = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  role: string | null;
  is_active: boolean | null;
};

type FieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "multiselect"
  | "checkbox"
  | "textarea"
  | "url"
  | "email"
  | "phone";

type CustomFieldDef = {
  id: string;
  label: string;
  field_key: string;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  placeholder: string | null;
  display_order: number;
  created_at: string;
};

type SettingsTab = "team" | "custom-fields" | "appearance" | "password";

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "textarea", label: "Long Text" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

const FIELD_TYPE_META: Record<FieldType, { label: string; color: string; bg: string; border: string }> = {
  text: { label: "Text", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
  number: { label: "Number", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25" },
  textarea: { label: "Long Text", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
  date: { label: "Date", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  dropdown: { label: "Dropdown", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  multiselect: { label: "Multi-select", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  checkbox: { label: "Checkbox", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25" },
  url: { label: "URL", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/25" },
  email: { label: "Email", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/25" },
  phone: { label: "Phone", color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/25" },
};

const toFieldKey = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const emptyFieldForm = {
  label: "",
  field_type: "text" as FieldType,
  placeholder: "",
  is_required: false,
  options: "",
};

const settingsTabs: {
  id: SettingsTab;
  label: string;
  icon: any;
  description: string;
}[] = [
  {
    id: "team",
    label: "Team Management",
    icon: Users,
    description: "Manage roles and account access",
  },
  {
    id: "custom-fields",
    label: "Custom Fields — Contacts",
    icon: SlidersHorizontal,
    description: "Configure contact custom fields",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    description: "Theme and display preferences",
  },
  {
    id: "password",
    label: "Change Password",
    icon: KeyRound,
    description: "Update your account password",
  },
];

// ─── Shared Section Wrapper ───────────────────────────────────────────────────

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="card-bg border border-border rounded-2xl p-6 space-y-5">
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
    </div>
    {children}
  </div>
);

// ─── Password Strength Components ─────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordStrength(password);
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500"];
  const labels = ["Weak", "Fair", "Good", "Strong"];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < score ? colors[score - 1] : "bg-muted"
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-[11px] font-bold ${colors[score - 1].replace("bg-", "text-")}`}>
          {labels[score - 1]}
        </p>
      )}
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
              passed ? "text-emerald-500" : "text-muted-foreground/60"
            }`}
          >
            {passed ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 shrink-0" />
            )}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

const Settings = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("team");

  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<Profile | null>(null);
  const [teamPage, setTeamPage] = useState(1);

  const [fieldFormOpen, setFieldFormOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDef | null>(null);
  const [fieldForm, setFieldForm] = useState(emptyFieldForm);
  const [fieldToDelete, setFieldToDelete] = useState<CustomFieldDef | null>(null);
  const [fieldLabelError, setFieldLabelError] = useState<string | null>(null);

  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const { data: teamMembers = [], isLoading: teamLoading } = useQuery({
    queryKey: ["team-members-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, mobile_number, role, is_active")
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: customFields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ["custom-field-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as CustomFieldDef[];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members-settings"] });
      toast({ title: "Role Updated", description: "Team member role has been updated." });
    },
    onError: (e: any) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members-settings"] });
      setMemberToDeactivate(null);
      toast({ title: "Account Updated", description: "Team member status has been changed." });
    },
    onError: (e: any) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const saveFieldMutation = useMutation({
    mutationFn: async () => {
      if (!fieldForm.label.trim()) {
        setFieldLabelError("Field label is required");
        throw new Error("__validation__");
      }
      setFieldLabelError(null);

      const field_key = toFieldKey(fieldForm.label);
      const options = ["dropdown", "multiselect"].includes(fieldForm.field_type)
        ? fieldForm.options
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean)
        : null;

      if (editingField) {
        const { error } = await supabase
          .from("custom_field_definitions")
          .update({
            label: fieldForm.label.trim(),
            field_key,
            field_type: fieldForm.field_type,
            placeholder: fieldForm.placeholder.trim() || null,
            is_required: fieldForm.is_required,
            options,
          })
          .eq("id", editingField.id);
        if (error) throw error;
      } else {
        const maxOrder =
          customFields.length > 0
            ? Math.max(...customFields.map((f) => f.display_order)) + 1
            : 0;

        const { error } = await supabase.from("custom_field_definitions").insert({
          label: fieldForm.label.trim(),
          field_key,
          field_type: fieldForm.field_type,
          placeholder: fieldForm.placeholder.trim() || null,
          is_required: fieldForm.is_required,
          options,
          display_order: maxOrder,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions"] });
      setFieldFormOpen(false);
      setEditingField(null);
      setFieldForm(emptyFieldForm);
      toast({
        title: editingField ? "Field Updated" : "Field Created",
        description: `Custom field has been ${editingField ? "updated" : "added"}.`,
      });
    },
    onError: (e: any) => {
      if (e.message !== "__validation__") {
        toast({ variant: "destructive", title: "Error", description: e.message });
      }
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_field_definitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-field-definitions"] });
      setFieldToDelete(null);
      toast({ title: "Field Deleted", description: "Custom field has been removed." });
    },
    onError: (e: any) =>
      toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const handleEditField = (field: CustomFieldDef) => {
    setEditingField(field);
    setFieldLabelError(null);
    setFieldForm({
      label: field.label,
      field_type: field.field_type,
      placeholder: field.placeholder || "",
      is_required: field.is_required,
      options: (field.options || []).join("\n"),
    });
    setFieldFormOpen(true);
    setActiveTab("custom-fields");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePassword(newPassword);
    if (err) {
      setPasswordError(err);
      return;
    }
    setPasswordError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setNewPassword("");
    }
    setLoading(false);
  };

  const getRoleColor = (role: string | null) => {
    if (role === "admin") return "border-purple-500/30 bg-purple-500/10 text-purple-400";
    return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  };

  const cfInput =
    "w-full h-10 bg-background/50 border border-border text-foreground text-sm rounded-xl px-3 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all";
  const cfLabel =
    "block text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5";

  return (
    <div ref={scrollRef} className="h-full w-full overflow-y-auto page-bg">
      <div className="max-w-6xl mx-auto px-6 pt-5 pb-10 space-y-6">
        <div className="shrink-0">
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tighter text-foreground">
            Settings
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Manage your team, roles and account preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
          <div className="card-bg border border-border rounded-2xl p-3 lg:sticky lg:top-5">
            <div className="mb-3 px-2 pt-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                Settings Menu
              </p>
            </div>

            <div className="space-y-1.5">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      isActive
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold leading-tight">{tab.label}</p>
                        <p className="text-[11px] mt-1 text-muted-foreground/70 leading-relaxed">
                          {tab.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            {activeTab === "team" && (
              <Section icon={Users} title="Team Management">
                <p className="text-xs text-muted-foreground/70">
                  All registered team members. Assign roles and manage account access.
                </p>

                {teamLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
                    ))}
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <UserPlus className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground/50">No team members yet</p>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const totalTeamPages = Math.max(
                        1,
                        Math.ceil(teamMembers.length / MEMBERS_PER_PAGE)
                      );
                      const safeTeamPage = Math.min(teamPage, totalTeamPages);
                      const pagedMembers = teamMembers.slice(
                        (safeTeamPage - 1) * MEMBERS_PER_PAGE,
                        safeTeamPage * MEMBERS_PER_PAGE
                      );

                      return (
                        <div className="space-y-3">
                          {pagedMembers.map((member) => {
                            const isCurrentUser = member.id === currentUserId;
                            return (
                              <div
                                key={member.id}
                                className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                                  member.is_active === false
                                    ? "border-border bg-muted/20 opacity-60"
                                    : "border-border bg-background/50 hover:border-primary/20"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                                      member.role === "admin"
                                        ? "bg-purple-500/20 text-purple-400"
                                        : "bg-blue-500/20 text-blue-400"
                                    }`}
                                  >
                                    {(member.full_name || member.email || "?")
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-bold text-foreground truncate">
                                        {member.full_name || "Unnamed"}
                                      </span>
                                      {isCurrentUser && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded-full">
                                          You
                                        </span>
                                      )}
                                      {member.is_active === false && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-400/70 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                                          Inactive
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-0 mt-0.5">
                                      {member.email && (
                                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 truncate">
                                          <Mail className="h-2.5 w-2.5 shrink-0" />
                                          {member.email}
                                        </span>
                                      )}
                                      {member.mobile_number && (
                                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                          <Phone className="h-2.5 w-2.5 shrink-0" />
                                          {member.mobile_number}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pl-12">
                                  <div className="shrink-0">
                                    {isCurrentUser ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] font-bold uppercase ${getRoleColor(
                                          member.role
                                        )}`}
                                      >
                                        {member.role === "admin" ? (
                                          <span className="flex items-center gap-1">
                                            <Crown className="h-2.5 w-2.5" /> Admin
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-1">
                                            <User className="h-2.5 w-2.5" /> Sales
                                          </span>
                                        )}
                                      </Badge>
                                    ) : (
                                      <Select
                                        value={member.role || "sales"}
                                        onValueChange={(v) =>
                                          updateRoleMutation.mutate({ id: member.id, role: v })
                                        }
                                      >
                                        <SelectTrigger
                                          className={`h-8 w-28 text-[11px] font-bold border rounded-lg ${getRoleColor(
                                            member.role
                                          )}`}
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover border-border">
                                          <SelectItem value="admin" className="text-xs">
                                            <span className="flex items-center gap-2">
                                              <Crown className="h-3 w-3 text-purple-400" /> Admin
                                            </span>
                                          </SelectItem>
                                          <SelectItem value="sales" className="text-xs">
                                            <span className="flex items-center gap-2">
                                              <User className="h-3 w-3 text-blue-400" /> Sales
                                            </span>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>

                                  {!isCurrentUser && (
                                    <button
                                      onClick={() => {
                                        if (member.is_active === false) {
                                          toggleActiveMutation.mutate({
                                            id: member.id,
                                            is_active: true,
                                          });
                                        } else {
                                          setMemberToDeactivate(member);
                                        }
                                      }}
                                      className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                        member.is_active === false
                                          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                                          : "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                                      }`}
                                    >
                                      {member.is_active === false ? "Activate" : "Deactivate"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {teamMembers.length > MEMBERS_PER_PAGE &&
                      (() => {
                        const totalTeamPages = Math.max(
                          1,
                          Math.ceil(teamMembers.length / MEMBERS_PER_PAGE)
                        );
                        const safeTeamPage = Math.min(teamPage, totalTeamPages);

                        return (
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-muted-foreground/40 font-medium">
                              Page {safeTeamPage} of {totalTeamPages} · {teamMembers.length} members
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
                                disabled={safeTeamPage === 1}
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>

                              {Array.from({ length: totalTeamPages }, (_, i) => i + 1).map((p) => (
                                <button
                                  key={p}
                                  onClick={() => setTeamPage(p)}
                                  className={`h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold border transition-all ${
                                    p === safeTeamPage
                                      ? "bg-primary/15 text-primary border-primary/30"
                                      : "border-border text-muted-foreground/50 hover:text-foreground hover:border-primary/20"
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}

                              <button
                                onClick={() =>
                                  setTeamPage((p) => Math.min(totalTeamPages, p + 1))
                                }
                                disabled={safeTeamPage === totalTeamPages}
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                  </>
                )}

                <div className="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-4 pt-2 border-t border-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Role permissions:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Crown className="h-3 w-3 text-purple-400" />
                    <span className="text-[11px] text-muted-foreground/70">
                      <strong className="text-purple-400">Admin</strong> — full access including
                      Pipeline, Settings
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-blue-400" />
                    <span className="text-[11px] text-muted-foreground/70">
                      <strong className="text-blue-400">Sales</strong> — Dashboard, Contacts, Tasks
                      only
                    </span>
                  </div>
                </div>
              </Section>
            )}

            {activeTab === "custom-fields" && (
              <Section icon={SlidersHorizontal} title="Custom Fields — Contacts">
                <p className="text-xs text-muted-foreground/70">
                  Define additional fields that appear on every contact record. Values are saved per
                  contact.
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/50 font-medium">
                    {customFields.length} field{customFields.length !== 1 ? "s" : ""} defined
                  </span>
                  <button
                    onClick={() => {
                      setEditingField(null);
                      setFieldForm(emptyFieldForm);
                      setFieldLabelError(null);
                      setFieldFormOpen(true);
                    }}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Field
                  </button>
                </div>

                {fieldFormOpen && (
                  <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary uppercase tracking-widest">
                        {editingField ? "Edit Field" : "New Field"}
                      </span>
                      <button
                        onClick={() => {
                          setFieldFormOpen(false);
                          setEditingField(null);
                          setFieldForm(emptyFieldForm);
                          setFieldLabelError(null);
                        }}
                        className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={cfLabel}>Field Label *</label>
                        <input
                          className={`${cfInput} ${fieldLabelError ? "border-red-500" : ""}`}
                          placeholder="e.g. Lead Source"
                          value={fieldForm.label}
                          onChange={(e) => {
                            setFieldForm({ ...fieldForm, label: e.target.value });
                            setFieldLabelError(null);
                          }}
                        />
                        {fieldLabelError && (
                          <p className="text-[11px] text-red-400 font-medium mt-1">
                            {fieldLabelError}
                          </p>
                        )}
                        {fieldForm.label && (
                          <p className="text-[10px] text-muted-foreground/40 mt-1 font-mono">
                            key: {toFieldKey(fieldForm.label)}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={cfLabel}>Field Type</label>
                        <Select
                          value={fieldForm.field_type}
                          onValueChange={(v) =>
                            setFieldForm({ ...fieldForm, field_type: v as FieldType })
                          }
                        >
                          <SelectTrigger className="h-10 bg-background/50 border border-border text-foreground rounded-xl text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            {FIELD_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {!["checkbox", "date"].includes(fieldForm.field_type) && (
                      <div>
                        <label className={cfLabel}>Placeholder Text</label>
                        <input
                          className={cfInput}
                          placeholder="Hint shown inside the field..."
                          value={fieldForm.placeholder}
                          onChange={(e) =>
                            setFieldForm({ ...fieldForm, placeholder: e.target.value })
                          }
                        />
                      </div>
                    )}

                    {["dropdown", "multiselect"].includes(fieldForm.field_type) && (
                      <div>
                        <label className={cfLabel}>Options (one per line)</label>
                        <textarea
                          rows={4}
                          className="w-full bg-background/50 border border-border text-foreground text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/50 resize-none placeholder:text-muted-foreground/50"
                          placeholder={"Option A\nOption B\nOption C"}
                          value={fieldForm.options}
                          onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setFieldForm({
                            ...fieldForm,
                            is_required: !fieldForm.is_required,
                          })
                        }
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          fieldForm.is_required ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                            fieldForm.is_required ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <span className="text-xs font-medium text-muted-foreground/80">
                        Required field
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => saveFieldMutation.mutate()}
                        disabled={saveFieldMutation.isPending}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {saveFieldMutation.isPending
                          ? "Saving…"
                          : editingField
                            ? "Update Field"
                            : "Save Field"}
                      </button>
                      <button
                        onClick={() => {
                          setFieldFormOpen(false);
                          setEditingField(null);
                          setFieldForm(emptyFieldForm);
                          setFieldLabelError(null);
                        }}
                        className="h-9 px-4 rounded-xl border border-border text-muted-foreground text-xs font-bold hover:text-foreground transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {fieldsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-xl bg-muted/20 animate-pulse" />
                    ))}
                  </div>
                ) : customFields.length === 0 && !fieldFormOpen ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center border border-dashed border-border rounded-xl">
                    <SlidersHorizontal className="h-7 w-7 text-muted-foreground/25" />
                    <p className="text-sm font-bold text-muted-foreground/50">No custom fields yet</p>
                    <p className="text-xs text-muted-foreground/35">
                      Click "Add Field" to create your first custom field
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customFields.map((field) => {
                      const meta = FIELD_TYPE_META[field.field_type] ?? FIELD_TYPE_META.text;
                      return (
                        <div
                          key={field.id}
                          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/50 hover:border-primary/20 transition-all group"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground/25 shrink-0" />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground">
                                {field.label}
                              </span>
                              {field.is_required && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                                  Required
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.color}`}
                              >
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground/40 font-mono">
                                {field.field_key}
                              </span>
                              {field.options && field.options.length > 0 && (
                                <span className="text-[10px] text-muted-foreground/40">
                                  {field.options.length} option
                                  {field.options.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditField(field)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setFieldToDelete(field)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            )}

            {activeTab === "appearance" && (
              <Section icon={Palette} title="Appearance">
                <p className="text-xs text-muted-foreground/70">
                  Choose your preferred theme.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: "light", icon: Sun, label: "Light" },
                    { value: "dark", icon: Moon, label: "Dark" },
                    { value: "system", icon: Monitor, label: "System" },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value as any)}
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border font-bold text-sm transition-all ${
                        theme === value
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {activeTab === "password" && (
              <Section icon={KeyRound} title="Change Password">
                <p className="text-xs text-muted-foreground/70">
                  Your new password must meet all security requirements below.
                </p>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-sm font-semibold text-foreground">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        ref={passwordInputRef}
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => {
                          const scrollTop = scrollRef.current?.scrollTop ?? 0;
                          const cursorPos = e.target.selectionStart;
                          setNewPassword(e.target.value);
                          setPasswordError(null);
                          requestAnimationFrame(() => {
                            if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
                            if (passwordInputRef.current) {
                              passwordInputRef.current.focus();
                              if (cursorPos !== null) {
                                passwordInputRef.current.setSelectionRange(cursorPos, cursorPos);
                              }
                            }
                          });
                        }}
                        className={`bg-background/50 pr-10 ${
                          passwordError ? "border-red-500" : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>

                    <PasswordChecklist password={newPassword} />
                    <StrengthBar password={newPassword} />
                    {passwordError && (
                      <p className="text-xs text-red-400 font-medium">{passwordError}</p>
                    )}
                  </div>

                  <Button type="submit" disabled={loading} className="gap-2 font-bold">
                    <ShieldCheck className="h-4 w-4" />
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </Section>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!memberToDeactivate}
        onOpenChange={(o) => {
          if (!o) setMemberToDeactivate(null);
        }}
      >
        <AlertDialogContent className="card-bg border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deactivate account?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{memberToDeactivate?.full_name || memberToDeactivate?.email}</strong> will no
              longer be able to log in to Atomise CRM. You can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              onClick={() =>
                memberToDeactivate &&
                toggleActiveMutation.mutate({
                  id: memberToDeactivate.id,
                  is_active: false,
                })
              }
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!fieldToDelete}
        onOpenChange={(o) => {
          if (!o) setFieldToDelete(null);
        }}
      >
        <AlertDialogContent className="card-bg border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete custom field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the <strong>{fieldToDelete?.label}</strong> field
              definition. Existing values stored on contacts will remain in the database but will no
              longer be displayed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              onClick={() => fieldToDelete && deleteFieldMutation.mutate(fieldToDelete.id)}
            >
              {deleteFieldMutation.isPending ? "Deleting…" : "Delete Field"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
