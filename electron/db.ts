import * as fs from 'fs'
import * as path from 'path'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

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

export const ATTACHMENT_CATEGORIES = ['扫描件', '照片', '会议纪要', '结算资料', '其他'] as const

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

export function getRecordById(id: number): LedgerRecord | null {
  const data = loadData()
  return data.records.find(r => r.id === id) || null
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
    map[key].records.push({
      ...r,
      attachment_count: atts.length,
      missing_materials: missing
    })
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

export function generateHandoverPackage(recordId: number, targetDir: string): { path: string; manifest: any } | null {
  try {
    const data = loadData()
    const record = data.records.find(r => r.id === recordId)
    if (!record) return null

    const atts = data.attachments.filter(a => a.record_id === recordId)
    const missing = getMissingMaterialsForRecord(record, atts)

    const pkgDir = path.join(targetDir, `${record.ledger_no}_移交包_${dayjs().format('YYYYMMDD_HHmmss')}`)
    fs.mkdirSync(pkgDir, { recursive: true })

    for (const cat of ATTACHMENT_CATEGORIES) {
      fs.mkdirSync(path.join(pkgDir, cat), { recursive: true })
    }
    fs.mkdirSync(path.join(pkgDir, '待补材料'), { recursive: true })

    const copied: any[] = []
    for (const att of atts) {
      const catDir = ATTACHMENT_CATEGORIES.includes(att.category as any) ? att.category : '其他'
      const dest = path.join(pkgDir, catDir, att.file_name)
      try {
        if (fs.existsSync(att.file_path)) {
          fs.copyFileSync(att.file_path, dest)
          copied.push({ category: catDir, file_name: att.file_name, file_size: att.file_size })
        }
      } catch (e) {
        console.error('复制失败:', att.file_name, e)
      }
    }

    const missingInfo: any[] = missing.map(m => ({
      材料名称: m,
      说明: getMaterialDescription(m),
      状态: '待补充'
    }))

    const manifest = {
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
      '待补材料数': missing.length
    }

    const manifestSheet = [
      ['项目资料移交清单', ''],
      ...Object.entries(manifest).map(([k, v]) => [k, v as any]),
      ['', ''],
      ['--- 已归档附件明细 ---', ''],
      ['分类', '文件名', '大小(KB)'],
      ...copied.map(c => [c.category, c.file_name, (c.file_size / 1024).toFixed(1)])
    ]

    if (missing.length > 0) {
      manifestSheet.push(['', ''], ['--- 待补材料清单 ---', ''], ['材料名称', '说明', '状态'],
        ...missingInfo.map(m => [m['材料名称'], m['说明'], m['状态']]))
    }

    const ws = XLSX.utils.aoa_to_sheet(manifestSheet)
    ws['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '移交清单')
    const xlsxPath = path.join(pkgDir, `移交清单_${record.ledger_no}.xlsx`)
    XLSX.writeFile(wb, xlsxPath)

    const txtContent = [
      `项目资料移交清单`,
      `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`,
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
      `=== 已归档附件 (${atts.length}份) ===`,
      ...ATTACHMENT_CATEGORIES.map(cat => {
        const list = copied.filter(c => c.category === cat)
        if (list.length === 0) return `[${cat}] 无`
        return `[${cat}] ${list.length}份:\n  ` + list.map(c => `- ${c.file_name} (${(c.file_size / 1024).toFixed(1)}KB)`).join('\n  ')
      }).join('\n'),
      ``,
      `=== 待补材料 (${missing.length}项) ===`,
      missing.length === 0 ? '材料齐全，可移交' : missing.map(m => `! ${m} - ${getMaterialDescription(m)}`).join('\n')
    ].join('\n')

    fs.writeFileSync(path.join(pkgDir, '移交说明.txt'), txtContent, 'utf-8')

    return {
      path: pkgDir,
      manifest: {
        ...manifest,
        attachments_copied: copied.length,
        missing_materials: missing
      }
    }
  } catch (e) {
    console.error('生成移交包失败:', e)
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
      '缺失材料', '附件数量', '附件分类统计'
    ]

    const dataRows: any[][] = records.map(r => {
      const atts = attsBatch[r.id!] || []
      const missing = getMissingMaterialsForRecord(r, atts)
      const catCount: Record<string, number> = {}
      atts.forEach(a => {
        catCount[a.category] = (catCount[a.category] || 0) + 1
      })

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
        Object.entries(catCount).map(([k, v]) => `${k}${v}`).join(' / ') || '无'
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
    ws['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 10 },
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
      { wch: 20 }, { wch: 8 }, { wch: 24 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '台账清单')

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

export { }
