import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import {
  initDatabase, getAllRecords, addRecord, updateRecord, deleteRecord,
  searchRecords, getAllAttachments, addAttachment, deleteAttachment,
  generateLedgerNo, getMonthlySummary, getAttachmentCounts,
  saveFileAndAddAttachment, deleteAttachmentWithFile,
  generateHandoverPackage, generateBatchHandoverPackage, getUrgencyBoard,
  exportRecordsToExcel, exportUrgencyNotice, getRecordById,
  confirmMaterialCompletion, getOperator, setOperator,
  addHandoverReceipt, updateUrgencyStatus,
  LedgerRecord, Attachment, HandoverBatchOptions
} from './db'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: '变更洽商台账管理系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  const attachmentsPath = path.join(userDataPath, 'attachments')
  if (!fs.existsSync(attachmentsPath)) {
    fs.mkdirSync(attachmentsPath, { recursive: true })
  }

  const dbPath = path.join(userDataPath, 'ledger-data.json')
  initDatabase(dbPath)

  ipcMain.handle('get-user-data-path', () => {
    return { userDataPath, attachmentsPath }
  })

  ipcMain.handle('generate-ledger-no', (_e, recordType: string, projectName: string) => {
    return generateLedgerNo(recordType, projectName)
  })

  ipcMain.handle('add-record', (_e, record: LedgerRecord, operator?: string) => {
    const { id, record: savedRecord } = addRecord(record, operator)
    return { id, record: savedRecord }
  })

  ipcMain.handle('update-record', (_e, id: number, record: Partial<LedgerRecord>, operator?: string) => {
    return updateRecord(id, record, operator)
  })

  ipcMain.handle('delete-record', (_e, id: number) => {
    return deleteRecord(id)
  })

  ipcMain.handle('get-all-records', () => {
    return getAllRecords()
  })

  ipcMain.handle('search-records', (_e, filters: any) => {
    return searchRecords(filters)
  })

  ipcMain.handle('get-attachments', (_e, recordId: number) => {
    return getAllAttachments(recordId)
  })

  ipcMain.handle('add-attachment', (_e, attachment: Attachment) => {
    return addAttachment(attachment)
  })

  ipcMain.handle('delete-attachment-file', async (_e, id: number, operator?: string) => {
    return deleteAttachmentWithFile(id, operator)
  })

  ipcMain.handle('save-and-register-file', async (_e, sourcePath: string, recordNo: string, recordId: number, category: string, operator?: string, options?: { asNewVersion?: boolean; versionNote?: string }) => {
    return saveFileAndAddAttachment(sourcePath, recordNo, recordId, category, operator, options)
  })

  ipcMain.handle('save-file-to-directory', async (_e, sourcePath: string, recordNo: string, fileName: string) => {
    const targetDir = path.join(userDataPath, 'attachments', recordNo)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    const targetPath = path.join(targetDir, fileName)
    fs.copyFileSync(sourcePath, targetPath)
    return targetPath
  })

  ipcMain.handle('select-file-dialog', async () => {
    if (!mainWindow) return { canceled: true, filePaths: [] }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    return result
  })

  ipcMain.handle('open-folder', async (_e, folderPath: string) => {
    shell.openPath(folderPath)
    return true
  })

  ipcMain.handle('get-monthly-summary', () => {
    return getMonthlySummary()
  })

  ipcMain.handle('get-attachment-counts', () => {
    return getAttachmentCounts()
  })

  ipcMain.handle('get-urgency-board', () => {
    return getUrgencyBoard()
  })

  ipcMain.handle('export-excel', async (_e, records: LedgerRecord[]) => {
    if (!mainWindow) return false
    const defaultName = `台账导出_${require('dayjs')().format('YYYYMMDD_HHmmss')}.xlsx`
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
    })
    if (!result.canceled && result.filePath) {
      const dir = path.dirname(result.filePath)
      const name = path.basename(result.filePath)
      const realPath = exportRecordsToExcel(records, name, dir)
      return realPath
    }
    return false
  })

  ipcMain.handle('generate-handover-package', async (_e, recordId: number, operator?: string) => {
    if (!mainWindow) return false
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择移交包保存位置',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return false
    const pkg = generateHandoverPackage(recordId, result.filePaths[0], operator)
    if (pkg) {
      shell.openPath(pkg.path)
      return pkg
    }
    return false
  })

  ipcMain.handle('generate-batch-handover-package', async (_e, recordIds: number[], options: HandoverBatchOptions, operator?: string) => {
    if (!mainWindow) return false
    const dirResult = await dialog.showOpenDialog(mainWindow, {
      title: '选择批量移交包保存位置',
      properties: ['openDirectory']
    })
    if (dirResult.canceled || dirResult.filePaths.length === 0) return false
    const pkg = generateBatchHandoverPackage(recordIds, options, dirResult.filePaths[0], operator)
    if (pkg) {
      shell.openPath(pkg.path)
      return pkg
    }
    return false
  })

  ipcMain.handle('export-urgency-notice', async (_e, boardItems: any[], options?: { format?: 'xlsx' | 'text'; proposed_by?: string; month?: string }) => {
    if (!mainWindow) return false
    if (options?.format === 'text') {
      return exportUrgencyNotice(boardItems, { format: 'text', proposed_by: options.proposed_by, month: options.month })
    }
    const defaultName = `催办单_${require('dayjs')().format('YYYYMMDD_HHmmss')}.xlsx`
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
    })
    if (!result.canceled && result.filePath) {
      const dir = path.dirname(result.filePath)
      const name = path.basename(result.filePath)
      return exportUrgencyNotice(boardItems, options || {}, dir, name)
    }
    return false
  })

  ipcMain.handle('confirm-material-completion', (_e, recordId: number, materials: string[], operator: string, note?: string) => {
    return confirmMaterialCompletion(recordId, materials, operator, note)
  })

  ipcMain.handle('get-operator', () => {
    return getOperator()
  })

  ipcMain.handle('set-operator', (_e, name: string) => {
    return setOperator(name)
  })

  ipcMain.handle('add-handover-receipt', (_e, recordId: number, receiver: string, receivedAt: string, handoverPath: string, operator: string, opinion?: string) => {
    return addHandoverReceipt(recordId, receiver, receivedAt, handoverPath, operator, opinion)
  })

  ipcMain.handle('update-urgency-status', (_e, recordIds: number[], status: string, operator: string, note?: string, proposedBy?: string, month?: string) => {
    return updateUrgencyStatus(recordIds, status as any, operator, note, proposedBy, month)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
