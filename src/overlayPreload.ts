import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlayApi", {
  // Get the overlay type (task or note)
  getOverlayType: () => ipcRenderer.invoke("get-overlay-type"),
  
  // Submit a task
  submitTask: (title: string) => ipcRenderer.invoke("overlay-submit-task", title),
  
  // Submit a note
  submitNote: (content: string) => ipcRenderer.invoke("overlay-submit-note", content),
  
  // Close the overlay
  close: () => ipcRenderer.send("overlay-close"),
  
  // Listen for focus events
  onFocus: (callback: () => void) => {
    ipcRenderer.on("overlay-focus", callback);
  },
});

