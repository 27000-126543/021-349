import * as fs from 'fs'
import * as path from 'path'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { HandoverBatchOptions } from '../src/types'
export type { HandoverBatchOptions }

export interface TimelineEvent {
  event_type: 'register' | 'upload_attachment' | 'delete_attachment' | 'status_change'
    | 'generate_handover' | 'complete_material' | 'stamped_change' | 'settled_change' | 'edit'
  event_name: string
  operator: string
  happened_at: string
  detail?: string
  attachment_id?: number
  material_name?: string
  handover_path?: string
  old_value?: string
  new_value?: string
}

export interface CompletionRecord {
  material_name: string
  completed_at: string
  operator: string
  attachment_ids?: number[]
  note?: string
}

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
  timeline?: TimelineEvent[]
  completion_records?: CompletionRecord[]
  last_operator?: string
}

export interface Attachment {
  id?: number
  record_id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  category: string
  uploaded_by?: string
  created_at?: string
}

interface DatabaseData {
  records: LedgerRecord[]
  attachments: Attachment[]
  nextRecordId: number
  nextAttachmentId: number
  settings: { operator?: string }
}

export const ATTACHMENT_CATEGORIES = ['扫描件', '照片', '会议纪要', '结算资料', '其他'] as const
export const DEFAULT_OPERATOR = '资料员'

let dbPath: string = ''
let cache: DatabaseData | null = null

function defaultData(): DatabaseData {
  return {
    records: [],
    attachments: [],
    nextRecordId: 1,
    nextAttachmentId: 1,
    settings: { operator: DEFAULT_OPERATOR }
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
  if (!data.settings) {
    data.settings = { operator: DEFAULT_OPERATOR }
    changed = true
  }
  for (const r of data.records) {
    if (!r.timeline) {
      r.timeline = [{
        event_type: 'register',
        event_name: '登记台账',
        operator: r.last_operator || DEFAULT_OPERATOR,
        happened_at: r.created_at || dayjs().format('YYYY-MM-DD HH:mm:ss'),
        detail: '历史数据补建'
      }]
      changed = true
    }
    if (!r.completion_records) {
      r.completion_records = []
      changed = true
    }
  }
  for (const att of data.attachments) {
    if (!att.category) {
      att.category = guessCategory(att.file_name, att.file_type)
      changed = true
    }
    if (!att.uploaded_by) {
      att.uploaded_by = DEFAULT_OPERATOR
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

export function getMissingMaterialsForRecord(record: LedgerRecord, attachments: Attachment[] = []): string[] {
  const missing: string[] = []
  if (!record.stamped) {
    const hasStampScan = attachments.some(a => a.category === '扫描件')
    if (!hasStampScan) missing.push('盖章件')
  }
  if (!record.settled) {
    const hasSettlement = attachments.some(a => a.category === '结算资料')
    if (!hasSettlement) missing.push('结算单')
  }
  if (!record.change_reason) {
    const hasScan = attachments.some(a => a.category === '扫描件')
    if (!hasScan) missing.push('变更说明')
  }
  const hasMeetingMinutes = attachments.some(a => a.category === '会议纪要')
  if (!hasMeetingMinutes) missing.push('会议纪要')
  const hasPhoto = attachments.some(a => a.category === '照片')
  if (!hasPhoto) missing.push('现场照片')
  return missing
}

export function getUserDataPath(): string {
  return path.dirname(dbPath)
}

export function getOperator(): string {
  const data = loadData()
  return data.settings?.operator || DEFAULT_OPERATOR
}

export function setOperator(name: string): boolean {
  const data = loadData()
  if (!data.settings) data.settings = {}
  data.settings.operator = name || DEFAULT_OPERATOR
  saveData(data)
  return true
}

function loadData(): DatabaseData {
  if (cache) return cache
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8')
    const parsed = JSON.parse(raw) as DatabaseData
    cache = {
      ...defaultData(),
      ...parsed,
      settings: { ...defaultData().settings, ...(parsed.settings || {}) }
    }
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

function appendTimeline(record: LedgerRecord, event: TimelineEvent): void {
  if (!record.timeline) record.timeline = []
  record.timeline.push(event)
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

export function addRecord(record: LedgerRecord, operator?: string): { id: number; record: LedgerRecord } {
  const data = loadData()
  const id = data.nextRecordId
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const op = operator || data.settings?.operator || DEFAULT_OPERATOR
  const newRecord: LedgerRecord = {
    ...record,
    id,
    created_at: now,
    updated_at: now,
    last_operator: op,
    timeline: [{
      event_type: 'register',
      event_name: '登记台账',
      operator: op,
      happened_at: now,
      detail: `${record.record_type} - ${record.project_name}`
    }],
    completion_records: []
  }
  data.records.push(newRecord)
  data.nextRecordId = id + 1
  saveData(data)
  return { id, record: newRecord }
}

export function getRecordById(id: number): LedgerRecord | null {
  const data = loadData()
  return data.records.find(r => r.id === id) || null
}

export function updateRecord(id: number, record: Partial<LedgerRecord>, operator?: string): boolean {
  const data = loadData()
  const idx = data.records.findIndex(r => r.id === id)
  if (idx === -1) return false
  const op = operator || data.settings?.operator || DEFAULT_OPERATOR
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const old = data.records[idx]
  const merged: LedgerRecord = {
    ...old,
    ...record,
    id,
    updated_at: now,
    last_operator: op
  }
  if (!merged.timeline) merged.timeline = []
  if (!merged.completion_records) merged.completion_records = []

  if (record.flow_status !== undefined && record.flow_status !== old.flow_status) {
    appendTimeline(merged, {
      event_type: 'status_change',
      event_name: '流转状态变更',
      operator: op,
      happened_at: now,
      old_value: old.flow_status,
      new_value: record.flow_status,
      detail: `从「${old.flow_status}」变更为「${record.flow_status}」`
    })
  }
  if (record.stamped !== undefined && record.stamped !== old.stamped) {
    appendTimeline(merged, {
      event_type: 'stamped_change',
      event_name: record.stamped ? '确认盖章' : '取消盖章',
      operator: op,
      happened_at: now,
      old_value: old.stamped ? '已盖章' : '未盖章',
      new_value: record.stamped ? '已盖章' : '未盖章'
    })
  }
  if (record.settled !== undefined && record.settled !== old.settled) {
    appendTimeline(merged, {
      event_type: 'settled_change',
      event_name: record.settled ? '确认结算' : '取消结算',
      operator: op,
      happened_at: now,
      old_value: old.settled ? '已结算' : '未结算',
      new_value: record.settled ? '已结算' : '未结算'
    })
  }
  const hasEdit = Object.keys(record).some(k =>
    !['flow_status', 'stamped', 'settled', 'updated_at'].includes(k) &&
    (record as any)[k] !== (old as any)[k]
  )
  if (hasEdit) {
    appendTimeline(merged, {
      event_type: 'edit',
      event_name: '修改台账信息',
      operator: op,
      happened_at: now,
      detail: '更新基本信息'
    })
  }

  data.records[idx] = merged
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
  if (filters.specialty) results = results.filter(r => r.specialty === filters.specialty)
  if (filters.record_type) results = results.filter(r => r.record_type === filters.record_type)
  if (filters.proposed_by) results = results.filter(r => r.proposed_by === filters.proposed_by)
  if (filters.start_date) results = results.filter(r => r.receive_date >= filters.start_date)
  if (filters.end_date) results = results.filter(r => r.receive_date <= filters.end_date)
  if (filters.not_stamped) results = results.filter(r => r.stamped === 0)
  if (filters.not_settled) results = results.filter(r => r.settled === 0)
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
      recordsByMonth[month] = { month, total: 0, not_stamped: 0, not_settled: 0, no_attachments: 0, records: [] }
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

export function getUrgencyBoard(): any[] {
  const data = loadData()
  const map: Record<string, any> = {}
  for (const r of data.records) {
    if (!r.proposed_by) continue
    const month = r.receive_date ? r.receive_date.substring(0, 7) : '未标注月份'
    const key = `${r.proposed_by}__${month}`
    if (!map[key]) {
      map[key] = {
        proposed_by: r.proposed_by,
        month,
        total: 0,
        missing_stamp: 0,
        missing_settlement: 0,
        missing_attachments: 0,
        missing_materials_detail: {} as Record<string, number>,
        records: []
      }
    }
    const atts = data.attachments.filter(a => a.record_id === r.id)
    const missing = getMissingMaterialsForRecord(r, atts)
    map[key].total++
    if (!r.stamped) map[key].missing_stamp++
    if (!r.settled) map[key].missing_settlement++
    if (atts.length === 0) map[key].missing_attachments++
    for (const m of missing) {
      map[key].missing_materials_detail[m] = (map[key].missing_materials_detail[m] || 0) + 1
    }
    map[key].records.push({ ...r, attachment_count: atts.length, missing_materials: missing })
  }
  return Object.values(map).sort((a: any, b: any) => b.total - a.total)
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
  category: string,
  operator?: string
): Attachment | null {
  try {
    const userDataDir = path.dirname(dbPath)
    const targetDir = path.join(userDataDir, 'attachments', recordNo)
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
    const basename = path.basename(sourcePath)
    const uniqueName = `${Date.now()}_${basename}`
    const targetPath = path.join(targetDir, uniqueName)
    if (fs.existsSync(sourcePath)) fs.copyFileSync(sourcePath, targetPath)
    else return null

    const stats = fs.statSync(targetPath)
    const ext = path.extname(basename).slice(1).toLowerCase()

    const data = loadData()
    const id = data.nextAttachmentId
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const op = operator || data.settings?.operator || DEFAULT_OPERATOR
    const newAtt: Attachment = {
      id,
      record_id: recordId,
      file_name: basename,
      file_path: targetPath,
      file_size: stats.size,
      file_type: ext,
      category: category || guessCategory(basename, ext),
      uploaded_by: op,
      created_at: now
    }
    data.attachments.push(newAtt)
    data.nextAttachmentId = id + 1

    const recIdx = data.records.findIndex(r => r.id === recordId)
    if (recIdx !== -1) {
      const rec = data.records[recIdx]
      if (!rec.timeline) rec.timeline = []
      rec.timeline.push({
        event_type: 'upload_attachment',
        event_name: `上传附件（${newAtt.category}）`,
        operator: op,
        happened_at: now,
        attachment_id: id,
        detail: `${newAtt.file_name}（${(newAtt.file_size / 1024).toFixed(1)}KB）`
      })
      rec.updated_at = now
      rec.last_operator = op
    }

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
  const op = attachment.uploaded_by || data.settings?.operator || DEFAULT_OPERATOR
  const newAtt: Attachment = {
    ...attachment,
    id,
    category: attachment.category || guessCategory(attachment.file_name, attachment.file_type),
    uploaded_by: op,
    created_at: now
  }
  data.attachments.push(newAtt)
  data.nextAttachmentId = id + 1

  const recIdx = data.records.findIndex(r => r.id === attachment.record_id)
  if (recIdx !== -1) {
    const rec = data.records[recIdx]
    if (!rec.timeline) rec.timeline = []
    rec.timeline.push({
      event_type: 'upload_attachment',
      event_name: `上传附件（${newAtt.category}）`,
      operator: op,
      happened_at: now,
      attachment_id: id,
      detail: newAtt.file_name
    })
    rec.updated_at = now
    rec.last_operator = op
  }

  saveData(data)
  return id
}

export function deleteAttachment(id: number, operator?: string): boolean {
  const data = loadData()
  const att = data.attachments.find(a => a.id === id)
  const before = data.attachments.length
  data.attachments = data.attachments.filter(a => a.id !== id)

  if (att) {
    const op = operator || data.settings?.operator || DEFAULT_OPERATOR
    const recIdx = data.records.findIndex(r => r.id === att.record_id)
    if (recIdx !== -1) {
      const rec = data.records[recIdx]
      if (!rec.timeline) rec.timeline = []
      rec.timeline.push({
        event_type: 'delete_attachment',
        event_name: `删除附件（${att.category}）`,
        operator: op,
        happened_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        detail: att.file_name
      })
      rec.updated_at = dayjs().format('YYYY-MM-DD HH:mm:ss')
      rec.last_operator = op
    }
  }

  saveData(data)
  return data.attachments.length < before
}

export function deleteAttachmentWithFile(id: number, operator?: string): boolean {
  const data = loadData()
  const att = data.attachments.find(a => a.id === id)
  if (att && att.file_path && fs.existsSync(att.file_path)) {
    try { fs.unlinkSync(att.file_path) } catch (e) { console.error('删除文件失败:', e) }
  }
  return deleteAttachment(id, operator)
}

export function confirmMaterialCompletion(
  recordId: number,
  materials: string[],
  operator: string,
  note?: string
): boolean {
  const data = loadData()
  const idx = data.records.findIndex(r => r.id === recordId)
  if (idx === -1) return false
  const rec = data.records[idx]
  if (!rec.completion_records) rec.completion_records = []
  if (!rec.timeline) rec.timeline = []
  const op = operator || data.settings?.operator || DEFAULT_OPERATOR
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const atts = data.attachments.filter(a => a.record_id === recordId)
  const existing = rec.completion_records.map(c => c.material_name)
  for (const m of materials) {
    if (existing.includes(m)) continue
    const ids = atts.filter(a => {
      if (m === '盖章件' || m === '变更说明') return a.category === '扫描件'
      if (m === '结算单') return a.category === '结算资料'
      if (m === '会议纪要') return a.category === '会议纪要'
      if (m === '现场照片') return a.category === '照片'
      return false
    }).map(a => a.id!)
    rec.completion_records.push({
      material_name: m,
      completed_at: now,
      operator: op,
      attachment_ids: ids,
      note
    })
    rec.timeline.push({
      event_type: 'complete_material',
      event_name: `材料补齐确认：${m}`,
      operator: op,
      happened_at: now,
      material_name: m,
      detail: note || '经办人确认材料已收齐'
    })
  }
  rec.updated_at = now
  rec.last_operator = op
  saveData(data)
  return true
}

function buildSinglePackageContent(
  record: LedgerRecord,
  atts: Attachment[],
  pkgDir: string,
  operator?: string
): { manifest: any; copied: any[]; missing: string[] } {
  for (const cat of ATTACHMENT_CATEGORIES) {
    fs.mkdirSync(path.join(pkgDir, cat), { recursive: true })
  }
  fs.mkdirSync(path.join(pkgDir, '待补材料'), { recursive: true })

  const missing = getMissingMaterialsForRecord(record, atts)
  const copied: any[] = []
  for (const att of atts) {
    const catDir = ATTACHMENT_CATEGORIES.includes(att.category as any) ? att.category : '其他'
    const dest = path.join(pkgDir, catDir, att.file_name)
    try {
      if (fs.existsSync(att.file_path)) {
        fs.copyFileSync(att.file_path, dest)
        copied.push({
          category: catDir,
          file_name: att.file_name,
          file_size: att.file_size,
          uploaded_by: att.uploaded_by,
          created_at: att.created_at
        })
      }
    } catch (e) {
      console.error('复制失败:', att.file_name, e)
    }
  }

  const missingInfo: any[] = missing.map(m => ({
    '材料名称': m,
    '说明': getMaterialDescription(m),
    '状态': '待补充'
  }))

  const manifest: any = {
    '台账编号': record.ledger_no,
    '单据类型': record.record_type,
    '工程名称': record.project_name,
    '楼栋部位': record.building_location || '-',
    '涉及专业': record.specialty,
    '提出单位': record.proposed_by || '-',
    '预计费用影响': record.estimated_cost_impact ? `¥${record.estimated_cost_impact.toLocaleString()}` : '¥0',
    '流转状态': record.flow_status,
    '收文日期': record.receive_date,
    '盖章状态': record.stamped ? '已盖章' : '未盖章',
    '结算状态': record.settled ? '已结算' : '未结算',
    '变更原因': record.change_reason || '-',
    '生成时间': dayjs().format('YYYY-MM-DD HH:mm:ss'),
    '附件总数': atts.length,
    '待补材料数': missing.length,
    '生成人': operator || DEFAULT_OPERATOR
  }

  const completions = record.completion_records || []
  const completionSheet: any[][] = [
    ['材料名称', '补齐时间', '经办人', '关联附件数', '备注'],
    ...(['盖章件', '结算单', '变更说明', '会议纪要', '现场照片'].map(m => {
      const c = completions.find(x => x.material_name === m)
      if (c) return [m, c.completed_at, c.operator, (c.attachment_ids || []).length, c.note || '']
      return [m, '-', '-', 0, missing.includes(m) ? '待补充' : '已具备']
    }))
  ]

  const manifestSheet = [
    ['项目资料移交清单', '', '', ''],
    ...Object.entries(manifest).map(([k, v]) => [k, v as any, '', '']),
    ['', '', '', ''],
    ['--- 材料补齐情况 ---', '', '', ''],
    ...completionSheet,
    ['', '', '', ''],
    ['--- 已归档附件明细 ---', '', '', ''],
    ['分类', '文件名', '大小(KB)', '上传人/上传时间'],
    ...copied.map(c => [
      c.category,
      c.file_name,
      (c.file_size / 1024).toFixed(1),
      `${c.uploaded_by || '-'} / ${c.created_at || '-'}`
    ])
  ]
  if (missing.length > 0) {
    manifestSheet.push(['', '', '', ''], ['--- 待补材料清单 ---', '', '', ''],
      ['材料名称', '说明', '状态', ''],
      ...missingInfo.map(m => [m['材料名称'], m['说明'], m['状态'], '']))
  }

  const ws = XLSX.utils.aoa_to_sheet(manifestSheet)
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 26 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '移交清单')
  const xlsxPath = path.join(pkgDir, `移交清单_${record.ledger_no}.xlsx`)
  XLSX.writeFile(wb, xlsxPath)

  const txtLines: string[] = [
    `项目资料移交清单`,
    `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
    `生成人: ${operator || DEFAULT_OPERATOR}`,
    ``,
    `=== 台账信息 ===`,
    `台账编号: ${record.ledger_no}`,
    `单据类型: ${record.record_type}`,
    `工程名称: ${record.project_name}`,
    `楼栋部位: ${record.building_location || '-'}`,
    `涉及专业: ${record.specialty}`,
    `提出单位: ${record.proposed_by || '-'}`,
    `预计费用影响: ¥${record.estimated_cost_impact?.toLocaleString() || '0'}`,
    `流转状态: ${record.flow_status}`,
    `收文日期: ${record.receive_date}`,
    `盖章状态: ${record.stamped ? '已盖章' : '未盖章'}`,
    `结算状态: ${record.settled ? '已结算' : '未结算'}`,
    `变更原因: ${record.change_reason || '-'}`,
    ``,
    `=== 材料补齐情况 ===`
  ]
  for (const m of ['盖章件', '结算单', '变更说明', '会议纪要', '现场照片']) {
    const c = completions.find(x => x.material_name === m)
    if (c) txtLines.push(`✓ ${m} - ${c.completed_at} - 经办人:${c.operator}${c.note ? `(${c.note})` : ''}`)
    else if (missing.includes(m)) txtLines.push(`✗ ${m} - 待补充 - ${getMaterialDescription(m)}`)
    else txtLines.push(`○ ${m} - 已具备`)
  }
  txtLines.push(
    ``,
    `=== 已归档附件 (${atts.length}份) ===`,
    ...ATTACHMENT_CATEGORIES.map(cat => {
      const list = copied.filter(c => c.category === cat)
      if (list.length === 0) return `[${cat}] 无`
      return `[${cat}] ${list.length}份:\n  ` + list.map(c =>
        `- ${c.file_name} (${(c.file_size / 1024).toFixed(1)}KB, ${c.uploaded_by || '-'})`
      ).join('\n  ')
    }).join('\n'),
    ``,
    `=== 待补材料 (${missing.length}项) ===`,
    missing.length === 0 ? '材料齐全，可移交' : missing.map(m => `! ${m} - ${getMaterialDescription(m)}`).join('\n')
  )
  fs.writeFileSync(path.join(pkgDir, '移交说明.txt'), txtLines.join('\n'), 'utf-8')

  return {
    manifest: {
      ...manifest,
      attachments_copied: copied.length,
      missing_materials: missing,
      completions: completions
    },
    copied,
    missing
  }
}

export function generateHandoverPackage(
  recordId: number,
  targetDir: string,
  operator?: string
): { path: string; manifest: any } | null {
  try {
    const data = loadData()
    const record = data.records.find(r => r.id === recordId)
    if (!record) return null
    const atts = data.attachments.filter(a => a.record_id === recordId)

    const pkgDir = path.join(targetDir, `${record.ledger_no}_移交包_${dayjs().format('YYYYMMDD_HHmmss')}`)
    fs.mkdirSync(pkgDir, { recursive: true })

    const result = buildSinglePackageContent(record, atts, pkgDir, operator)

    const idx = data.records.findIndex(r => r.id === recordId)
    if (idx !== -1) {
      const rec = data.records[idx]
      if (!rec.timeline) rec.timeline = []
      const op = operator || data.settings?.operator || DEFAULT_OPERATOR
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      rec.timeline.push({
        event_type: 'generate_handover',
        event_name: '生成单条移交包',
        operator: op,
        happened_at: now,
        handover_path: pkgDir,
        detail: `附件${result.copied.length}份，缺失${result.missing.length}项`
      })
      rec.updated_at = now
      rec.last_operator = op
      saveData(data)
    }

    return { path: pkgDir, manifest: result.manifest }
  } catch (e) {
    console.error('生成移交包失败:', e)
    return null
  }
}

export function generateBatchHandoverPackage(
  recordIds: number[],
  options: HandoverBatchOptions,
  targetDir: string,
  operator?: string
): { path: string; manifest: any } | null {
  try {
    const data = loadData()
    const records = data.records.filter(r => recordIds.includes(r.id!))
    if (records.length === 0) return null
    const op = operator || data.settings?.operator || DEFAULT_OPERATOR

    const pkgName = options.packageName || `批量移交包_${dayjs().format('YYYYMMDD_HHmmss')}`
    const rootDir = path.join(targetDir, pkgName)
    fs.mkdirSync(rootDir, { recursive: true })

    const groups: Record<string, LedgerRecord[]> = {}
    if (options.groupBy === 'proposed_by') {
      for (const r of records) {
        const k = r.proposed_by || '未指定责任单位'
        if (!groups[k]) groups[k] = []
        groups[k].push(r)
      }
    } else if (options.groupBy === 'month') {
      for (const r of records) {
        const k = r.receive_date ? r.receive_date.substring(0, 7) : '未标注月份'
        if (!groups[k]) groups[k] = []
        groups[k].push(r)
      }
    } else {
      groups['全部单据'] = records
    }

    const summaryRows: any[][] = [
      ['批量移交汇总清单', '', '', '', '', '', '', ''],
      ['生成时间', dayjs().format('YYYY-MM-DD HH:mm:ss'), '', '', '', '', '', ''],
      ['生成人', op, '', '', '', '', '', ''],
      ['分组方式', options.groupBy === 'proposed_by' ? '按责任单位' : options.groupBy === 'month' ? '按收文月份' : '不分组', '', '', '', '', '', ''],
      ['单据总数', records.length, '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['分组', '台账编号', '单据类型', '工程名称', '专业', '责任单位', '附件数', '待补材料数', '缺失项']
    ]
    let overallCopied = 0
    let overallMissing = 0
    const perRecordManifest: any[] = []

    for (const [groupName, groupRecords] of Object.entries(groups)) {
      const groupDir = path.join(rootDir, groupName)
      fs.mkdirSync(groupDir, { recursive: true })
      for (const r of groupRecords) {
        const atts = data.attachments.filter(a => a.record_id === r.id)
        const recDir = path.join(groupDir, r.ledger_no)
        fs.mkdirSync(recDir, { recursive: true })
        const result = buildSinglePackageContent(r, atts, recDir, op)
        overallCopied += result.copied.length
        overallMissing += result.missing.length
        summaryRows.push([
          groupName,
          r.ledger_no,
          r.record_type,
          r.project_name,
          r.specialty,
          r.proposed_by || '-',
          result.copied.length,
          result.missing.length,
          result.missing.join('、') || '齐全'
        ])
        perRecordManifest.push({
          ledger_no: r.ledger_no,
          group: groupName,
          copied: result.copied.length,
          missing: result.missing
        })
        const idx = data.records.findIndex(x => x.id === r.id)
        if (idx !== -1) {
          const rec = data.records[idx]
          if (!rec.timeline) rec.timeline = []
          const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
          rec.timeline.push({
            event_type: 'generate_handover',
            event_name: '批量生成移交包',
            operator: op,
            happened_at: now,
            handover_path: recDir,
            detail: `${pkgName} / ${groupName}，附件${result.copied.length}份，缺失${result.missing.length}项`
          })
          rec.updated_at = now
          rec.last_operator = op
        }
      }
    }
    saveData(data)

    summaryRows.push(
      ['', '', '', '', '', '', '', ''],
      ['合计', '', '', '', '', '', overallCopied, overallMissing, '']
    )
    const ws = XLSX.utils.aoa_to_sheet(summaryRows)
    ws['!cols'] = [
      { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 8 },
      { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 28 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '总清单')

    const detailRows = [
      ['材料补齐详情', '', '', '', ''],
      ['台账编号', '材料名称', '补齐时间', '经办人', '备注']
    ]
    for (const r of records) {
      const comps = r.completion_records || []
      if (comps.length === 0) {
        detailRows.push([r.ledger_no, '(无补齐记录)', '', '', ''])
      } else {
        for (const c of comps) {
          detailRows.push([r.ledger_no, c.material_name, c.completed_at, c.operator, c.note || ''])
        }
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
    ws2['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws2, '补齐情况')

    XLSX.writeFile(wb, path.join(rootDir, `总移交清单_${dayjs().format('YYYYMMDD')}.xlsx`))

    const readme = [
      `批量移交包说明`,
      `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
      `生成人: ${op}`,
      `分组方式: ${options.groupBy === 'proposed_by' ? '按责任单位' : options.groupBy === 'month' ? '按收文月份' : '不分组'}`,
      `单据总数: ${records.length}`,
      `总附件数: ${overallCopied}`,
      `总待补项: ${overallMissing}`,
      ``,
      `=== 目录结构 ===`,
      ...Object.entries(groups).map(([k, list]) =>
        `${k}/\n` + list.map(r => `  ${r.ledger_no}/   [移交清单] [扫描件] [照片] [会议纪要] [结算资料]`).join('\n')
      ).join('\n'),
      ``,
      `=== 说明 ===`,
      `1. 每个单据目录内包含移交清单.xlsx 和移交说明.txt`,
      `2. 根目录下总移交清单.xlsx 汇总所有单据和补齐情况`,
      `3. 待补材料目录说明还需补的清单项目`
    ].join('\n')
    fs.writeFileSync(path.join(rootDir, 'README.txt'), readme, 'utf-8')

    return {
      path: rootDir,
      manifest: {
        package_name: pkgName,
        group_by: options.groupBy,
        total_records: records.length,
        total_attachments: overallCopied,
        total_missing: overallMissing,
        groups: Object.keys(groups),
        records: perRecordManifest
      }
    }
  } catch (e) {
    console.error('批量生成移交包失败:', e)
    return null
  }
}

function getMaterialDescription(key: string): string {
  const map: Record<string, string> = {
    '盖章件': '需要建设/设计/监理三方盖章的设计变更扫描件',
    '结算单': '费用结算单或签证计价单',
    '变更说明': '变更内容的正式说明文件扫描件',
    '会议纪要': '相关专题讨论会的签到及会议纪要',
    '现场照片': '变更部位施工前/中/后对比照片'
  }
  return map[key] || key
}

export function exportRecordsToExcel(records: LedgerRecord[], defaultName: string, saveDir: string): string | null {
  try {
    const data = loadData()
    const attsBatch = getAttachmentsBatch(records.map(r => r.id!))
    const headerRow = [
      '台账编号', '单据类型', '工程名称', '楼栋部位', '涉及专业', '提出单位',
      '预计费用影响(元)', '流转状态', '收文日期', '盖章状态', '结算状态',
      '缺失材料', '附件数量', '附件分类统计', '最近经办人', '补齐材料数'
    ]
    const dataRows: any[][] = records.map(r => {
      const atts = attsBatch[r.id!] || []
      const missing = getMissingMaterialsForRecord(r, atts)
      const catCount: Record<string, number> = {}
      atts.forEach(a => { catCount[a.category] = (catCount[a.category] || 0) + 1 })
      return [
        r.ledger_no,
        r.record_type,
        r.project_name,
        r.building_location || '',
        r.specialty,
        r.proposed_by || '',
        r.estimated_cost_impact || 0,
        r.flow_status,
        r.receive_date,
        r.stamped ? '已盖章' : '未盖章',
        r.settled ? '已结算' : '未结算',
        missing.length > 0 ? missing.join('、') : '齐全',
        atts.length,
        Object.entries(catCount).map(([k, v]) => `${k}${v}`).join(' / ') || '无',
        r.last_operator || DEFAULT_OPERATOR,
        (r.completion_records || []).length
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    ws['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 10 },
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
      { wch: 20 }, { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 12 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '台账清单')

    const compHeader = ['台账编号', '材料名称', '补齐时间', '经办人', '备注']
    const compRows: any[][] = [compHeader]
    for (const r of records) {
      const comps = r.completion_records || []
      if (comps.length === 0) compRows.push([r.ledger_no, '(无补齐记录)', '', '', ''])
      else for (const c of comps) compRows.push([r.ledger_no, c.material_name, c.completed_at, c.operator, c.note || ''])
    }
    const ws3 = XLSX.utils.aoa_to_sheet(compRows)
    ws3['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws3, '补齐情况')

    const summarySheet = [
      ['台账汇总', ''],
      ['生成时间', dayjs().format('YYYY-MM-DD HH:mm:ss')],
      ['导出条数', records.length],
      ['未盖章', records.filter(r => !r.stamped).length],
      ['未结算', records.filter(r => !r.settled).length],
      ['有缺失材料', records.filter(r => getMissingMaterialsForRecord(r, attsBatch[r.id!] || []).length > 0).length],
      ['预计费用合计(元)', records.reduce((s, r) => s + (r.estimated_cost_impact || 0), 0)]
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(summarySheet)
    ws2['!cols'] = [{ wch: 18 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, ws2, '汇总统计')

    const finalPath = path.join(saveDir, defaultName)
    XLSX.writeFile(wb, finalPath)
    return finalPath
  } catch (e) {
    console.error('导出Excel失败:', e)
    return null
  }
}

export function exportUrgencyNotice(
  boardItems: any[],
  options: { format?: 'xlsx' | 'text'; proposed_by?: string; month?: string },
  saveDir?: string,
  saveName?: string
): string | false {
  try {
    let items = boardItems
    if (options.proposed_by) items = items.filter(i => i.proposed_by === options.proposed_by)
    if (options.month) items = items.filter(i => i.month === options.month)
    if (items.length === 0) return false

    const byUnit: Record<string, any[]> = {}
    for (const it of items) {
      if (!byUnit[it.proposed_by]) byUnit[it.proposed_by] = []
      byUnit[it.proposed_by].push(it)
    }

    if (options.format === 'text') {
      const lines: string[] = []
      lines.push(`【资料催办通知】`)
      lines.push(`生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}`)
      lines.push(``)
      for (const [unit, list] of Object.entries(byUnit)) {
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        lines.push(`致：${unit}`)
        const total = list.reduce((s: number, x: any) => s + x.total, 0)
        const stamp = list.reduce((s: number, x: any) => s + x.missing_stamp, 0)
        const settle = list.reduce((s: number, x: any) => s + x.missing_settlement, 0)
        const missAtt = list.reduce((s: number, x: any) => s + x.missing_attachments, 0)
        const matDetail: Record<string, number> = {}
        for (const x of list) {
          for (const [k, v] of Object.entries(x.missing_materials_detail || {})) {
            matDetail[k] = (matDetail[k] || 0) + (v as number)
          }
        }
        lines.push(``)
        lines.push(`本月涉及单据 ${total} 条，目前：`)
        if (stamp > 0) lines.push(`  · 未盖章：${stamp} 条`)
        if (settle > 0) lines.push(`  · 未结算：${settle} 条`)
        if (missAtt > 0) lines.push(`  · 缺附件：${missAtt} 条`)
        if (Object.keys(matDetail).length > 0) {
          lines.push(``)
          lines.push(`具体缺项：`)
          for (const [k, v] of Object.entries(matDetail)) {
            lines.push(`  · 缺 ${k}：${v} 单`)
          }
        }
        lines.push(``)
        lines.push(`请于本月底前补交所缺资料，谢谢配合！`)
        lines.push(``)
        for (const m of list) {
          lines.push(`  【${m.month}】涉及 ${m.total} 条`)
          for (const rec of m.records || []) {
            const miss = rec.missing_materials || []
            lines.push(`    - ${rec.ledger_no} ${rec.project_name} (${rec.specialty})${miss.length > 0 ? ` 缺:${miss.join('/')}` : ''}`)
          }
          lines.push(``)
        }
      }
      return lines.join('\n')
    }

    const rows: any[][] = [
      ['资料催办单', '', '', '', '', '', ''],
      ['生成时间', dayjs().format('YYYY-MM-DD HH:mm:ss'), '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['责任单位', '月份', '涉及单据数', '未盖章', '未结算', '缺附件数', '待补材料明细']
    ]
    const detailRows: any[][] = [
      ['单据明细', '', '', '', '', '', '', ''],
      ['责任单位', '月份', '台账编号', '工程名称', '楼栋部位', '专业', '流转状态', '缺失材料']
    ]
    for (const unit of Object.keys(byUnit)) {
      for (const m of byUnit[unit]) {
        const matList = Object.entries(m.missing_materials_detail || {})
          .map(([k, v]) => `${k}×${v}`).join('，')
        rows.push([
          unit, m.month, m.total, m.missing_stamp, m.missing_settlement,
          m.missing_attachments, matList || '无'
        ])
        for (const rec of m.records || []) {
          detailRows.push([
            unit, m.month, rec.ledger_no, rec.project_name,
            rec.building_location || '', rec.specialty, rec.flow_status,
            (rec.missing_materials || []).join('、') || '齐全'
          ])
        }
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 36 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '催办汇总')
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
    ws2['!cols'] = [
      { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
      { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 32 }
    ]
    XLSX.utils.book_append_sheet(wb, ws2, '单据明细')
    const finalName = saveName || `催办单_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`
    const finalPath = path.join(saveDir || getUserDataPath(), finalName)
    XLSX.writeFile(wb, finalPath)
    return finalPath
  } catch (e) {
    console.error('导出催办单失败:', e)
    return false
  }
}

export { }
