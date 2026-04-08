import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import logoImg from "../../assets/logo.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login, register, error, clearError } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Left panel - branding */}
      <div
        className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        }}
      >
        {/* Animated wave lines — echoes the logo */}
        <div className="absolute inset-0 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute left-0 right-0"
              style={{
                top: `${32 + i * 8}%`,
                height: "2px",
                background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,${0.04 + i * 0.01}) 20%, rgba(255,255,255,${0.08 + i * 0.01}) 50%, rgba(255,255,255,${0.04 + i * 0.01}) 80%, transparent 100%)`,
                transform: `translateX(${i % 2 === 0 ? "-10%" : "10%"})`,
              }}
            />
          ))}
        </div>

        {/* Soft glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-[100px]"
          style={{ background: "radial-gradient(circle, #ffffff, transparent 70%)" }}
        />

        <div
          className={`relative z-10 text-center px-12 transition-all duration-1000 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <img
            src={logoImg}
            alt="Flowmatic"
            className="w-20 h-20 rounded-2xl mx-auto mb-8 shadow-2xl shadow-black/50"
          />
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            Flowmatic
          </h1>
          <p className="text-base text-slate-400 font-light">
            All-in-one productivity
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          className={`w-full max-w-sm transition-all duration-700 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-10">
            <div className="flex items-center gap-3">
              <img
                src={logoImg}
                alt="Flowmatic"
                className="w-10 h-10 rounded-xl"
              />
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Flowmatic
              </span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {isLogin ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {isLogin
                ? "Sign in to continue your session."
                : "Get started with a new account."}
            </p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
              {error.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider"
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 focus:border-transparent transition-shadow"
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 focus:border-transparent transition-shadow"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 focus:border-transparent transition-shadow"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? "..."
                : isLogin
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                clearError();
              }}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
