import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, GraduationCap, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("student");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    confirmPassword: "",
  });
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("emailSuggestions");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setEmailSuggestions(parsed.filter((e) => typeof e === "string"));
      }
    } catch {
      setEmailSuggestions([]);
    }
  }, []);

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setError("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Basic validation
    if (!formData.email || !formData.password) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    if (!isLogin) {
      if (!formData.name) {
        setError("Please enter your name");
        setLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = isLogin
        ? `${API_BASE_URL}/api/auth/signin`
        : `${API_BASE_URL}/api/auth/signup`;
      
      const payload = isLogin 
        ? {
            username: formData.email,
            email: formData.email,
            password: formData.password,
            role: selectedRole
          }
        : {
            username: formData.name,
            email: formData.email,
            password: formData.password,
            roles: [selectedRole]
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        data = { message: await response.text() || "Authentication failed" };
      }

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      if (isLogin) {
        // Login Success
        // Reset avatar cache to avoid showing previous account image.
        localStorage.removeItem("userAvatarUrl");
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userToken", data.token);
        localStorage.setItem("userEmail", data.email);
        localStorage.setItem("userName", data.username);
        if (data.id) {
          localStorage.setItem("userId", data.id);
        }
        // Update email suggestions
        try {
          const existing = localStorage.getItem("emailSuggestions");
          const list = existing ? JSON.parse(existing) : [];
          const next = Array.isArray(list) ? list.slice() : [];
          const emailVal = data.email || formData.email;
          if (emailVal) {
            const has = next.some((e) => e === emailVal);
            if (!has) {
              next.unshift(emailVal);
            }
            // Limit to last 10
            localStorage.setItem("emailSuggestions", JSON.stringify(next.slice(0, 10)));
            setEmailSuggestions(next.slice(0, 10));
          }
        } catch {
          // ignore storage errors
        }
        // Assuming roles is a list, take the first one or logic to determine primary role
        const role = data.roles && data.roles.length > 0 
          ? data.roles[0].replace('ROLE_', '').toLowerCase() 
          : "student";
        localStorage.setItem("userRole", role);

        window.dispatchEvent(new CustomEvent("session:changed"));
        
        toast.success("Login successful!");
        
        // Navigate based on role
        switch (role) {
          case "teacher":
            navigate("/teacher");
            break;
          case "admin":
            navigate("/admin");
            break;
          default:
            navigate("/student");
        }
      } else {
        // Signup Success
        toast.success("Registration successful! Please sign in.");
        setIsLogin(true); // Switch to login view
        // Reset form password fields
        setFormData(prev => ({
            ...prev,
            password: "",
            confirmPassword: ""
        }));
      }

    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: "student", label: "Student", icon: GraduationCap },
    { value: "teacher", label: "Teacher", icon: User },
    { value: "admin", label: "Admin", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-secondary/30" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-primary-foreground">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-secondary-foreground" />
            </div>
            <span className="text-2xl font-display font-bold">AcademiX</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-display font-bold mb-6 leading-tight">
            Compete. Learn.<br />Achieve Excellence.
          </h1>
          <p className="text-lg opacity-90 max-w-md">
            Join thousands of students in academic competitions, track your achievements, 
            and connect with peers on your journey to success.
          </p>
          
          {/* Decorative elements */}
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-achievement/10 rounded-full blur-2xl" />
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-secondary-foreground" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">AcademiX</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin 
                ? "Enter your credentials to access your account" 
                : "Join AcademiX and start your journey"
              }
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                isLogin 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                !isLogin 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign Up
            </button>
          </div>

          {/* Role Selector (Visible for both Login and Signup) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              {isLogin ? "Login as" : "Sign up as"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {roleOptions.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => handleRoleChange(role.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                    selectedRole === role.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  )}
                >
                  <role.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{role.label}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field (Register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className="w-full h-11 px-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="johndoe@gmail.com"
                  autoComplete="email"
                  list="email-suggestions"
                  className="w-full h-11 pl-11 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
                <datalist id="email-suggestions">
                  {emailSuggestions.map((sug) => (
                    <option key={sug} value={sug} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="w-full h-11 pl-11 pr-11 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full h-11 pl-11 pr-4 rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
