import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import {
  initDatabase, getAllRecords, addRecord, updateRecord, deleteRecord,
  searchRecords, getAllAttachments, addAttachment, deleteAttachment,
  generateLedgerNo, LedgerRecord, Attachment
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

  ipcMain.handle('add-record', (_e, record: LedgerRecord) => {
    return addRecord(record)
  })

  ipcMain.handle('update-record', (_e, id: number, record: Partial<LedgerRecord>) => {
    return updateRecord(id, record)
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

  ipcMain.handle('delete-attachment-file', async (_e, id: number, filePath: string) => {
    const result = deleteAttachment(id)
    if (result && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch (e) {
        console.error('删除文件失败:', e)
      }
    }
    return result
  })

  ipcMain.handle('save-file-to-directory', async (_e, sourcePath: string, recordNo: string, fileName: string) => {
    const userDataPath = app.getPath('userData')
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
    const { shell } = require('electron')
    shell.openPath(folderPath)
    return true
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
