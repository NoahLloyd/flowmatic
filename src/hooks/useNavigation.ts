import { useState, useEffect } from "react";

export const useNavigation = () => {
  const [selected, setSelected] = useState<string>("Home");

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "h":
          setSelected("Home");
          break;
        case "f":
          setSelected("Focus");
          break;
        case "t":
          setSelected("Tasks");
          break;
        case "w":
          setSelected("Writing");
          break;
        case "i":
          setSelected("Insights");
          break;
        case "s":
          setSelected("Settings");
          break;
      }
    };

    window.electron.on("toggle-timer", () => {
      // Note: This will need to be handled differently since we moved timer logic
      // We'll need to pass this handler from the parent component
    });

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  return { selected, setSelected };
};
