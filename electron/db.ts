import * as fs from 'fs'
import * as path from 'path'
import dayjs from 'dayjs'

export interface LedgerRecord {
  id?: number
  ledger_no: string
  record_type: string
  project_name: string
  building_location: string
  change_reason: string
  proposed_by: string
  specialty: string
  estimated_cost_impact: number
  flow_status: string
  stamped: number
  settled: number
  receive_date: string
  remark?: string
  created_at?: string
  updated_at?: string
}

export interface Attachment {
  id?: number
  record_id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  category: string
  created_at?: string
}

interface DatabaseData {
  records: LedgerRecord[]
  attachments: Attachment[]
  nextRecordId: number
  nextAttachmentId: number
}

let dbPath: string = ''
let cache: DatabaseData | null = null

function defaultData(): DatabaseData {
  return {
    records: [],
    attachments: [],
    nextRecordId: 1,
    nextAttachmentId: 1
  }
}

export function initDatabase(filePath: string): void {
  dbPath = filePath
  if (!fs.existsSync(dbPath)) {
    saveData(defaultData())
  } else {
    loadData()
    migrateData()
  }
}

function migrateData(): void {
  const data = loadData()
  let changed = false
  for (const att of data.attachments) {
    if (!att.category) {
      att.category = guessCategory(att.file_name, att.file_type)
      changed = true
    }
  }
  if (changed) saveData(data)
}

function guessCategory(fileName: string, fileType: string): string {
  const ext = (fileType || fileName.split('.').pop() || '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic'].includes(ext)) return '照片'
  if (ext === 'pdf') return '扫描件'
  if (['doc', 'docx', 'txt', 'rtf', 'wps'].includes(ext)) return '会议纪要'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '结算资料'
  return '扫描件'
}

export function getUserDataPath(): string {
  return path.dirname(dbPath)
}

function loadData(): DatabaseData {
  if (cache) return cache
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8')
    cache = JSON.parse(raw) as DatabaseData
  } catch (e) {
    cache = defaultData()
  }
  return cache!
}

function saveData(data: DatabaseData): void {
  cache = data
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8')
}

function invalidateCache(): void {
  cache = null
}

export function generateLedgerNo(recordType: string, projectName: string): string {
  const typeCodeMap: Record<string, string> = {
    '设计变更': 'BG',
    '工程洽商': 'QS',
    '现场签证': 'QZ'
  }

  const typeCode = typeCodeMap[recordType] || 'QT'
  const yearMonth = dayjs().format('YYYYMM')
  const projectCode = projectName ? projectName.substring(0, 2).toUpperCase() || 'XM' : 'XM'

  const data = loadData()
  const prefix = `${projectCode}-${typeCode}-${yearMonth}-`
  const matches = data.records
    .filter(r => r.ledger_no.startsWith(prefix))
    .map(r => {
      const parts = r.ledger_no.split('-')
      return parseInt(parts[parts.length - 1])
    })
    .filter(n => !isNaN(n))

  let seqNo = 1
  if (matches.length > 0) {
    seqNo = Math.max(...matches) + 1
  }

  const seqStr = String(seqNo).padStart(3, '0')
  return `${projectCode}-${typeCode}-${yearMonth}-${seqStr}`
}

export function addRecord(record: LedgerRecord): number {
  const data = loadData()
  const id = data.nextRecordId
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const newRecord: LedgerRecord = {
    ...record,
    id,
    created_at: now,
    updated_at: now
  }
  data.records.push(newRecord)
  data.nextRecordId = id + 1
  saveData(data)
  return id
}

export function updateRecord(id: number, record: Partial<LedgerRecord>): boolean {
  const data = loadData()
  const idx = data.records.findIndex(r => r.id === id)
  if (idx === -1) return false

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  data.records[idx] = {
    ...data.records[idx],
    ...record,
    id,
    updated_at: now
  }
  saveData(data)
  return true
}

export function deleteRecord(id: number): boolean {
  const data = loadData()
  const before = data.records.length
  data.records = data.records.filter(r => r.id !== id)
  data.attachments = data.attachments.filter(a => a.record_id !== id)
  saveData(data)
  return data.records.length < before
}

export function getAllRecords(): LedgerRecord[] {
  const data = loadData()
  return [...data.records].sort((a, b) => (b.id || 0) - (a.id || 0))
}

export function searchRecords(filters: any): LedgerRecord[] {
  const data = loadData()
  let results = [...data.records]

  if (filters.specialty) {
    results = results.filter(r => r.specialty === filters.specialty)
  }
  if (filters.record_type) {
    results = results.filter(r => r.record_type === filters.record_type)
  }
  if (filters.proposed_by) {
    results = results.filter(r => r.proposed_by === filters.proposed_by)
  }
  if (filters.start_date) {
    results = results.filter(r => r.receive_date >= filters.start_date)
  }
  if (filters.end_date) {
    results = results.filter(r => r.receive_date <= filters.end_date)
  }
  if (filters.not_stamped) {
    results = results.filter(r => r.stamped === 0)
  }
  if (filters.not_settled) {
    results = results.filter(r => r.settled === 0)
  }
  if (filters.no_attachments) {
    const recordsWithAttachments = new Set(data.attachments.map(a => a.record_id))
    results = results.filter(r => !recordsWithAttachments.has(r.id!))
  }
  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase()
    results = results.filter(r =>
      r.project_name.toLowerCase().includes(kw) ||
      r.ledger_no.toLowerCase().includes(kw) ||
      (r.change_reason && r.change_reason.toLowerCase().includes(kw))
    )
  }

  return results.sort((a, b) => (b.id || 0) - (a.id || 0))
}

export function getMonthlySummary(): any[] {
  const data = loadData()
  const recordsByMonth: Record<string, any> = {}

  for (const r of data.records) {
    if (!r.receive_date) continue
    const month = r.receive_date.substring(0, 7)
    if (!recordsByMonth[month]) {
      recordsByMonth[month] = {
        month,
        total: 0,
        not_stamped: 0,
        not_settled: 0,
        no_attachments: 0,
        records: []
      }
    }

    const attCount = data.attachments.filter(a => a.record_id === r.id).length
    recordsByMonth[month].total++
    if (!r.stamped) recordsByMonth[month].not_stamped++
    if (!r.settled) recordsByMonth[month].not_settled++
    if (attCount === 0) recordsByMonth[month].no_attachments++
    recordsByMonth[month].records.push({ ...r, attachment_count: attCount })
  }

  return Object.values(recordsByMonth).sort((a: any, b: any) => b.month.localeCompare(a.month))
}

export function getAllAttachments(recordId: number): Attachment[] {
  const data = loadData()
  return data.attachments
    .filter(a => a.record_id === recordId)
    .sort((a, b) => (b.id || 0) - (a.id || 0))
}

export function getAttachmentsBatch(recordIds: number[]): Record<number, Attachment[]> {
  const data = loadData()
  const result: Record<number, Attachment[]> = {}
  for (const id of recordIds) {
    result[id] = data.attachments
      .filter(a => a.record_id === id)
      .sort((a, b) => (b.id || 0) - (a.id || 0))
  }
  return result
}

export function getAttachmentCounts(): Record<number, number> {
  const data = loadData()
  const counts: Record<number, number> = {}
  for (const att of data.attachments) {
    counts[att.record_id] = (counts[att.record_id] || 0) + 1
  }
  return counts
}

export function saveFileAndAddAttachment(
  sourcePath: string,
  recordNo: string,
  recordId: number,
  category: string
): Attachment | null {
  try {
    const userDataDir = path.dirname(dbPath)
    const targetDir = path.join(userDataDir, 'attachments', recordNo)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const basename = path.basename(sourcePath)
    const uniqueName = `${Date.now()}_${basename}`
    const targetPath = path.join(targetDir, uniqueName)

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath)
    } else {
      return null
    }

    const stats = fs.statSync(targetPath)
    const ext = path.extname(basename).slice(1).toLowerCase()

    const data = loadData()
    const id = data.nextAttachmentId
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const newAtt: Attachment = {
      id,
      record_id: recordId,
      file_name: basename,
      file_path: targetPath,
      file_size: stats.size,
      file_type: ext,
      category: category || guessCategory(basename, ext),
      created_at: now
    }
    data.attachments.push(newAtt)
    data.nextAttachmentId = id + 1
    saveData(data)
    return newAtt
  } catch (e) {
    console.error('保存文件并添加附件失败:', e)
    return null
  }
}

export function addAttachment(attachment: Attachment): number {
  const data = loadData()
  const id = data.nextAttachmentId
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const newAtt: Attachment = {
    ...attachment,
    id,
    category: attachment.category || guessCategory(attachment.file_name, attachment.file_type),
    created_at: now
  }
  data.attachments.push(newAtt)
  data.nextAttachmentId = id + 1
  saveData(data)
  return id
}

export function deleteAttachment(id: number): boolean {
  const data = loadData()
  const before = data.attachments.length
  data.attachments = data.attachments.filter(a => a.id !== id)
  saveData(data)
  return data.attachments.length < before
}

export function deleteAttachmentWithFile(id: number): boolean {
  const data = loadData()
  const att = data.attachments.find(a => a.id === id)
  if (att && att.file_path && fs.existsSync(att.file_path)) {
    try {
      fs.unlinkSync(att.file_path)
    } catch (e) {
      console.error('删除文件失败:', e)
    }
  }
  return deleteAttachment(id)
}

export { }
