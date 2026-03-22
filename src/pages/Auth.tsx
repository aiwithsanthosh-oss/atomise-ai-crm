import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, ArrowLeft, Mail, UserPlus, User, Phone, Lock, CheckCircle2, XCircle } from "lucide-react";
import { PhoneInput, joinPhone, splitPhone } from "@/components/PhoneInput";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { PASSWORD_RULES, validatePassword, passwordStrength } from "@/lib/passwordValidation";

type AuthView = "login" | "signup" | "forgot_password" | "update_password";

// ─── Password strength bar ────────────────────────────────────────────────────
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

// ─── Password rules checklist ─────────────────────────────────────────────────
function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li key={rule.id} className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${passed ? "text-emerald-500" : "text-muted-foreground/60"}`}>
            {passed
              ? <CheckCircle2 className="h-3 w-3 shrink-0" />
              : <XCircle className="h-3 w-3 shrink-0" />
            }
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
export default function Auth() {
  const [view, setView]               = useState<AuthView>("login");
  const [loading, setLoading]         = useState(false);
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [fullName, setFullName]       = useState("");
  const [countryCode, setCountryCode]   = useState("+91");
  const [phoneNumber, setPhoneNumber]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]   = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    mobile?: string;
    email?: string;
    password?: string;
  }>({});

  // ── NEW: track reset email sent state ─────────────────────────────────────
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const { toast } = useToast();
  const navigate  = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem("atomise_remember_email");
    if (savedEmail) { setEmail(savedEmail); setRememberMe(true); }
  }, []);

  // ── Detect Supabase password recovery link ────────────────────────────────
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const type = params.get("type");
      const error = params.get("error");
      const errorCode = params.get("error_code");
      const errorDesc = params.get("error_description");

      if (type === "recovery") {
        setView("update_password");
      } else if (error === "access_denied" || errorCode === "otp_expired") {
        setRecoveryError(errorDesc?.replace(/\+/g, " ") || "This reset link has expired. Please request a new one.");
        setView("update_password");
      }
    }
    // Listen for onAuthStateChange PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("update_password");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleViewChange = (newView: AuthView) => {
    if (newView !== "login") setEmail("");
    setPassword("");
    setFullName("");
    setCountryCode("+91");
    setPhoneNumber("");
    setShowPassword(false);
    setPasswordError(null);
    setFieldErrors({});
    setResetEmailSent(false); // ── NEW: reset the sent state when switching views
    setView(newView);
  };

  // ── Login — field validation before calling Supabase ────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!email.trim())
      errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Enter a valid email address";
    if (!password.trim())
      errors.password = "Password is required";
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setLoading(true);
    if (rememberMe) localStorage.setItem("atomise_remember_email", email);
    else localStorage.removeItem("atomise_remember_email");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      toast({ variant: "destructive", title: "Login Failed", description: authError.message });
      setLoading(false);
      return;
    }
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("is_active").eq("id", data.user.id).single();
      if (profileError || !profile?.is_active) {
        await supabase.auth.signOut();
        toast({ variant: "destructive", title: "Access Denied", description: "Your account is currently inactive." });
        setLoading(false);
        return;
      }
    }
    toast({ title: "Welcome back!", description: "Access granted to Atomise CRM." });
    navigate("/");
  };

  // ── Signup — full field validation with inline errors ────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const errors: typeof fieldErrors = {};
    if (!fullName.trim())
      errors.fullName = "Full Name is required";
    if (!phoneNumber.trim())
      errors.mobile = "Mobile number is required";
    else if (phoneNumber.trim().length < 6)
      errors.mobile = "Enter a valid mobile number";
    if (!email.trim())
      errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Enter a valid email address";
    const pwErr = validatePassword(password);
    if (!password.trim())
      errors.password = "Password is required";
    else if (pwErr)
      errors.password = pwErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setPasswordError(errors.password || null);
      return;
    }

    setFieldErrors({});
    setPasswordError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, mobile_number: joinPhone(countryCode, phoneNumber) } },
    });
    if (error) {
      toast({ variant: "destructive", title: "Signup Error", description: error.message });
      setLoading(false);
      return;
    }
    if (data.session) navigate("/");
    else {
      toast({ title: "Success!", description: "Check your email for the confirmation link." });
      handleViewChange("login");
    }
    setLoading(false);
  };

  // ── Update password — called from recovery link ───────────────────────────
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    const pwErr = validatePassword(password);
    if (!password.trim())
      errors.password = "Password is required";
    else if (pwErr)
      errors.password = pwErr;
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); setPasswordError(errors.password || null); return; }
    setFieldErrors({});
    setPasswordError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } else {
      toast({ title: "Password Updated!", description: "Your password has been changed. Please log in." });
      await supabase.auth.signOut();
      handleViewChange("login");
    }
    setLoading(false);
  };

  // ── Forgot password — FIXED: proper validation + inline success state ─────
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // Step 1: Client-side format validation
    const errors: typeof fieldErrors = {};
    if (!email.trim())
      errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Enter a valid email address";
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setFieldErrors({});
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/auth",
    });

    setLoading(false);

    if (error) {
      // Step 2: Show Supabase errors inline (e.g. rate limit exceeded)
      setFieldErrors({ email: error.message });
      return;
    }

    // Step 3: Show inline success — do NOT navigate away
    // Supabase always returns success even for unregistered emails (security by design)
    // So we show a message that covers both cases clearly
    setResetEmailSent(true);
  };

  // ─── Shared input style ───────────────────────────────────────────────────
  const inputCls = "bg-background/50 h-11 rounded-xl";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4 font-sans text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 p-8 glass-card border border-border rounded-2xl shadow-2xl bg-card/80 backdrop-blur-md"
      >
        <AnimatePresence mode="wait">

          {/* ── LOGIN ── */}
          {view === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div className="space-y-2 text-center flex flex-col items-center">
                <img src="/logo.png" alt="Atomise AI" className="w-20 h-20 object-contain mb-2" />
                <h2 className="text-3xl font-bold tracking-tight text-white font-display">Atomise CRM</h2>
                <p className="text-sm text-muted-foreground">Sign in to your CRM account</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                      className={`${inputCls} pl-10 ${fieldErrors.email ? "border-red-500" : ""}`}
                    />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-400 font-medium">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label>Password</Label>
                    <button type="button" onClick={() => setView("forgot_password")} className="text-xs text-primary hover:underline transition-colors mb-1">Forgot Password?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                      className={`${inputCls} pl-10 pr-10 ${fieldErrors.password ? "border-red-500" : ""}`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-xs text-red-400 font-medium">{fieldErrors.password}</p>}
                </div>
                <div className="flex items-center space-x-2 py-1">
                  <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(!!c)} />
                  <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">Remember me</label>
                </div>
                <Button type="submit" className="w-full h-11 font-bold shadow-lg rounded-xl" disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </Button>
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Don't have an account?{" "}
                  <button type="button" onClick={() => handleViewChange("signup")} className="text-primary font-semibold hover:underline">Sign up</button>
                </p>
              </form>
            </motion.div>
          )}

          {/* ── SIGNUP ── */}
          {view === "signup" && (
            <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="space-y-2 text-center flex flex-col items-center">
                <img src="/logo.png" alt="Atomise AI" className="w-16 h-16 object-contain mb-2" />
                <h2 className="text-3xl font-bold tracking-tight text-white font-display">Join Atomise</h2>
                <p className="text-sm text-muted-foreground">Create your Atomise CRM account</p>
              </div>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); setFieldErrors((p) => ({ ...p, fullName: undefined })); }}
                      className={`${inputCls} pl-10 ${fieldErrors.fullName ? "border-red-500" : ""}`}
                    />
                  </div>
                  {fieldErrors.fullName && <p className="text-xs text-red-400 font-medium">{fieldErrors.fullName}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Mobile Number</Label>
                  <PhoneInput
                    countryCode={countryCode}
                    phoneNumber={phoneNumber}
                    onCountryCodeChange={(c) => setCountryCode(c)}
                    onPhoneNumberChange={(n) => { setPhoneNumber(n); setFieldErrors((p) => ({ ...p, mobile: undefined })); }}
                    numberError={fieldErrors.mobile}
                    variant="auth"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                      className={`${inputCls} pl-10 ${fieldErrors.email ? "border-red-500" : ""}`}
                    />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-400 font-medium">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Set Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 chars, 1 uppercase, 1 number, 1 special"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                      className={`${inputCls} pl-10 pr-10 ${passwordError ? "border-red-500" : ""}`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Live checklist */}
                  <PasswordChecklist password={password} />
                  {/* Strength bar */}
                  <StrengthBar password={password} />
                  {/* Error message */}
                  {passwordError && <p className="text-xs text-red-400 font-medium mt-1">{passwordError}</p>}
                </div>
                <Button type="submit" className="w-full h-11 font-bold shadow-lg rounded-xl" disabled={loading}>
                  {loading ? "Processing..." : "Sign Up & Access CRM"}
                </Button>
                <button type="button" onClick={() => handleViewChange("login")} className="flex items-center justify-center w-full gap-2 text-sm text-muted-foreground hover:text-primary pt-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </button>
              </form>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === "forgot_password" && (
            <motion.div key="forgot" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className="space-y-2 text-center flex flex-col items-center">
                <img src="/logo.png" alt="Atomise AI" className="w-16 h-16 object-contain mb-2" />
                <h2 className="text-2xl font-bold tracking-tight text-white font-display">Reset Password</h2>
                <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
              </div>

              {/* ── FIXED: Show success state inline instead of navigating away ── */}
              {resetEmailSent ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="text-sm text-emerald-400 font-semibold">Check your inbox!</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      If <span className="text-white font-medium">{email}</span> is registered, a reset link has been sent. Check your inbox and spam folder.
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Didn't receive it? Make sure the email is registered in the system.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetEmailSent(false)}
                    className="w-full h-11 font-bold rounded-xl"
                  >
                    Try a Different Email
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleViewChange("login")}
                    className="flex items-center justify-center w-full gap-2 text-sm text-muted-foreground hover:text-primary pt-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                    <p className="text-xs text-primary/80 font-medium leading-relaxed">
                      Your new password must contain: at least <strong>6 characters</strong>, <strong>1 uppercase letter</strong>, <strong>1 number</strong>, and <strong>1 special character</strong>.
                    </p>
                  </div>
                  <form onSubmit={handleResetRequest} className="space-y-4">
                    <div className="space-y-1">
                      <Label>Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                          className={`${inputCls} pl-10 ${fieldErrors.email ? "border-red-500" : ""}`}
                        />
                      </div>
                      {/* ── FIXED: inline error shown directly under input ── */}
                      {fieldErrors.email && (
                        <p className="text-xs text-red-400 font-medium">{fieldErrors.email}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full h-11 font-bold shadow-lg rounded-xl" disabled={loading}>
                      {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <button type="button" onClick={() => handleViewChange("login")} className="flex items-center justify-center w-full gap-2 text-sm text-muted-foreground hover:text-primary pt-2">
                      <ArrowLeft className="h-4 w-4" /> Back to Login
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          )}

          {/* ── UPDATE PASSWORD (from reset email link) ── */}
          {view === "update_password" && (
            <motion.div key="update_password" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className="space-y-2 text-center flex flex-col items-center">
                <img src="/logo.png" alt="Atomise AI" className="w-16 h-16 object-contain mb-2" />
                <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                  {recoveryError ? "Link Expired" : "Set New Password"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {recoveryError ? "Your password reset link has expired." : "Enter your new password below."}
                </p>
              </div>

              {/* ── Expired link — show resend option ── */}
              {recoveryError ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400 text-center font-medium">
                      ⚠️ This reset link has expired or is invalid.
                    </p>
                    <p className="text-xs text-muted-foreground/70 text-center mt-1">
                      Reset links expire after 1 hour for security.
                    </p>
                  </div>
                  <Button
                    onClick={() => { setRecoveryError(null); handleViewChange("forgot_password"); }}
                    className="w-full h-11 font-bold shadow-lg rounded-xl"
                  >
                    Request New Reset Link
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleViewChange("login")}
                    className="flex items-center justify-center w-full gap-2 text-sm text-muted-foreground hover:text-primary pt-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                  </button>
                </div>
              ) : (
                /* ── Valid link — show new password form ── */
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 chars, 1 uppercase, 1 number, 1 special"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPasswordError(null); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                        className={`${inputCls} pl-10 pr-10 ${passwordError ? "border-red-500" : ""}`}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordChecklist password={password} />
                    <StrengthBar password={password} />
                    {passwordError && <p className="text-xs text-red-400 font-medium mt-1">{passwordError}</p>}
                  </div>
                  <Button type="submit" className="w-full h-11 font-bold shadow-lg rounded-xl" disabled={loading}>
                    {loading ? "Updating..." : "Update Password"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleViewChange("login")}
                    className="flex items-center justify-center w-full gap-2 text-sm text-muted-foreground hover:text-primary pt-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                  </button>
                </form>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-foreground/80 mb-1 ml-1 block">{children}</label>;
}