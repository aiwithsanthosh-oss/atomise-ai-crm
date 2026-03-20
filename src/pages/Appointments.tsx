import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Plus, ChevronLeft, ChevronRight, Calendar, List,
  Clock, User, X, Check, Ban, Pencil, Phone, Mail,
  AlignLeft, LayoutGrid,
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
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  addWeeks, subWeeks, addDays, subDays, isSameDay,
  isToday, parseISO, formatDistanceToNow,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type Contact = { id: string; name: string; email: string; phone: string | null };

type Appointment = {
  id: string;
  contact_id: string;
  title: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
};

type AppointmentWithContact = Appointment & { contact: Contact | null };

type CalView = "week" | "day" | "list";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am - 8pm

const STATUS_STYLES = {
  scheduled:  { label: "Scheduled",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  completed:  { label: "Completed",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  cancelled:  { label: "Cancelled",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30"     },
};

const DURATIONS = [
  { value: "15",  label: "15 minutes" },
  { value: "30",  label: "30 minutes" },
  { value: "45",  label: "45 minutes" },
  { value: "60",  label: "1 hour"     },
  { value: "90",  label: "1.5 hours"  },
  { value: "120", label: "2 hours"    },
];

const emptyForm = {
  contact_id: "",
  title: "",
  appointment_date: format(new Date(), "yyyy-MM-dd"),
  start_time: "10:00",
  duration_minutes: "60",
  notes: "",
};

// ─── Appointment Pill (used in calendar cells) ────────────────────────────────

function AppointmentPill({
  appt,
  onClick,
}: {
  appt: AppointmentWithContact;
  onClick: () => void;
}) {
  const s = STATUS_STYLES[appt.status];
  const fullLabel = `${appt.start_time.slice(0, 5)} ${appt.title}`;
  return (
    <button
      onClick={onClick}
      title={fullLabel}
      className={`w-full text-left rounded-lg border text-[10px] font-bold transition-all hover:opacity-80 ${s.bg} ${s.border} ${s.color}`}
      style={{
        display: "block",
        padding: "2px 8px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {appt.start_time.slice(0, 5)} {appt.title}
    </button>
  );
}

// ─── Appointments Page ────────────────────────────────────────────────────────

const Appointments = () => {
  const [view, setView]                     = useState<CalView>("week");
  const [currentDate, setCurrentDate]       = useState(new Date());
  const [modalOpen, setModalOpen]           = useState(false);
  const [detailAppt, setDetailAppt]         = useState<AppointmentWithContact | null>(null);
  const [apptToDelete, setApptToDelete]     = useState<AppointmentWithContact | null>(null);
  const [editMode, setEditMode]             = useState(false);
  const [form, setForm]                     = useState(emptyForm);
  const [contactSearch, setContactSearch]   = useState("");

  const queryClient = useQueryClient();
  // ── Modal open ref + global tab-switch blocker ────────────────────────────
  const modalOpenRef = useRef(false);

  useEffect(() => {
    modalOpenRef.current = modalOpen;
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

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

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-appointments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts").select("id, name, email, phone").order("name");
      return (data || []) as Contact[];
    },
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data: appts, error } = await supabase
        .from("appointments").select("*").order("appointment_date").order("start_time");
      if (error) throw error;
      if (!appts?.length) return [];

      const contactIds = [...new Set(appts.map((a) => a.contact_id))];
      const { data: contactsData } = await supabase
        .from("contacts").select("id, name, email, phone").in("id", contactIds);

      return appts.map((a) => ({
        ...a,
        contact: contactsData?.find((c) => c.id === a.contact_id) || null,
      })) as AppointmentWithContact[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.contact_id) throw new Error("Please select a contact");
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.appointment_date) throw new Error("Date is required");
      if (!form.start_time) throw new Error("Time is required");
      const { error } = await supabase.from("appointments").insert({
        contact_id:       form.contact_id,
        title:            form.title.trim(),
        appointment_date: form.appointment_date,
        start_time:       form.start_time,
        duration_minutes: parseInt(form.duration_minutes),
        notes:            form.notes.trim() || null,
        status:           "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setModalOpen(false);
      setForm(emptyForm);
      toast.success("Appointment booked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setDetailAppt(null);
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setApptToDelete(null);
      setDetailAppt(null);
      toast.success("Appointment deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goNext = () => {
    if (view === "week") setCurrentDate(addWeeks(currentDate, 1));
    else if (view === "day") setCurrentDate(addDays(currentDate, 1));
  };

  const goPrev = () => {
    if (view === "week") setCurrentDate(subWeeks(currentDate, 1));
    else if (view === "day") setCurrentDate(subDays(currentDate, 1));
  };

  const goToday = () => setCurrentDate(new Date());

  // ── Week days ──────────────────────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end   = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // ── Appointments for a given date ──────────────────────────────────────────

  const apptsByDate = (date: Date) =>
    appointments.filter((a) => isSameDay(parseISO(a.appointment_date), date));

  // ── Stats ──────────────────────────────────────────────────────────────────

  const upcoming = appointments.filter(
    (a) => a.status === "scheduled" && parseISO(a.appointment_date) >= new Date(new Date().setHours(0,0,0,0))
  );

  // ── Filtered contacts for dropdown ────────────────────────────────────────

  const filteredContacts = contacts.filter((c) =>
    !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  // ── Field style ────────────────────────────────────────────────────────────

  const fieldLabel = "text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5 block";
  const fieldInput = "w-full bg-background/50 border-border text-foreground text-sm";

  // ── Header label ───────────────────────────────────────────────────────────

  const headerLabel = () => {
    if (view === "week") return `${format(weekDays[0], "dd MMM")} – ${format(weekDays[6], "dd MMM yyyy")}`;
    if (view === "day")  return format(currentDate, "EEEE, dd MMMM yyyy");
    return "All Appointments";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full w-full flex flex-col overflow-hidden page-bg px-6 pt-5 pb-5 gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tighter text-foreground">Appointments</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Book and manage client appointments</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setModalOpen(true); }} className="gap-2 bg-primary hover:bg-primary/90 font-bold">
          <Plus className="h-4 w-4" /> New Appointment
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          { label: "Upcoming",  value: upcoming.length,                                                      color: "text-blue-400"    },
          { label: "Completed", value: appointments.filter((a) => a.status === "completed").length,           color: "text-emerald-400" },
          { label: "Cancelled", value: appointments.filter((a) => a.status === "cancelled").length,           color: "text-red-400"     },
        ].map((s) => (
          <div key={s.label} className="card-bg border border-border rounded-[14px] px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">{s.label}</span>
            <span className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between shrink-0">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          {view !== "list" && (
            <>
              <button onClick={goPrev} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={goNext} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button onClick={goToday} className="px-3 h-8 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                Today
              </button>
            </>
          )}
          <span className="text-sm font-bold text-foreground ml-2">{headerLabel()}</span>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-background/50">
          {([
            { key: "week", icon: LayoutGrid, label: "Week" },
            { key: "day",  icon: Calendar,   label: "Day"  },
            { key: "list", icon: List,        label: "List" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-bold transition-all ${
                view === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Calendar Views ── */}
      <div className="flex-1 min-h-0 card-bg border border-border rounded-[16px] overflow-hidden">

        {/* ── WEEK VIEW ── */}
        {view === "week" && (
          <div className="h-full flex flex-col">
            {/* Day headers — scrollbar-aware padding to stay aligned with time grid */}
            <div className="grid border-b border-border shrink-0" style={{ gridTemplateColumns: "60px repeat(7, 1fr)", paddingRight: "15px" }}>
              <div className="p-2" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`p-2 text-center border-l border-border ${isToday(day) ? "bg-primary/5" : ""}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    {format(day, "EEE")}
                  </p>
                  <p className={`text-sm font-black mt-0.5 ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                    {format(day, "dd")}
                  </p>
                </div>
              ))}
            </div>
            {/* Time grid */}
            <div className="flex-1 overflow-y-scroll">
              {HOURS.map((hour) => (
                <div key={hour} className="border-b border-border/50 min-h-[56px]" style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)" }}>
                  <div className="p-1 text-[10px] text-muted-foreground/40 font-bold text-right pr-2 pt-1">
                    {hour}:00
                  </div>
                  {weekDays.map((day) => {
                    const dayAppts = apptsByDate(day).filter((a) => {
                      const h = parseInt(a.start_time.split(":")[0]);
                      return h === hour;
                    });
                    return (
                      <div
                        key={day.toISOString()}
                        className={`border-l border-border/50 p-0.5 space-y-0.5 ${isToday(day) ? "bg-primary/3" : ""}`}
                        style={{ minWidth: 0, overflow: "hidden", width: "100%" }}
                      >
                        {dayAppts.map((appt) => (
                          <AppointmentPill key={appt.id} appt={appt} onClick={() => setDetailAppt(appt)} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DAY VIEW ── */}
        {view === "day" && (
          <div className="h-full flex flex-col">
            <div className={`p-4 border-b border-border shrink-0 ${isToday(currentDate) ? "bg-primary/5" : ""}`}>
              <p className="text-sm font-bold text-foreground">
                {format(currentDate, "EEEE, dd MMMM yyyy")}
                {isToday(currentDate) && <span className="ml-2 text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Today</span>}
              </p>
              <p className="text-xs text-muted-foreground/50 mt-0.5">
                {apptsByDate(currentDate).length} appointment{apptsByDate(currentDate).length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {HOURS.map((hour) => {
                const hourAppts = apptsByDate(currentDate).filter((a) => parseInt(a.start_time.split(":")[0]) === hour);
                return (
                  <div key={hour} className="flex gap-3 border-b border-border/50 min-h-[64px] p-2">
                    <div className="text-[11px] text-muted-foreground/40 font-bold w-12 text-right shrink-0 pt-1">
                      {hour}:00
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {hourAppts.map((appt) => {
                        const s = STATUS_STYLES[appt.status];
                        return (
                          <button
                            key={appt.id}
                            onClick={() => setDetailAppt(appt)}
                            className={`w-full text-left p-3 rounded-xl border transition-all hover:opacity-80 ${s.bg} ${s.border}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-bold ${s.color}`}>{appt.title}</span>
                              <span className="text-[10px] text-muted-foreground/50 shrink-0">{appt.duration_minutes}min</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />{appt.start_time.slice(0, 5)}
                              </span>
                              <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                                <User className="h-2.5 w-2.5" />{appt.contact?.name || "Unknown"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border shrink-0 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">All Appointments</p>
              <span className="text-[11px] text-muted-foreground/40">{appointments.length} total</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="p-4 space-y-2">
                  {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/20 animate-pulse" />)}
                </div>
              )}
              {!isLoading && appointments.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                  <Calendar className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground/40">No appointments yet</p>
                </div>
              )}
              {appointments.map((appt) => {
                const s = STATUS_STYLES[appt.status];
                return (
                  <button
                    key={appt.id}
                    onClick={() => setDetailAppt(appt)}
                    className="w-full text-left flex items-center gap-4 p-4 border-b border-border/50 hover:bg-primary/5 transition-colors"
                  >
                    {/* Date block */}
                    <div className="shrink-0 w-12 text-center">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground/50">{format(parseISO(appt.appointment_date), "MMM")}</p>
                      <p className="text-xl font-black text-foreground leading-none">{format(parseISO(appt.appointment_date), "dd")}</p>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground truncate">{appt.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${s.bg} ${s.border} ${s.color}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />{appt.start_time.slice(0, 5)} · {appt.duration_minutes}min
                        </span>
                        <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />{appt.contact?.name || "Unknown"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── New Appointment Modal — always mounted, immune to tab switches ── */}
      {createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: modalOpen ? "flex" : "none",
            pointerEvents: modalOpen ? "all" : "none",
          }}
        >
          <div
            className="card-bg border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">New Appointment</h2>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Book an appointment with a client</p>
              </div>
              <button onClick={() => { setModalOpen(false); setForm(emptyForm); }} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all shrink-0 ml-4">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className={fieldLabel}>Appointment Title *</label>
                <Input className={fieldInput} placeholder="e.g. Product Demo Call" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              {/* Contact */}
              <div>
                <label className={fieldLabel}>Client *</label>
                <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                  <SelectTrigger className={`${fieldInput} h-10`}>
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border max-h-60" style={{ zIndex: 99999 }}>
                    <div className="px-2 py-1.5 border-b border-border">
                      <input
                        placeholder="Search client..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        className="w-full text-xs bg-transparent text-foreground placeholder:text-muted-foreground/50 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {filteredContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-primary">{c.name.charAt(0).toUpperCase()}</span>
                          </div>
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabel}>Date *</label>
                  <input
                    type="date"
                    value={form.appointment_date}
                    onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-background/50 border border-border rounded-xl text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className={fieldLabel}>Start Time *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-background/50 border border-border rounded-xl text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className={fieldLabel}>Duration</label>
                <Select value={form.duration_minutes} onValueChange={(v) => setForm({ ...form, duration_minutes: v })}>
                  <SelectTrigger className={`${fieldInput} h-10`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border" style={{ zIndex: 99999 }}>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="text-sm">{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <label className={fieldLabel}>Notes</label>
                <textarea
                  rows={3}
                  className="w-full bg-background/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
                  placeholder="Agenda, preparation notes, meeting link..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {/* n8n note */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
                <p className="text-[10px] text-primary/70 font-medium">
                  📧 Email + WhatsApp confirmation will be sent to the client automatically via n8n after booking.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => { setModalOpen(false); setForm(emptyForm); }}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="gap-2 font-bold">
                <Calendar className="h-4 w-4" />
                {createMutation.isPending ? "Booking..." : "Book Appointment"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Appointment Detail Sheet ── */}
      {detailAppt && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-end p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
          onClick={() => setDetailAppt(null)}
        >
          <div
            className="card-bg border border-border rounded-2xl w-full max-w-sm h-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-foreground truncate">{detailAppt.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {(() => {
                    const s = STATUS_STYLES[detailAppt.status];
                    return (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.color}`}>
                        {s.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button onClick={() => setDetailAppt(null)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all shrink-0 ml-3">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-background/50 border border-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Date</p>
                  <p className="text-sm font-bold text-foreground">{format(parseISO(detailAppt.appointment_date), "dd MMM yyyy")}</p>
                </div>
                <div className="p-3 rounded-xl bg-background/50 border border-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Time</p>
                  <p className="text-sm font-bold text-foreground">{detailAppt.start_time.slice(0, 5)} · {detailAppt.duration_minutes}min</p>
                </div>
              </div>

              {/* Contact */}
              {detailAppt.contact && (
                <div className="p-3 rounded-xl bg-background/50 border border-border space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Client</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 font-bold text-sm text-primary">
                      {detailAppt.contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{detailAppt.contact.name}</p>
                      {detailAppt.contact.email && (
                        <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" />{detailAppt.contact.email}
                        </p>
                      )}
                      {detailAppt.contact.phone && (
                        <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" />{detailAppt.contact.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {detailAppt.notes && (
                <div className="p-3 rounded-xl bg-background/50 border border-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground/70 whitespace-pre-line">{detailAppt.notes}</p>
                </div>
              )}

              {/* Created */}
              <p className="text-[10px] text-muted-foreground/30 text-center">
                Booked {formatDistanceToNow(new Date(detailAppt.created_at), { addSuffix: true })}
              </p>
            </div>

            {/* Actions */}
            {detailAppt.status === "scheduled" && (
              <div className="px-6 pb-6 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Update Status</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: detailAppt.id, status: "completed" })}
                    className="flex items-center justify-center gap-2 h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                  >
                    <Check className="h-3.5 w-3.5" /> Complete
                  </button>
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: detailAppt.id, status: "cancelled" })}
                    className="flex items-center justify-center gap-2 h-9 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all"
                  >
                    <Ban className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
                <button
                  onClick={() => setApptToDelete(detailAppt)}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-border text-muted-foreground text-xs font-bold hover:text-red-400 hover:border-red-500/30 transition-all mt-1"
                >
                  Delete Appointment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!apptToDelete} onOpenChange={(o) => { if (!o) setApptToDelete(null); }}>
        <AlertDialogContent className="card-bg border border-border rounded-2xl" style={{ zIndex: 99999 }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{apptToDelete?.title}</strong> with <strong>{apptToDelete?.contact?.name}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              onClick={() => apptToDelete && deleteMutation.mutate(apptToDelete.id)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Appointments;