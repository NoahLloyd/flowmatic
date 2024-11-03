import React, { useState, useEffect } from "react";

const Settings = () => {
  const getLocalStorageItem = (key: string, defaultValue: any): any => {
    const storedValue = localStorage.getItem(key);
    return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
  };

  const [name, setName] = useState<string>(getLocalStorageItem("name", ""));
  const [defaultProject, setDefaultProject] = useState<string>(
    getLocalStorageItem("defaultProject", "")
  );
  const [defaultMinutes, setDefaultMinutes] = useState<number>(
    getLocalStorageItem("defaultMinutes", 60)
  );
  const [fromColor, setFromColor] = useState<string>(
    getLocalStorageItem("fromColor", "#E8CBC0")
  );
  const [toColor, setToColor] = useState<string>(
    getLocalStorageItem("toColor", "#636FA4")
  );
  const [shortcuts, setShortcuts] = useState<string>(
    getLocalStorageItem("shortcuts", "")
  );

  useEffect(() => {
    localStorage.setItem("name", JSON.stringify(name));
  }, [name]);

  useEffect(() => {
    localStorage.setItem("defaultProject", JSON.stringify(defaultProject));
  }, [defaultProject]);

  useEffect(() => {
    localStorage.setItem("defaultMinutes", JSON.stringify(defaultMinutes));
  }, [defaultMinutes]);

  useEffect(() => {
    localStorage.setItem("fromColor", JSON.stringify(fromColor));
  }, [fromColor]);

  useEffect(() => {
    localStorage.setItem("toColor", JSON.stringify(toColor));
  }, [toColor]);

  useEffect(() => {
    localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
  }, [shortcuts]);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-800">
          Login Information
        </h2>
        <label className="block text-gray-600">
          The identifier for all your sessions will be your name. Changing your
          name will update the identifier, and old sessions will no longer be
          linked to you.
        </label>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-800">Default Project</h2>
        <input
          type="text"
          placeholder="Enter default project"
          value={defaultProject}
          onChange={(e) => setDefaultProject(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-800">
          Default Minutes Set
        </h2>
        <input
          type="number"
          placeholder="Enter default minutes"
          value={defaultMinutes}
          onChange={(e) => setDefaultMinutes(Number(e.target.value))}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-800">
          Preferred Colors
        </h2>
        <div className="flex space-x-2">
          <input
            type="color"
            value={fromColor}
            onChange={(e) => setFromColor(e.target.value)}
            className="w-full h-10 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="color"
            value={toColor}
            onChange={(e) => setToColor(e.target.value)}
            className="w-full h-10 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-800">Shortcuts Set</h2>
        <input
          type="text"
          placeholder="Enter shortcuts"
          value={shortcuts}
          onChange={(e) => setShortcuts(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>
    </div>
  );
};

export default Settings;
