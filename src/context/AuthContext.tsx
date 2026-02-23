import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../utils/supabase";

interface User {
  id: string;
  name: string;
  email: string;
  picture_url?: string;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface AuthError {
  message: string;
  code?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: AuthError | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  updateUserPreferences: (preferences: Record<string, any>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    // Check initial session
    checkAuthStatus();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === "SIGNED_IN" && session?.user) {
        // Defer fetchProfile to avoid deadlock: during client initialization,
        // _notifyAllSubscribers awaits this callback, but fetchProfile calls
        // supabase methods that await initializePromise (which can't resolve
        // until _notifyAllSubscribers finishes). setTimeout breaks the cycle.
        setTimeout(() => {
          fetchProfile(session.user.id, session.user.email);
        }, 0);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      setUser({
        id: userId,
        name: profile?.name || "",
        email: email || "",
        picture_url: profile?.picture_url,
        preferences: profile?.preferences || {},
        created_at: profile?.created_at,
        updated_at: profile?.updated_at,
      });
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      setError({ message: "Failed to fetch user data" });
      throw err;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) throw authError;
      if (!data.session) throw new Error("No session returned");

      await fetchProfile(data.user.id, data.user.email);
    } catch (err: any) {
      setError({
        message: err.message || "Login failed",
        code: err.code,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (authError) throw authError;
      if (!data.session) throw new Error("No session returned");

      await fetchProfile(data.user!.id, data.user!.email);
    } catch (err: any) {
      setError({
        message: err.message || "Registration failed",
        code: err.code,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPreferences = async (preferences: Record<string, any>) => {
    try {
      setError(null);
      if (!user?.id) throw new Error("No user found");

      // Merge with existing preferences
      const existingPrefs = user.preferences || {};
      const mergedPrefs = { ...existingPrefs, ...preferences };

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({ preferences: mergedPrefs })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setUser((prev: User) => ({
        ...prev,
        preferences: data.preferences,
        updated_at: data.updated_at,
      }));
    } catch (err: any) {
      setError({
        message: err.message || "Failed to update preferences",
        code: err.code,
      });
      throw err;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
        updateUserPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
