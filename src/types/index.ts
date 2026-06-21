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

export interface UrgencyNoticeItem {
  proposed_by: string
  month: string
  total_records: number
  missing_stamp_count: number
  missing_settlement_count: number
  missing_attachment_count: number
  missing_materials_detail: Record<string, number>
  records: Array<{
    id: number
    ledger_no: string
    project_name: string
    building_location: string
    specialty: string
    flow_status: string
    stamped: number
    settled: number
    missing_materials: string[]
  }>
}

export interface HandoverBatchOptions {
  groupBy: 'proposed_by' | 'month' | 'none'
  packageName?: string
}

export const RECORD_TYPES = ['设计变更', '工程洽商', '现场签证'] as const

export const SPECIALTIES = ['建筑', '结构', '给排水', '暖通', '电气', '弱电', '装饰', '市政', '其他'] as const

export const FLOW_STATUSES = [
  '待审核',
  '审核中',
  '已审核',
  '施工中',
  '已完工',
  '已盖章',
  '已结算',
  '已归档'
] as const

export const PROPOSED_BY_OPTIONS = [
  '建设单位',
  '设计单位',
  '监理单位',
  '施工单位',
  '勘察单位',
  '其他'
] as const

export const ATTACHMENT_CATEGORIES = ['扫描件', '照片', '会议纪要', '结算资料', '其他'] as const

export const CATEGORY_ICON_MAP: Record<string, string> = {
  '扫描件': 'file-pdf',
  '照片': 'file-image',
  '会议纪要': 'file-text',
  '结算资料': 'file-excel',
  '其他': 'file-unknown'
}

export const CATEGORY_COLOR_MAP: Record<string, string> = {
  '扫描件': '#ff4d4f',
  '照片': '#52c41a',
  '会议纪要': '#1890ff',
  '结算资料': '#faad14',
  '其他': '#8c8c8c'
}

export const REQUIRED_FIELDS_FOR_SAVE = [
  'record_type',
  'project_name',
  'building_location',
  'change_reason',
  'proposed_by',
  'specialty',
  'estimated_cost_impact',
  'flow_status',
  'receive_date'
] as const

export const FIELD_LABELS: Record<string, string> = {
  record_type: '单据类型',
  project_name: '工程名称',
  building_location: '楼栋部位',
  change_reason: '变更原因',
  proposed_by: '提出单位',
  specialty: '涉及专业',
  estimated_cost_impact: '预计费用影响',
  flow_status: '流转状态',
  receive_date: '收文日期'
}

export const MATERIAL_CATEGORIES = [
  { key: '盖章件', requiresAttachment: '扫描件', description: '盖章扫描件' },
  { key: '结算单', requiresAttachment: '结算资料', description: '结算资料' },
  { key: '变更说明', requiresAttachment: '扫描件', description: '变更说明扫描件' },
  { key: '会议纪要', requiresAttachment: '会议纪要', description: '会议纪要文件' },
  { key: '现场照片', requiresAttachment: '照片', description: '现场实况照片' }
] as const

export const DEFAULT_OPERATOR = '资料员'

declare global {
  interface Window {
    electronAPI: {
      getUserDataPath: () => Promise<{ userDataPath: string; attachmentsPath: string }>
      generateLedgerNo: (recordType: string, projectName: string) => Promise<string>
      addRecord: (record: LedgerRecord, operator?: string) => Promise<{ id: number; record: LedgerRecord }>
      updateRecord: (id: number, record: Partial<LedgerRecord>, operator?: string) => Promise<boolean>
      deleteRecord: (id: number) => Promise<boolean>
      getAllRecords: () => Promise<LedgerRecord[]>
      searchRecords: (filters: any) => Promise<LedgerRecord[]>
      getAttachments: (recordId: number) => Promise<Attachment[]>
      addAttachment: (attachment: Attachment) => Promise<number>
      deleteAttachmentFile: (id: number, operator?: string) => Promise<boolean>
      saveAndRegisterFile: (sourcePath: string, recordNo: string, recordId: number, category: string, operator?: string) => Promise<Attachment | null>
      saveFileToDirectory: (sourcePath: string, recordNo: string, fileName: string) => Promise<string>
      selectFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
      openFolder: (folderPath: string) => Promise<boolean>
      getMonthlySummary: () => Promise<any[]>
      getAttachmentCounts: () => Promise<Record<number, number>>
      getUrgencyBoard: () => Promise<any[]>
      exportExcel: (records: LedgerRecord[]) => Promise<string | false>
      generateHandoverPackage: (recordId: number, operator?: string) => Promise<false | { path: string; manifest: any }>
      generateBatchHandoverPackage: (recordIds: number[], options: HandoverBatchOptions, operator?: string) => Promise<false | { path: string; manifest: any }>
      exportUrgencyNotice: (boardItems: any[], options?: { format?: 'xlsx' | 'text'; proposed_by?: string; month?: string }) => Promise<string | false>
      confirmMaterialCompletion: (recordId: number, materials: string[], operator: string, note?: string) => Promise<boolean>
      getOperator: () => Promise<string>
      setOperator: (name: string) => Promise<boolean>
    }
  }
}

export function getMissingMaterials(record: LedgerRecord, attachments: Attachment[] = []): string[] {
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

export { }
