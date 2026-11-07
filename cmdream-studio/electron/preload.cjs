const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cmdream", Object.freeze({
  cloudRequest: (input) => ipcRenderer.invoke("cloud:request", input),
  ollamaModels: (input) => ipcRenderer.invoke("ollama:models", input),
  ollamaGenerate: (input) => ipcRenderer.invoke("ollama:generate", input)
}));
