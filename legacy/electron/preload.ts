import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openUploadDialog: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke('upload:openDialog', filters),

  getDataDir: () => ipcRenderer.invoke('app:get-data-dir'),
  pickDataDir: () => ipcRenderer.invoke('app:pick-data-dir'),
  setDataDir: (dir: string) => ipcRenderer.invoke('app:set-data-dir', dir),

  updateFromUrl: (url: string) => ipcRenderer.invoke('app:update-from-url', url),

  onUpdateProgress: (cb: (pct: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, pct: number) => cb(pct);
    ipcRenderer.on('app:update-progress', handler);
    return () => ipcRenderer.off('app:update-progress', handler);
  },

  isElectron: true,
});
