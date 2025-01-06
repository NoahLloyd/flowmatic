import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PageContent from "./components/PageContent";
import { AuthProvider } from "./context/AuthContext";

const App = () => {
  console.log("App component rendering");
  return (
    <StrictMode>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <PageContent />
        </div>
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
  root.render(<App />);
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
