import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  generateLedgerNo: (recordType: string, projectName: string) =>
    ipcRenderer.invoke('generate-ledger-no', recordType, projectName),
  addRecord: (record: any, operator?: string) =>
    ipcRenderer.invoke('add-record', record, operator),
  updateRecord: (id: number, record: any, operator?: string) =>
    ipcRenderer.invoke('update-record', id, record, operator),
  deleteRecord: (id: number) => ipcRenderer.invoke('delete-record', id),
  getAllRecords: () => ipcRenderer.invoke('get-all-records'),
  searchRecords: (filters: any) => ipcRenderer.invoke('search-records', filters),
  getAttachments: (recordId: number) => ipcRenderer.invoke('get-attachments', recordId),
  addAttachment: (attachment: any) => ipcRenderer.invoke('add-attachment', attachment),
  deleteAttachmentFile: (id: number, operator?: string) =>
    ipcRenderer.invoke('delete-attachment-file', id, operator),
  saveAndRegisterFile: (sourcePath: string, recordNo: string, recordId: number, category: string, operator?: string) =>
    ipcRenderer.invoke('save-and-register-file', sourcePath, recordNo, recordId, category, operator),
  saveFileToDirectory: (sourcePath: string, recordNo: string, fileName: string) =>
    ipcRenderer.invoke('save-file-to-directory', sourcePath, recordNo, fileName),
  selectFileDialog: () => ipcRenderer.invoke('select-file-dialog'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),
  getMonthlySummary: () => ipcRenderer.invoke('get-monthly-summary'),
  getAttachmentCounts: () => ipcRenderer.invoke('get-attachment-counts'),
  getUrgencyBoard: () => ipcRenderer.invoke('get-urgency-board'),
  exportExcel: (records: any[]) => ipcRenderer.invoke('export-excel', records),
  generateHandoverPackage: (recordId: number, operator?: string) =>
    ipcRenderer.invoke('generate-handover-package', recordId, operator),
  generateBatchHandoverPackage: (recordIds: number[], options: any, operator?: string) =>
    ipcRenderer.invoke('generate-batch-handover-package', recordIds, options, operator),
  exportUrgencyNotice: (boardItems: any[], options?: any) =>
    ipcRenderer.invoke('export-urgency-notice', boardItems, options),
  confirmMaterialCompletion: (recordId: number, materials: string[], operator: string, note?: string) =>
    ipcRenderer.invoke('confirm-material-completion', recordId, materials, operator, note),
  getOperator: () => ipcRenderer.invoke('get-operator'),
  setOperator: (name: string) => ipcRenderer.invoke('set-operator', name)
})
