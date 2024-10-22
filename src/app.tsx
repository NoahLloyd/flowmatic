import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Layout from "./components/layout/Layout";
import Home from "./pages/home/Home";
import Timer from "./pages/timer/Timer";
import Tasks from "./pages/tasks/Tasks";
import Stats from "./pages/stats/Stats";
import Settings from "./pages/settings/Settings";

const App = () => {
  const [selected, setSelected] = useState<string>("Home");

  let content;
  switch (selected) {
    case "Home":
      content = <Home />;
      break;
    case "Timer":
      content = <Timer />;
      break;
    case "Tasks":
      content = <Tasks />;
      break;
    case "Stats":
      content = <Stats />;
      break;
    case "Settings":
      content = <Settings />;
      break;
    default:
      content = <Home />;
      break;
  }

  return (
    <Layout selected={selected} setSelected={setSelected}>
      {content}
    </Layout>
  );
};

const root = createRoot(document.getElementById("root"));
root.render(<App />);
