import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  User,
  Lock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { PhoneInput, joinPhone } from "@/components/PhoneInput";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { PASSWORD_RULES, validatePassword, passwordStrength } from "@/lib/passwordValidation";
import ParticleBackground from "@/components/ParticleBackground";

type AuthView = "login" | "signup" | "forgot_password" | "update_password";

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

export default function Auth() {
  const [view, setView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    mobile?: string;
    email?: string;
    password?: string;
  }>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem("atomise_remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

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
        setRecoveryError(
          errorDesc?.replace(/\+/g, " ") ||
            "This reset link has expired. Please request a new one."
        );
        setView("update_password");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
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
    setResetEmailSent(false);
    setView(newView);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};

    if (!email.trim()) errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (!password.trim()) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    if (rememberMe) localStorage.setItem("atomise_remember_email", email);
    else localStorage.removeItem("atomise_remember_email");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: authError.message,
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile?.is_active) {
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "Your account is currently inactive.",
        });
        setLoading(false);
        return;
      }
    }

    toast({ title: "Welcome back!", description: "Access granted to Atomise CRM." });
    navigate("/");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof fieldErrors = {};

    if (!fullName.trim()) errors.fullName = "Full Name is required";
    if (!phoneNumber.trim()) errors.mobile = "Mobile number is required";
    else if (phoneNumber.trim().length < 6) errors.mobile = "Enter a valid mobile number";

    if (!email.trim()) errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }

    const pwErr = validatePassword(password);
    if (!password.trim()) errors.password = "Password is required";
    else if (pwErr) errors.password = pwErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setPasswordError(errors.password || null);
      return;
    }

    setFieldErrors({});
    setPasswordError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          mobile_number: joinPhone(countryCode, phoneNumber),
        },
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Signup Error",
        description: error.message,
      });
      setLoading(false);
      return;
    }

    if (data.session) navigate("/");
    else {
      toast({
        title: "Success!",
        description: "Check your email for the confirmation link.",
      });
      handleViewChange("login");
    }

    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof fieldErrors = {};
    const pwErr = validatePassword(password);

    if (!password.trim()) errors.password = "Password is required";
    else if (pwErr) errors.password = pwErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setPasswordError(errors.password || null);
      return;
    }

    setFieldErrors({});
    setPasswordError(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Password Updated!",
        description: "Your password has been changed. Please log in.",
      });
      await supabase.auth.signOut();
      handleViewChange("login");
    }

    setLoading(false);
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/auth",
    });

    setLoading(false);

    if (error) {
      setFieldErrors({ email: error.message });
      return;
    }

    setResetEmailSent(true);
  };

  const inputCls =
    "h-11 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30";

  const primaryButtonCls =
    "w-full h-11 font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all duration-300";

  return (
    <div className="relative flex min-h-screen cursor-none items-center justify-center overflow-hidden bg-[#050810] p-4 font-sans text-foreground">
      <ParticleBackground />

      <div
        className="pointer-events-none absolute inset-0 z-[1]
          bg-[radial-gradient(circle_at_30%_20%,rgba(0,229,255,0.08),transparent_40%),
          radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.08),transparent_40%)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md space-y-8 rounded-2xl border border-white/10
          bg-white/[0.04] p-8 text-white backdrop-blur-xl
          shadow-[0_20px_60px_rgba(0,0,0,0.6)]
          hover:shadow-[0_20px_80px_rgba(0,229,255,0.15)]
          transition-all duration-500"
      >
        <AnimatePresence mode="wait">
          {view === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="space-y-2 text-center flex flex-col items-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
                  <img
                    src="/logo.png"
                    alt="Atomise AI"
                    className="relative mb-2 h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]"
                  />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white font-display">
                  Atomise CRM
                </h2>
                <p className="text-sm text-white/55">Sign in to your CRM account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-white/85">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors((p) => ({ ...p, email: undefined }));
                      }}
                      className={`${inputCls} pl-10 ${fieldErrors.email ? "border-red-500" : ""}`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs font-medium text-red-400">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <Label className="text-white/85">Password</Label>
                    <button
                      type="button"
                      onClick={() => setView("forgot_password")}
                      className="mb-1 text-xs text-primary transition-colors hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className={`${inputCls} pl-10 pr-10 ${fieldErrors.password ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {fieldErrors.password && (
                    <p className="text-xs font-medium text-red-400">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(!!c)}
                  />
                  <label
                    htmlFor="remember"
                    className="cursor-pointer select-none text-sm text-white/65"
                  >
                    Remember me
                  </label>
                </div>

                <Button type="submit" className={primaryButtonCls} disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </Button>

                <p className="pt-2 text-center text-sm text-white/55">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleViewChange("signup")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign up
                  </button>
                </p>
              </form>
            </motion.div>
          )}

          {view === "signup" && (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2 text-center flex flex-col items-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
                  <img
                    src="/logo.png"
                    alt="Atomise AI"
                    className="relative mb-2 h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]"
                  />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white font-display">
                  Join Atomise
                </h2>
                <p className="text-sm text-white/55">Create your Atomise CRM account</p>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-white/85">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setFieldErrors((p) => ({ ...p, fullName: undefined }));
                      }}
                      className={`${inputCls} pl-10 ${fieldErrors.fullName ? "border-red-500" : ""}`}
                    />
                  </div>
                  {fieldErrors.fullName && (
                    <p className="text-xs font-medium text-red-400">{fieldErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-white/85">Mobile Number</Label>
                  <PhoneInput
                    countryCode={countryCode}
                    phoneNumber={phoneNumber}
                    onCountryCodeChange={(c) => setCountryCode(c)}
                    onPhoneNumberChange={(n) => {
                      setPhoneNumber(n);
                      setFieldErrors((p) => ({ ...p, mobile: undefined }));
                    }}
                    numberError={fieldErrors.mobile}
                    variant="auth"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-white/85">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors((p) => ({ ...p, email: undefined }));
                      }}
                      className={`${inputCls} pl-10 ${fieldErrors.email ? "border-red-500" : ""}`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs font-medium text-red-400">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-white/85">Set Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 chars, 1 uppercase, 1 number, 1 special"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError(null);
                      }}
                      className={`${inputCls} pl-10 pr-10 ${passwordError ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <PasswordChecklist password={password} />
                  <StrengthBar password={password} />
                  {passwordError && (
                    <p className="mt-1 text-xs font-medium text-red-400">{passwordError}</p>
                  )}
                </div>

                <Button type="submit" className={primaryButtonCls} disabled={loading}>
                  {loading ? "Processing..." : "Sign Up & Access CRM"}
                </Button>

                <button
                  type="button"
                  onClick={() => handleViewChange("login")}
                  className="flex w-full items-center justify-center gap-2 pt-2 text-sm text-white/55 hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </button>
              </form>
            </motion.div>
          )}

          {view === "forgot_password" && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="space-y-2 text-center flex flex-col items-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
                  <img
                    src="/logo.png"
                    alt="Atomise AI"
                    className="relative mb-2 h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]"
                  />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                  Reset Password
                </h2>
                <p className="text-sm text-white/55">
                  Enter your email and we'll send a reset link.
                </p>
              </div>

              {resetEmailSent ? (
                <div className="space-y-4">
                  <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-400">Check your inbox!</p>
                    <p className="text-xs leading-relaxed text-white/70">
                      If <span className="font-medium text-white">{email}</span> is registered, a
                      reset link has been sent. Check your inbox and spam folder.
                    </p>
                    <p className="text-xs text-white/45">
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
                    className="flex w-full items-center justify-center gap-2 pt-2 text-sm text-white/55 hover:text-primary"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                    <p className="text-xs font-medium leading-relaxed text-primary/80">
                      Your new password must contain: at least <strong>6 characters</strong>,{" "}
                      <strong>1 uppercase letter</strong>, <strong>1 number</strong>, and{" "}
                      <strong>1 special character</strong>.
                    </p>
                  </div>

                  <form onSubmit={handleResetRequest} className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-white/85">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setFieldErrors((p) => ({ ...p, email: undefined }));
                          }}
                          className={`${inputCls} pl-10 ${fieldErrors.email ? "border-red-500" : ""}`}
                        />
                      </div>
                      {fieldErrors.email && (
                        <p className="text-xs font-medium text-red-400">{fieldErrors.email}</p>
                      )}
                    </div>

                    <Button type="submit" className={primaryButtonCls} disabled={loading}>
                      {loading ? "Sending..." : "Send Reset Link"}
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleViewChange("login")}
                      className="flex w-full items-center justify-center gap-2 pt-2 text-sm text-white/55 hover:text-primary"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to Login
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          )}

          {view === "update_password" && (
            <motion.div
              key="update_password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="space-y-2 text-center flex flex-col items-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
                  <img
                    src="/logo.png"
                    alt="Atomise AI"
                    className="relative mb-2 h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.6)]"
                  />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                  {recoveryError ? "Link Expired" : "Set New Password"}
                </h2>
                <p className="text-sm text-white/55">
                  {recoveryError
                    ? "Your password reset link has expired."
                    : "Enter your new password below."}
                </p>
              </div>

              {recoveryError ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                    <p className="text-center text-sm font-medium text-red-400">
                      ⚠️ This reset link has expired or is invalid.
                    </p>
                    <p className="mt-1 text-center text-xs text-white/45">
                      Reset links expire after 1 hour for security.
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      setRecoveryError(null);
                      handleViewChange("forgot_password");
                    }}
                    className={primaryButtonCls}
                  >
                    Request New Reset Link
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleViewChange("login")}
                    className="flex w-full items-center justify-center gap-2 pt-2 text-sm text-white/55 hover:text-primary"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-white/85">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 chars, 1 uppercase, 1 number, 1 special"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError(null);
                          setFieldErrors((p) => ({ ...p, password: undefined }));
                        }}
                        className={`${inputCls} pl-10 pr-10 ${passwordError ? "border-red-500" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 transition-colors hover:text-white"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <PasswordChecklist password={password} />
                    <StrengthBar password={password} />
                    {passwordError && (
                      <p className="mt-1 text-xs font-medium text-red-400">{passwordError}</p>
                    )}
                  </div>

                  <Button type="submit" className={primaryButtonCls} disabled={loading}>
                    {loading ? "Updating..." : "Update Password"}
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleViewChange("login")}
                    className="flex w-full items-center justify-center gap-2 pt-2 text-sm text-white/55 hover:text-primary"
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
