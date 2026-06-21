import React, { useState, useEffect, useRef } from 'react'
import {
  Select,
  Card,
  Button,
  List,
  Tag,
  message,
  Empty,
  Space,
  Row,
  Col,
  Descriptions,
  Divider,
  Popconfirm,
  Tooltip,
  Badge,
  Collapse,
  Modal,
  Input,
  Checkbox,
  Radio,
  Typography
} from 'antd'
import {
  InboxOutlined,
  FileOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  UploadOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FileUnknownOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  PaperClipOutlined,
  UserOutlined,
  FileDoneOutlined,
  SolutionOutlined,
  FormOutlined
} from '@ant-design/icons'
import {
  LedgerRecord, Attachment, ATTACHMENT_CATEGORIES, CATEGORY_COLOR_MAP,
  getMissingMaterials, DEFAULT_OPERATOR, HandoverBatchOptions
} from '../types'

const { Option } = Select
const { Paragraph } = Typography

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case '扫描件': return <FilePdfOutlined style={{ color: CATEGORY_COLOR_MAP['扫描件'] }} />
    case '照片': return <FileImageOutlined style={{ color: CATEGORY_COLOR_MAP['照片'] }} />
    case '会议纪要': return <FileTextOutlined style={{ color: CATEGORY_COLOR_MAP['会议纪要'] }} />
    case '结算资料': return <FileExcelOutlined style={{ color: CATEGORY_COLOR_MAP['结算资料'] }} />
    default: return <FileUnknownOutlined style={{ color: CATEGORY_COLOR_MAP['其他'] }} />
  }
}

const AttachmentPage: React.FC = () => {
  const [records, setRecords] = useState<LedgerRecord[]>([])
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<LedgerRecord | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<string>('扫描件')
  const [userDataPath, setUserDataPath] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)
  const [operator, setOperatorState] = useState<string>(DEFAULT_OPERATOR)
  const [operatorModal, setOperatorModal] = useState(false)
  const [operatorInput, setOperatorInput] = useState('')

  const [batchMode, setBatchMode] = useState(false)
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set())
  const [batchModal, setBatchModal] = useState(false)
  const [batchGroupBy, setBatchGroupBy] = useState<'proposed_by' | 'month' | 'none'>('proposed_by')
  const [batchGenerating, setBatchGenerating] = useState(false)

  const [completionModal, setCompletionModal] = useState(false)
  const [completionMaterials, setCompletionMaterials] = useState<string[]>([])
  const [completionNote, setCompletionNote] = useState('')
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    loadRecords()
    loadPaths()
    loadOperator()
  }, [])

  useEffect(() => {
    const sid = sessionStorage.getItem('selectedRecordId')
    if (sid) {
      sessionStorage.removeItem('selectedRecordId')
      const id = Number(sid)
      const doSelect = () => {
        const rec = records.find(r => r.id === id)
        if (rec) {
          handleSelectRecord(id)
          message.success(`已定位到 ${rec.ledger_no}，可直接上传附件或补齐材料`)
        } else if (records.length === 0) {
          setTimeout(doSelect, 300)
        }
      }
      doSelect()
    }
  }, [records])

  const loadOperator = async () => {
    try {
      const op = await window.electronAPI.getOperator()
      setOperatorState(op || DEFAULT_OPERATOR)
    } catch (e) {
      console.error(e)
    }
  }

  const saveOperator = async () => {
    if (!operatorInput.trim()) {
      message.warning('请输入经办人姓名')
      return
    }
    try {
      await window.electronAPI.setOperator(operatorInput.trim())
      setOperatorState(operatorInput.trim())
      setOperatorModal(false)
      message.success(`经办人已设置为：${operatorInput.trim()}`)
    } catch (e) {
      message.error('保存失败')
    }
  }

  const loadPaths = async () => {
    try {
      const paths = await window.electronAPI.getUserDataPath()
      setUserDataPath(paths.userDataPath)
    } catch (e) {
      console.error(e)
    }
  }

  const loadRecords = async () => {
    try {
      const data = await window.electronAPI.getAllRecords()
      setRecords(data)
    } catch (error) {
      console.error('加载台账失败:', error)
    }
  }

  const loadAttachments = async (recordId: number) => {
    try {
      const data = await window.electronAPI.getAttachments(recordId)
      setAttachments(data)
    } catch (error) {
      console.error('加载附件失败:', error)
    }
  }

  const handleSelectRecord = (id: number) => {
    setSelectedRecordId(id)
    const record = records.find(r => r.id === id) || null
    setSelectedRecord(record)
    loadAttachments(id)
  }

  const handleFileSelect = async () => {
    if (!selectedRecordId || !selectedRecord) {
      message.warning('请先选择一条台账记录')
      return
    }
    const result = await window.electronAPI.selectFileDialog()
    if (!result.canceled && result.filePaths.length > 0) {
      await processFiles(result.filePaths)
    }
  }

  const processFiles = async (filePaths: string[]) => {
    if (!selectedRecord || !selectedRecordId) return
    setUploading(true)
    let successCount = 0
    let failCount = 0

    for (const filePath of filePaths) {
      try {
        const result = await window.electronAPI.saveAndRegisterFile(
          filePath,
          selectedRecord.ledger_no,
          selectedRecordId,
          uploadCategory,
          operator
        )
        if (result) successCount++
        else failCount++
      } catch (error) {
        console.error('保存文件失败:', error)
        failCount++
      }
    }

    setUploading(false)
    if (successCount > 0) {
      message.success(`成功归档 ${successCount} 个文件到「${uploadCategory}」`)
      await loadAttachments(selectedRecordId)
      await loadRecords()
      const rec = records.find(r => r.id === selectedRecordId)
      if (rec) setSelectedRecord({ ...rec })
    }
    if (failCount > 0) {
      message.error(`${failCount} 个文件归档失败`)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!selectedRecordId || !selectedRecord) {
      message.warning('请先选择一条台账记录')
      return
    }
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    const paths = files.map(f => (f as any).path).filter(Boolean)
    if (paths.length > 0) {
      processFiles(paths)
    } else {
      message.warning('请从文件资源管理器拖入文件')
    }
  }

  const handleDeleteAttachment = async (att: Attachment) => {
    try {
      await window.electronAPI.deleteAttachmentFile(att.id!, operator)
      message.success('已删除附件')
      await loadAttachments(selectedRecordId!)
      await loadRecords()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleOpenFolder = async () => {
    if (!selectedRecord) {
      message.warning('请先选择一条台账记录')
      return
    }
    try {
      const folderPath = `${userDataPath}/attachments/${selectedRecord.ledger_no}`
      await window.electronAPI.openFolder(folderPath)
    } catch (error) {
      message.error('打开文件夹失败')
    }
  }

  const handleOpenAttachmentDir = async (att: Attachment) => {
    try {
      const parts = att.file_path.split(/[/\\]/)
      parts.pop()
      const dir = parts.join('/')
      await window.electronAPI.openFolder(dir)
    } catch (error) {
      message.error('打开目录失败')
    }
  }

  const [generatingPkg, setGeneratingPkg] = useState(false)
  const handleGenerateHandoverPackage = async () => {
    if (!selectedRecordId || !selectedRecord) {
      message.warning('请先选择一条台账记录')
      return
    }
    try {
      setGeneratingPkg(true)
      message.loading({ content: `正在生成 ${selectedRecord.ledger_no} 移交包...`, key: 'hpkg' })
      const result = await window.electronAPI.generateHandoverPackage(selectedRecordId, operator)
      message.destroy('hpkg')
      if (result) {
        message.success(`移交包已生成：${(result as any).path}`)
        await loadRecords()
      }
    } catch (e) {
      message.destroy('hpkg')
      console.error(e)
      message.error('生成移交包失败')
    } finally {
      setGeneratingPkg(false)
    }
  }

  const groupedAttachments = () => {
    const groups: Record<string, Attachment[]> = {}
    ATTACHMENT_CATEGORIES.forEach(cat => { groups[cat] = [] })
    attachments.forEach(att => {
      const cat = ATTACHMENT_CATEGORIES.includes(att.category as any) ? att.category : '其他'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(att)
    })
    return groups
  }

  const missingMaterials = selectedRecord ? getMissingMaterials(selectedRecord, attachments) : []
  const previousMissingRef = useRef<string[]>([])
  const existingCompletions = (selectedRecord?.completion_records || []).map(c => c.material_name)
  const newCompletions = missingMaterials.length === 0 && previousMissingRef.current.length > 0
    ? previousMissingRef.current.filter(m => !existingCompletions.includes(m))
    : []

  useEffect(() => {
    if (selectedRecord && newCompletions.length > 0 && !completionModal) {
      setCompletionMaterials(newCompletions)
      setCompletionNote('')
      setCompletionModal(true)
    }
    previousMissingRef.current = missingMaterials
  }, [missingMaterials.length, selectedRecord?.id])

  const handleConfirmCompletion = async () => {
    if (!selectedRecordId || completionMaterials.length === 0) return
    try {
      setCompleting(true)
      const ok = await window.electronAPI.confirmMaterialCompletion(
        selectedRecordId, completionMaterials, operator, completionNote || undefined
      )
      if (ok) {
        message.success(`已确认 ${completionMaterials.length} 项材料补齐`)
        setCompletionModal(false)
        await loadRecords()
        const rec = records.find(r => r.id === selectedRecordId)
        if (rec) setSelectedRecord({ ...rec })
      }
    } catch (e) {
      console.error(e)
      message.error('确认失败')
    } finally {
      setCompleting(false)
    }
  }

  const handleBatchToggle = (id: number) => {
    const next = new Set(batchSelected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setBatchSelected(next)
  }

  const handleBatchSelectAll = () => {
    if (batchSelected.size === records.length) setBatchSelected(new Set())
    else setBatchSelected(new Set(records.map(r => r.id!)))
  }

  const handleGenerateBatch = async () => {
    if (batchSelected.size === 0) {
      message.warning('请至少勾选一条台账')
      return
    }
    try {
      setBatchGenerating(true)
      message.loading({ content: `正在生成 ${batchSelected.size} 条台账的批量移交包...`, key: 'batchpkg' })
      const options: HandoverBatchOptions = { groupBy: batchGroupBy }
      const result = await window.electronAPI.generateBatchHandoverPackage(
        Array.from(batchSelected), options, operator
      )
      message.destroy('batchpkg')
      if (result) {
        message.success(`批量移交包已生成`)
        setBatchModal(false)
        setBatchSelected(new Set())
        setBatchMode(false)
        await loadRecords()
      }
    } catch (e) {
      message.destroy('batchpkg')
      console.error(e)
      message.error('生成批量移交包失败')
    } finally {
      setBatchGenerating(false)
    }
  }

  const completedMaterials = (() => {
    const all = ['盖章件', '结算单', '变更说明', '会议纪要', '现场照片']
    return all.filter(m => !missingMaterials.includes(m))
  })()

  return (
    <div className="page-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>附件归档</h2>
        <Space>
          <Tooltip title={`当前经办人：${operator}，所有上传/补齐/移交操作将记录此经办人`}>
            <Button icon={<UserOutlined />} onClick={() => { setOperatorInput(operator); setOperatorModal(true) }}>
              经办人：{operator}
            </Button>
          </Tooltip>
          <Tooltip title="勾选多条台账后批量生成移交包">
            <Button
              type={batchMode ? 'primary' : 'default'}
              icon={<FileDoneOutlined />}
              onClick={() => { setBatchMode(!batchMode); if (batchMode) setBatchSelected(new Set()) }}
            >
              {batchMode ? '取消批量' : `批量移交包${batchSelected.size > 0 ? ` (${batchSelected.size})` : ''}`}
            </Button>
          </Tooltip>
          {batchMode && (
            <Button
              type="primary"
              icon={<ExportOutlined />}
              disabled={batchSelected.size === 0}
              onClick={() => setBatchModal(true)}
            >
              生成批量移交包
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={20} style={{ height: 'calc(100vh - 260px)' }}>
        <Col span={batchMode ? 10 : 8} style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Card
            title={
              batchMode
                ? <Space><SolutionOutlined />批量选择（{batchSelected.size}/{records.length}）
                  <Button size="small" onClick={handleBatchSelectAll}>
                    {batchSelected.size === records.length ? '取消全选' : '全选'}
                  </Button>
                </Space>
                : "选择台账记录"
            }
            size="small"
            style={{ marginBottom: 12 }}
            bodyStyle={{ padding: 12 }}
          >
            {!batchMode ? (
              <Select
                showSearch
                placeholder="搜索并选择台账..."
                style={{ width: '100%' }}
                value={selectedRecordId || undefined}
                optionFilterProp="children"
                onChange={(value) => handleSelectRecord(value)}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              >
                {records.map(r => (
                  <Option
                    key={r.id}
                    value={r.id}
                    label={`${r.ledger_no} - ${r.project_name}`}
                  >
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'Consolas, monospace', color: '#0958d9', fontWeight: 600 }}>
                          {r.ledger_no}
                        </span>
                        <Space>
                          <Tag color={r.record_type === '设计变更' ? 'blue' : r.record_type === '工程洽商' ? 'green' : 'orange'}>
                            {r.record_type}
                          </Tag>
                          {getMissingMaterials(r, attachments).length === 0 && (r.completion_records || []).length >= 5
                            ? <Tag color="success" icon={<CheckCircleOutlined />}>材料齐</Tag>
                            : null}
                        </Space>
                      </div>
                      <div style={{ color: '#595959', fontSize: 12 }}>
                        {r.project_name} {r.building_location ? `· ${r.building_location}` : ''}
                      </div>
                    </Space>
                  </Option>
                ))}
              </Select>
            ) : (
              <div style={{ maxHeight: 520, overflow: 'auto' }}>
                {records.length === 0
                  ? <Empty description="暂无台账" />
                  : records.map(r => (
                    <div
                      key={r.id}
                      onClick={() => handleBatchToggle(r.id!)}
                      style={{
                        padding: '8px 10px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                        background: batchSelected.has(r.id!) ? '#e6f4ff' : undefined,
                        borderRadius: 4
                      }}
                    >
                      <Row align="middle" gutter={8}>
                        <Col>
                          <Checkbox checked={batchSelected.has(r.id!)} />
                        </Col>
                        <Col flex="auto">
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontFamily: 'Consolas, monospace', color: '#0958d9', fontWeight: 600 }}>
                                {r.ledger_no}
                              </span>
                              <Tag color={r.record_type === '设计变更' ? 'blue' : r.record_type === '工程洽商' ? 'green' : 'orange'}>
                                {r.record_type}
                              </Tag>
                            </div>
                            <div style={{ color: '#595959', fontSize: 12 }}>
                              {r.project_name} · {r.proposed_by} · {r.receive_date?.substring(0, 7)}
                            </div>
                          </Space>
                        </Col>
                      </Row>
                    </div>
                  ))
                }
              </div>
            )}
          </Card>

          <div
            ref={dropRef}
            className={`drop-zone ${isDragging ? 'dragover' : ''}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: selectedRecord ? undefined : '#f5f5f5'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={selectedRecord && !batchMode ? handleFileSelect : undefined}
          >
            {!selectedRecord || batchMode ? (
              <>
                <div className="drop-zone-icon" style={{ color: '#d9d9d9' }}>
                  <InboxOutlined />
                </div>
                <p style={{ color: '#8c8c8c', margin: 0 }}>
                  {batchMode ? '批量模式下请在列表中勾选后点击上方按钮' : '请先在上方选择一条台账记录'}
                </p>
                <p style={{ color: '#bfbfbf', fontSize: 12, marginTop: 4 }}>选中后即可拖入或点击上传附件</p>
              </>
            ) : (
              <>
                <div className="drop-zone-icon" style={{ color: isDragging ? '#1677ff' : '#bfbfbf' }}>
                  <InboxOutlined />
                </div>
                <p style={{ fontWeight: 500, margin: 0 }}>
                  {isDragging ? '释放文件即可归档' : '将文件拖入此处或点击选择'}
                </p>
                <p style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                  当前归类：<Tag color="blue">{uploadCategory}</Tag>
                  <span style={{ marginLeft: 8 }}>经办人：{operator}</span>
                </p>
                <div style={{ marginTop: 8, width: '80%' }}>
                  <Select
                    size="small"
                    value={uploadCategory}
                    onChange={setUploadCategory}
                    style={{ width: '100%' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ATTACHMENT_CATEGORIES.map(cat => (
                      <Option key={cat} value={cat}>
                        <Space>
                          {getCategoryIcon(cat)}
                          {cat}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  style={{ marginTop: 12 }}
                  loading={uploading}
                  onClick={(e) => { e.stopPropagation(); handleFileSelect() }}
                >
                  选择文件
                </Button>
              </>
            )}
          </div>
        </Col>

        <Col span={batchMode ? 14 : 16} style={{ height: '100%', overflow: 'auto' }}>
          {selectedRecord ? (
            <>
              <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Descriptions column={4} size="small">
                    <Descriptions.Item label="台账编号">
                      <span className="ledger-no-display">{selectedRecord.ledger_no}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="工程名称">{selectedRecord.project_name}</Descriptions.Item>
                    <Descriptions.Item label="专业/类型">
                      {selectedRecord.specialty} / {selectedRecord.record_type}
                    </Descriptions.Item>
                    <Descriptions.Item label="最近操作">
                      {selectedRecord.updated_at} · {selectedRecord.last_operator || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                  <Space>
                    <Button icon={<FolderOpenOutlined />} onClick={handleOpenFolder}>
                      打开归档文件夹
                    </Button>
                    <Tooltip
                      title={
                        missingMaterials.length > 0
                          ? `还有 ${missingMaterials.length} 项材料未补，清单中会一并列出`
                          : '材料齐全，清单中无需补项'
                      }
                    >
                      <Button
                        type="primary"
                        icon={<ExportOutlined />}
                        onClick={handleGenerateHandoverPackage}
                        loading={generatingPkg}
                      >
                        生成移交包
                      </Button>
                    </Tooltip>
                  </Space>
                </div>
              </Card>

              <Card
                title={
                  <Space>
                    <CheckCircleOutlined />
                    <span>材料齐备情况</span>
                    <Button
                      size="small"
                      type="link"
                      icon={<FormOutlined />}
                      onClick={() => {
                        const already = (selectedRecord.completion_records || []).map(c => c.material_name)
                        const available = ['盖章件', '结算单', '变更说明', '会议纪要', '现场照片'].filter(m => !already.includes(m))
                        setCompletionMaterials(available.length > 0 ? available : ['盖章件'])
                        setCompletionNote('')
                        setCompletionModal(true)
                      }}
                    >
                      手动登记补齐
                    </Button>
                  </Space>
                }
                size="small"
                style={{ marginBottom: 12 }}
                bodyStyle={{ padding: 12 }}
              >
                <Row gutter={8}>
                  {['盖章件', '结算单', '变更说明', '会议纪要', '现场照片'].map(mat => {
                    const isMissing = missingMaterials.includes(mat)
                    const comp = (selectedRecord.completion_records || []).find(c => c.material_name === mat)
                    return (
                      <Col key={mat}>
                        <Tooltip
                          title={comp
                            ? `${comp.operator} 于 ${comp.completed_at} 确认补齐${comp.note ? `（${comp.note}）` : ''}`
                            : undefined
                          }
                        >
                          <Tag
                            icon={isMissing ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
                            color={isMissing ? 'error' : 'success'}
                            style={{ fontSize: 13, padding: '4px 12px' }}
                          >
                            {mat}{comp ? ` ✓${comp.operator}` : ''}
                          </Tag>
                        </Tooltip>
                      </Col>
                    )
                  })}
                </Row>
                {(selectedRecord.completion_records || []).length > 0 && (
                  <div style={{ marginTop: 10, padding: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>已确认补齐记录：</div>
                    {(selectedRecord.completion_records || []).map((c, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#389e0d' }}>
                        · {c.material_name}：{c.completed_at} 经办人 <b>{c.operator}</b>
                        {c.note ? `（${c.note}）` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {missingMaterials.length === 0 && (selectedRecord.completion_records || []).length > 0 && (
                  <div style={{ marginTop: 8, color: '#52c41a', fontWeight: 500 }}>
                    所有材料齐全，可进行竣工资料移交
                  </div>
                )}
              </Card>

              <Card
                title={
                  <Space>
                    <FileOutlined />
                    <span>附件列表</span>
                    <Tag color="blue">{attachments.length} 个文件</Tag>
                    {attachments.length > 0 && (
                      <Tag color="green">
                        共 {formatFileSize(attachments.reduce((sum, a) => sum + a.file_size, 0))}
                      </Tag>
                    )}
                  </Space>
                }
                size="small"
                style={{ flex: 1 }}
                bodyStyle={{ padding: 12 }}
              >
                {attachments.length === 0 ? (
                  <Empty
                    description={
                      <span>
                        暂无附件，<br />将扫描件、照片、会议纪要拖入左侧区域
                      </span>
                    }
                  />
                ) : (
                  <Collapse
                    defaultActiveKey={ATTACHMENT_CATEGORIES.filter(cat =>
                      groupedAttachments()[cat] && groupedAttachments()[cat].length > 0
                    )}
                    ghost
                  >
                    {ATTACHMENT_CATEGORIES.map(cat => {
                      const items = groupedAttachments()[cat] || []
                      return (
                        <Collapse.Panel
                          key={cat}
                          header={
                            <Space>
                              {getCategoryIcon(cat)}
                              <span style={{ fontWeight: 500 }}>{cat}</span>
                              <Badge count={items.length} style={{ backgroundColor: CATEGORY_COLOR_MAP[cat] || '#8c8c8c' }} />
                            </Space>
                          }
                        >
                          {items.length === 0 ? (
                            <div style={{ color: '#bfbfbf', padding: '8px 0', fontSize: 13 }}>
                              暂无{cat}类附件
                            </div>
                          ) : (
                            <List
                              size="small"
                              dataSource={items}
                              renderItem={(item) => (
                                <List.Item
                                  key={item.id}
                                  actions={[
                                    <Tooltip key="dir" title="打开所在目录">
                                      <Button
                                        type="link"
                                        size="small"
                                        icon={<FolderOpenOutlined />}
                                        onClick={() => handleOpenAttachmentDir(item)}
                                      />
                                    </Tooltip>,
                                    <Popconfirm
                                      key="del"
                                      title="确定删除此附件吗？"
                                      onConfirm={() => handleDeleteAttachment(item)}
                                      okText="确定"
                                      cancelText="取消"
                                    >
                                      <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                  ]}
                                >
                                  <List.Item.Meta
                                    avatar={
                                      <span style={{ fontSize: 24 }}>
                                        {getCategoryIcon(item.category)}
                                      </span>
                                    }
                                    title={
                                      <span>
                                        {item.file_name}
                                        <Tag style={{ marginLeft: 8 }}>{item.file_type?.toUpperCase() || 'FILE'}</Tag>
                                      </span>
                                    }
                                    description={
                                      <Space size={4}>
                                        <span style={{ color: '#8c8c8c' }}>{formatFileSize(item.file_size)}</span>
                                        <span style={{ color: '#bfbfbf' }}>·</span>
                                        <span style={{ color: '#8c8c8c' }}>{item.created_at}</span>
                                        <span style={{ color: '#bfbfbf' }}>·</span>
                                        <span style={{ color: '#52c41a' }}>
                                          <UserOutlined /> {item.uploaded_by || '-'}
                                        </span>
                                      </Space>
                                    }
                                  />
                                </List.Item>
                              )}
                            />
                          )}
                        </Collapse.Panel>
                      )
                    })}
                  </Collapse>
                )}
              </Card>
            </>
          ) : (
            <Card
              style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Empty description={batchMode ? '请在左侧勾选需要批量打包的台账' : '请在左侧选择台账记录以查看和管理附件'} />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="设置经办人"
        open={operatorModal}
        onOk={saveOperator}
        onCancel={() => setOperatorModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <Input
          prefix={<UserOutlined />}
          placeholder="请输入经办人姓名"
          value={operatorInput}
          onChange={(e) => setOperatorInput(e.target.value)}
          onPressEnter={saveOperator}
        />
        <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
          所有上传附件、补齐材料、生成移交包操作均会记录此经办人
        </div>
      </Modal>

      <Modal
        title="补齐材料确认"
        open={completionModal}
        onOk={handleConfirmCompletion}
        onCancel={() => setCompletionModal(false)}
        confirmLoading={completing}
        okText="确认补齐"
        cancelText="稍后再说"
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>本次确认补齐以下材料（经办人：{operator}）：</div>
          <Checkbox.Group
            value={completionMaterials}
            onChange={(v) => setCompletionMaterials(v as string[])}
            options={['盖章件', '结算单', '变更说明', '会议纪要', '现场照片'].map(m => ({ label: m, value: m }))}
          />
        </div>
        <div style={{ marginBottom: 6, fontWeight: 500 }}>备注（可选）：</div>
        <Input.TextArea
          rows={3}
          value={completionNote}
          onChange={(e) => setCompletionNote(e.target.value)}
          placeholder="例如：资料从监理方取回、三方已签字等"
        />
      </Modal>

      <Modal
        title={`批量生成移交包（已选 ${batchSelected.size} 条）`}
        open={batchModal}
        onOk={handleGenerateBatch}
        onCancel={() => setBatchModal(false)}
        confirmLoading={batchGenerating}
        okText="开始生成"
        cancelText="取消"
        width={480}
      >
        <div style={{ marginBottom: 12, fontWeight: 500 }}>选择分组方式：</div>
        <Radio.Group
          value={batchGroupBy}
          onChange={(e) => setBatchGroupBy(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical">
            <Radio value="proposed_by">按责任单位分组（适合同一类单位的资料一起交）</Radio>
            <Radio value="month">按收文月份分组（适合按月份归档移交）</Radio>
            <Radio value="none">不分组（所有单据放一个目录）</Radio>
          </Space>
        </Radio.Group>
        <Divider style={{ margin: '16px 0' }} />
        <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
          · 生成后将自动打开目标文件夹<br />
          · 每个单据目录内包含分类附件 + 移交清单.xlsx + 移交说明.txt<br />
          · 根目录下包含总移交清单.xlsx（含所有单据和补齐情况）+ README.txt<br />
          · 经办人：<b style={{ color: '#1677ff' }}>{operator}</b>
        </Paragraph>
      </Modal>
    </div>
  )
}

export default AttachmentPage
