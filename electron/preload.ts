import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  generateLedgerNo: (recordType: string, projectName: string) =>
    ipcRenderer.invoke('generate-ledger-no', recordType, projectName),
  addRecord: (record: any) => ipcRenderer.invoke('add-record', record),
  updateRecord: (id: number, record: any) => ipcRenderer.invoke('update-record', id, record),
  deleteRecord: (id: number) => ipcRenderer.invoke('delete-record', id),
  getAllRecords: () => ipcRenderer.invoke('get-all-records'),
  searchRecords: (filters: any) => ipcRenderer.invoke('search-records', filters),
  getAttachments: (recordId: number) => ipcRenderer.invoke('get-attachments', recordId),
  addAttachment: (attachment: any) => ipcRenderer.invoke('add-attachment', attachment),
  deleteAttachmentFile: (id: number) =>
    ipcRenderer.invoke('delete-attachment-file', id),
  saveAndRegisterFile: (sourcePath: string, recordNo: string, recordId: number, category: string) =>
    ipcRenderer.invoke('save-and-register-file', sourcePath, recordNo, recordId, category),
  saveFileToDirectory: (sourcePath: string, recordNo: string, fileName: string) =>
    ipcRenderer.invoke('save-file-to-directory', sourcePath, recordNo, fileName),
  selectFileDialog: () => ipcRenderer.invoke('select-file-dialog'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),
  getMonthlySummary: () => ipcRenderer.invoke('get-monthly-summary'),
  getAttachmentCounts: () => ipcRenderer.invoke('get-attachment-counts'),
  exportExcel: (csvContent: string, defaultName: string) =>
    ipcRenderer.invoke('export-excel', csvContent, defaultName)
})
