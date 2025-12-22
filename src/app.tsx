import React, { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import PageContent from "./components/PageContent";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SignalsProvider } from "./context/SignalsContext";
import { TimezoneProvider } from "./context/TimezoneContext";
import { ToastProvider } from "./context/ToastContext";
import { AVAILABLE_SIGNALS } from "./pages/settings/components/SignalSettings";

// Add global declaration for TypeScript
declare global {
  interface Window {
    AVAILABLE_SIGNALS: typeof AVAILABLE_SIGNALS;
  }
}

const AppWrapper = () => {
  // Initialize global values
  useEffect(() => {
    // Make AVAILABLE_SIGNALS available globally
    window.AVAILABLE_SIGNALS = AVAILABLE_SIGNALS;
    console.log("Initialized global AVAILABLE_SIGNALS");
  }, []);

  console.log("App component rendering");
  return (
    <StrictMode>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
          <TimezoneProvider>
            <SignalsProvider>
              <div className="min-h-screen bg-gray-50">
                <PageContent />
              </div>
            </SignalsProvider>
          </TimezoneProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </StrictMode>
  );
};

// Add error handling for root mounting
const container = document.getElementById("root");
if (!container) {
  throw new Error("Failed to find the root element");
}

const root = createRoot(container);

// Wrap the render in a try-catch
try {
  console.log("Attempting to render app");
  root.render(<AppWrapper />);
} catch (error) {
  console.error("Failed to render app:", error);
  // Render a fallback error UI
  container.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h1>Something went wrong</h1>
      <pre style="color: red;">${
        error instanceof Error ? error.message : "Unknown error"
      }</pre>
    </div>
  `;
}
