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
  created_at?: string
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

declare global {
  interface Window {
    electronAPI: {
      getUserDataPath: () => Promise<{ userDataPath: string; attachmentsPath: string }>
      generateLedgerNo: (recordType: string, projectName: string) => Promise<string>
      addRecord: (record: LedgerRecord) => Promise<number>
      updateRecord: (id: number, record: Partial<LedgerRecord>) => Promise<boolean>
      deleteRecord: (id: number) => Promise<boolean>
      getAllRecords: () => Promise<LedgerRecord[]>
      searchRecords: (filters: any) => Promise<LedgerRecord[]>
      getAttachments: (recordId: number) => Promise<Attachment[]>
      addAttachment: (attachment: Attachment) => Promise<number>
      deleteAttachmentFile: (id: number, filePath: string) => Promise<boolean>
      saveFileToDirectory: (sourcePath: string, recordNo: string, fileName: string) => Promise<string>
      selectFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
      openFolder: (folderPath: string) => Promise<boolean>
    }
  }
}

export { }
