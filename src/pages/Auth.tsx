import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, ArrowLeft, Mail, UserPlus, User, Phone, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { PASSWORD_RULES, validatePassword, passwordStrength } from "@/lib/passwordValidation";
type AuthView = "login" | "signup" | "forgot_password";

export default function Auth() {
  const [view, setView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // FIXED: Load saved email on mount for "Remember Me"
  useEffect(() => {
    const savedEmail = localStorage.getItem("atomise_remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleViewChange = (newView: AuthView) => {
    // Keep email if transitioning back to login
    if (newView !== "login") setEmail("");
    setPassword("");
    setFullName("");
    setMobileNumber("");
    setShowPassword(false);
    setView(newView);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // FIXED: Save or clear email based on Remember Me preference
    if (rememberMe) {
      localStorage.setItem("atomise_remember_email", email);
    } else {
      localStorage.removeItem("atomise_remember_email");
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    
    if (authError) {
      toast({ variant: "destructive", title: "Login Failed", description: authError.message });
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
          description: "Your account is currently inactive." 
        });
        setLoading(false);
        return;
      }
    }
    
    toast({ title: "Welcome back!", description: "Access granted to Atomise CRM." });
    navigate("/");
  };

  // Other handlers (signup, reset) remain same...
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ 
      email, password,
      options: { data: { full_name: fullName, mobile_number: mobileNumber } }
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

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth", 
    });
    if (error) toast({ variant: "destructive", title: "Request Failed", description: error.message });
    else {
      toast({ title: "Link Sent!", description: "Check your inbox." });
      handleViewChange("login");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-4 font-sans text-foreground">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 p-8 glass-card border border-border rounded-2xl shadow-2xl bg-card/80 backdrop-blur-md"
      >
        <AnimatePresence mode="wait">
          {view === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
              <div className="space-y-2 text-center flex flex-col items-center">
                <img src="/logo.png" alt="Atomise AI" className="w-20 h-20 object-contain mb-2" />
                <h2 className="text-3xl font-bold tracking-tight text-white font-display">Atomise CRM</h2>
                <p className="text-sm text-muted-foreground">Sign in to your CRM account</p>
              </div>
              
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background/50 pl-10 h-11 rounded-xl" required />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label>Password</Label>
                    <button type="button" onClick={() => setView("forgot_password")} className="text-xs text-primary hover:underline transition-colors mb-1">Forgot Password?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-background/50 pl-10 pr-10 h-11 rounded-xl" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(!!c)} />
                  <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer select-none">Remember me</label>
                </div>

                <Button type="submit" className="w-full h-11 font-bold shadow-lg transition-all active:scale-[0.98] rounded-xl" disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-2">
                  Don't have an account? <button type="button" onClick={() => handleViewChange("signup")} className="text-primary font-semibold hover:underline transition-all">Sign up</button>
                </p>
              </form>
            </motion.div>
          )}

          {/* Signup and Forgot Password views use /logo.png as well... */}
          {view === "signup" && (
            <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="space-y-2 text-center flex flex-col items-center">
                <img src="/logo.png" alt="Atomise AI" className="w-16 h-16 object-contain mb-2" />
                <h2 className="text-3xl font-bold tracking-tight text-white font-display">Join Atomise</h2>
                <p className="text-sm text-muted-foreground">Join the Atomise AI CRM</p>
              </div>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-background/50 pl-10 h-11 rounded-xl" required /></div>
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="tel" placeholder="+91..." value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="bg-background/50 pl-10 h-11 rounded-xl" required /></div>
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background/50 pl-10 h-11 rounded-xl" required /></div>
                </div>
                <div className="space-y-2">
                  <Label>Set Password</Label>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type={showPassword ? "text" : "password"} placeholder="Choose password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-background/50 pl-10 pr-10 h-11 rounded-xl" required /></div>
                </div>
                <Button type="submit" className="w-full h-11 font-bold shadow-lg transition-all rounded-xl" disabled={loading}>{loading ? "Processing..." : "Sign Up & Access CRM"}</Button>
                <button type="button" onClick={() => handleViewChange("login")} className="flex items-center justify-center w-full gap-2 text-sm text-muted-foreground hover:text-primary pt-2"><ArrowLeft className="h-4 w-4" /> Back to Login</button>
              </form>
            </motion.div>
          )}

          {view === "forgot_password" && (
            <motion.div key="forgot" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className="space-y-2 text-center flex flex-col items-center">
                <img src="/logo.png" alt="Atomise AI" className="w-16 h-16 object-contain mb-2" />
                <h2 className="text-2xl font-bold tracking-tight text-white font-display">Reset Password</h2>
                <p className="text-sm text-muted-foreground">Enter your email for a recovery link.</p>
              </div>
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div className="space-y-2"><Label>Email Address</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background/50 pl-10 h-11 rounded-xl" required /></div></div>
                <Button type="submit" className="w-full h-11 font-bold shadow-lg transition-all rounded-xl" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</Button>
                <button type="button" onClick={() => handleViewChange("login")} className="flex items-center justify-center w-full gap-2 text-sm text-muted-foreground hover:text-primary pt-2"><ArrowLeft className="h-4 w-4" /> Back to Login</button>
              </form>
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