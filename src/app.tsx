import React from "react";
import { createRoot } from "react-dom/client";
import Layout from "./components/layout/Layout";
import PageContent from "./components/PageContent";

const App = () => {
  return <PageContent />;
};

const root = createRoot(document.getElementById("root"));
root.render(<App />);
