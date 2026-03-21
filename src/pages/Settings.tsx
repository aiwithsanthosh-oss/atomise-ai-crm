import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "@/components/theme-provider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound, ShieldCheck, Moon, Sun, Monitor, Palette,
  Users, UserCog, Phone, Mail, CheckCircle2, XCircle,
  Crown, User, Trash2, UserPlus, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PASSWORD_RULES, validatePassword, passwordStrength } from "@/lib/passwordValidation";

// ─── Constants ──────────────────────────────────────────────────────────────────
const MEMBERS_PER_PAGE = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  role: string | null;
  is_active: boolean | null;
};

// ─── Password strength components ────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordStrength(password);
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500"];
  const labels = ["Weak", "Fair", "Good", "Strong"];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score - 1] : "bg-muted"}`} />
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
          <li key={rule.id} className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${passed ? "text-emerald-500" : "text-muted-foreground/60"}`}>
            {passed ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

const Settings = () => {
  const [newPassword, setNewPassword]     = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<Profile | null>(null);
  const [teamPage, setTeamPage]                     = useState(1);

  const { toast }  = useToast();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────────

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

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members-settings"] });
      toast({ title: "Role Updated", description: "Team member role has been updated." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
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
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  // ── Change Password ────────────────────────────────────────────────────────

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePassword(newPassword);
    if (err) { setPasswordError(err); return; }
    setPasswordError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Password Updated", description: "Your password has been changed successfully." });
      setNewPassword("");
    }
    setLoading(false);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getRoleColor = (role: string | null) => {
    if (role === "admin") return "border-purple-500/30 bg-purple-500/10 text-purple-400";
    return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  };

  // ── Section wrapper ────────────────────────────────────────────────────────

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full overflow-y-auto page-bg">
      <div className="max-w-3xl mx-auto px-6 pt-5 pb-10 space-y-6">

        {/* Header */}
        <div className="shrink-0">
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tighter text-foreground">Settings</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Manage your team, roles and account preferences</p>
        </div>

        {/* ── TEAM MANAGEMENT ── */}
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
            {/* Pagination calc */}
            {(() => {
              const totalTeamPages = Math.max(1, Math.ceil(teamMembers.length / MEMBERS_PER_PAGE));
              const safeteamPage   = Math.min(teamPage, totalTeamPages);
              const pagedMembers   = teamMembers.slice((safeteamPage - 1) * MEMBERS_PER_PAGE, safeteamPage * MEMBERS_PER_PAGE);
              return (
            <div className="space-y-3">
              {pagedMembers.map((member) => {
                const isCurrentUser = member.id === currentUserId;
                return (
                  <div
                    key={member.id}
                    className={`flex flex-wrap items-center gap-3 p-3 md:p-4 rounded-xl border transition-all ${
                      member.is_active === false
                        ? "border-border bg-muted/20 opacity-60"
                        : "border-border bg-background/50 hover:border-primary/20"
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                      member.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {(member.full_name || member.email || "?").charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                      <div className="flex items-center gap-3 mt-0.5">
                        {member.email && (
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5" />{member.email}
                          </span>
                        )}
                        {member.mobile_number && (
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />{member.mobile_number}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Role selector */}
                    <div className="shrink-0">
                      {isCurrentUser ? (
                        /* Can't change own role */
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase ${getRoleColor(member.role)}`}>
                          {member.role === "admin" ? (
                            <span className="flex items-center gap-1"><Crown className="h-2.5 w-2.5" /> Admin</span>
                          ) : (
                            <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" /> Sales</span>
                          )}
                        </Badge>
                      ) : (
                        <Select
                          value={member.role || "sales"}
                          onValueChange={(v) => updateRoleMutation.mutate({ id: member.id, role: v })}
                        >
                          <SelectTrigger className={`h-8 w-28 text-[11px] font-bold border rounded-lg ${getRoleColor(member.role)}`}>
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

                    {/* Activate / Deactivate */}
                    {!isCurrentUser && (
                      <button
                        onClick={() => {
                          if (member.is_active === false) {
                            toggleActiveMutation.mutate({ id: member.id, is_active: true });
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
                );
              })}
            </div>
              );
            })()}

            {/* ── Pagination ── */}
            {teamMembers.length > MEMBERS_PER_PAGE && (() => {
              const totalTeamPages = Math.max(1, Math.ceil(teamMembers.length / MEMBERS_PER_PAGE));
              const safeteamPage   = Math.min(teamPage, totalTeamPages);
              return (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-muted-foreground/40 font-medium">
                    Page {safeteamPage} of {totalTeamPages} · {teamMembers.length} members
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
                      disabled={safeteamPage === 1}
                      className="h-7 w-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: totalTeamPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setTeamPage(p)}
                        className={`h-7 w-7 flex items-center justify-center rounded-lg text-xs font-bold border transition-all ${
                          p === safeteamPage
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "border-border text-muted-foreground/50 hover:text-foreground hover:border-primary/20"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setTeamPage((p) => Math.min(totalTeamPages, p + 1))}
                      disabled={safeteamPage === totalTeamPages}
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

          {/* Role legend */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Role permissions:</p>
            <div className="flex items-center gap-1.5">
              <Crown className="h-3 w-3 text-purple-400" />
              <span className="text-[11px] text-muted-foreground/70"><strong className="text-purple-400">Admin</strong> — full access including Pipeline, Settings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-blue-400" />
              <span className="text-[11px] text-muted-foreground/70"><strong className="text-blue-400">Sales</strong> — Dashboard, Contacts, Tasks only</span>
            </div>
          </div>
        </Section>

        {/* ── APPEARANCE ── */}
        <Section icon={Palette} title="Appearance">
          <p className="text-xs text-muted-foreground/70">Choose your preferred theme.</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "light", icon: Sun,     label: "Light"  },
              { value: "dark",  icon: Moon,    label: "Dark"   },
              { value: "system",icon: Monitor, label: "System" },
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

        {/* ── CHANGE PASSWORD ── */}
        <Section icon={KeyRound} title="Change Password">
          <p className="text-xs text-muted-foreground/70">
            Your new password must meet all security requirements below.
          </p>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-sm font-semibold text-foreground">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); }}
                  className={`bg-background/50 pr-10 ${passwordError ? "border-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {/* Live checklist */}
              <PasswordChecklist password={newPassword} />
              {/* Strength bar */}
              <StrengthBar password={newPassword} />
              {/* Error */}
              {passwordError && <p className="text-xs text-red-400 font-medium">{passwordError}</p>}
            </div>
            <Button type="submit" disabled={loading} className="gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Section>

      </div>

      {/* ── Deactivate Confirmation ── */}
      <AlertDialog open={!!memberToDeactivate} onOpenChange={(o) => { if (!o) setMemberToDeactivate(null); }}>
        <AlertDialogContent className="card-bg border border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deactivate account?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{memberToDeactivate?.full_name || memberToDeactivate?.email}</strong> will no longer be able to log in to Atomise CRM. You can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              onClick={() => memberToDeactivate && toggleActiveMutation.mutate({ id: memberToDeactivate.id, is_active: false })}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Settings;