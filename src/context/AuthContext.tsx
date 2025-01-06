import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";

interface User {
  _id: string;
  name: string;
  email: string;
  picture_url?: string;
  preferences: Record<string, any>;
  created_at: string;
  last_updated: string;
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
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      await fetchUser();
    } catch (err) {
      console.error("Auth check failed:", err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUser = async () => {
    try {
      const userData = await api.getCurrentUser();
      setUser(userData);
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

      const response = await api.login(email, password);

      // Check for both token_type and access_token
      if (!response.access_token || response.token_type !== "bearer") {
        throw new Error("Invalid authentication response");
      }

      localStorage.setItem("token", response.access_token);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError({
        message: err.response?.detail || err.message || "Login failed",
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

      const response = await api.register(name, email, password);

      if (!response.access_token) {
        throw new Error("No access token received");
      }

      localStorage.setItem("token", response.access_token);
      setUser(response.user);
      setIsAuthenticated(true);
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
      if (!user?._id) throw new Error("No user found");

      const updatedUser = await api.updateUserPreferences(
        user._id,
        preferences
      );
      setUser(updatedUser);
    } catch (err: any) {
      setError({
        message: err.message || "Failed to update preferences",
        code: err.code,
      });
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
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
