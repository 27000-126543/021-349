import React, { useState, useEffect, useMemo } from 'react'
import {
  Table,
  Button,
  Select,
  DatePicker,
  Input,
  Row,
  Col,
  Checkbox,
  Space,
  Card,
  Tag,
  Modal,
  Descriptions,
  message,
  Popconfirm,
  Badge,
  Divider,
  Empty,
  Tabs,
  Statistic,
  Tooltip,
  Collapse,
  Radio,
  Timeline as AntdTimeline,
  Typography
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PaperClipOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  FileExcelOutlined,
  FileOutlined,
  CopyOutlined,
  UserOutlined,
  FormOutlined,
  UploadOutlined,
  FileDoneOutlined,
  SolutionOutlined,
  EditOutlined,
  SendOutlined,
  CheckSquareOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  LedgerRecord, Attachment, RECORD_TYPES, SPECIALTIES, FLOW_STATUSES, PROPOSED_BY_OPTIONS,
  getMissingMaterials, ATTACHMENT_CATEGORIES, CATEGORY_COLOR_MAP, DEFAULT_OPERATOR, TimelineEvent
} from '../types'

const { RangePicker } = DatePicker
const { Option } = Select
const { Panel } = Collapse
const { Text } = Typography

const flowStatusOrder = ['待审核', '审核中', '已审核', '施工中', '已完工', '已盖章', '已结算', '已归档']

const getTimelineIcon = (type: string) => {
  switch (type) {
    case 'register': return <FileTextOutlined style={{ color: '#1677ff' }} />
    case 'edit': return <EditOutlined style={{ color: '#1677ff' }} />
    case 'upload_attachment': return <UploadOutlined style={{ color: '#52c41a' }} />
    case 'delete_attachment': return <DeleteOutlined style={{ color: '#cf1322' }} />
    case 'status_change': return <ClockCircleOutlined style={{ color: '#1677ff' }} />
    case 'stamped_change': return <FileDoneOutlined style={{ color: '#eb2f96' }} />
    case 'settled_change': return <FileExcelOutlined style={{ color: '#722ed1' }} />
    case 'generate_handover': return <FileExcelOutlined style={{ color: '#52c41a' }} />
    case 'complete_material': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'handover_receipt': return <SolutionOutlined style={{ color: '#52c41a' }} />
    case 'urgency_status': return <SendOutlined style={{ color: '#fa8c16' }} />
    case 'attachment_version': return <FileDoneOutlined style={{ color: '#722ed1' }} />
    default: return <FileOutlined style={{ color: '#8c8c8c' }} />
  }
}

const getTimelineColor = (type: string) => {
  switch (type) {
    case 'register': return 'blue'
    case 'upload_attachment': return 'green'
    case 'delete_attachment': return 'red'
    case 'stamped_change': return 'magenta'
    case 'settled_change': return 'purple'
    case 'generate_handover': return 'green'
    case 'complete_material': return 'green'
    case 'handover_receipt': return 'green'
    case 'urgency_status': return 'orange'
    case 'attachment_version': return 'purple'
    default: return 'blue'
  }
}

const getTimelineLabel = (type: string) => {
  const map: Record<string, string> = {
    register: '登记台账',
    edit: '编辑',
    upload_attachment: '上传附件',
    delete_attachment: '删除附件',
    status_change: '状态变更',
    stamped_change: '盖章状态',
    settled_change: '结算状态',
    generate_handover: '生成移交包',
    complete_material: '材料补齐确认',
    handover_receipt: '移交签收',
    urgency_status: '催办状态',
    attachment_version: '附件版本更新'
  }
  return map[type] || type
}

const QueryPage: React.FC = () => {
  const [records, setRecords] = useState<LedgerRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [detailModal, setDetailModal] = useState<LedgerRecord | null>(null)
  const [detailAttachments, setDetailAttachments] = useState<Attachment[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [attachmentsByRecord, setAttachmentsByRecord] = useState<Record<number, Attachment[]>>({})
  const [filters, setFilters] = useState({
    specialty: '',
    record_type: '',
    proposed_by: '',
    not_stamped: false,
    not_settled: false,
    keyword: ''
  })
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [monthRecords, setMonthRecords] = useState<any[]>([])
  const [urgencyData, setUrgencyData] = useState<any[]>([])
  const [selectedUrgency, setSelectedUrgency] = useState<{ proposed_by: string; month: string } | null>(null)
  const [urgencyRecords, setUrgencyRecords] = useState<any[]>([])
  const [operator, setOperatorState] = useState<string>(DEFAULT_OPERATOR)
  const [operatorModal, setOperatorModal] = useState(false)
  const [operatorInput, setOperatorInput] = useState('')

  const [urgencyExportModal, setUrgencyExportModal] = useState(false)
  const [urgencyExportUnit, setUrgencyExportUnit] = useState<string>('')
  const [urgencyExportMonth, setUrgencyExportMonth] = useState<string>('')

  const [urgencyReceiptModal, setUrgencyReceiptModal] = useState(false)
  const [urgencyReceiptStatus, setUrgencyReceiptStatus] = useState<string>('sent')
  const [urgencyReceiptNote, setUrgencyReceiptNote] = useState('')
  const [urgencyReceiptRecordIds, setUrgencyReceiptRecordIds] = useState<number[]>([])
  const [urgencyReceiptTitle, setUrgencyReceiptTitle] = useState('')
  const [updatingReceipt, setUpdatingReceipt] = useState(false)

  const loadRecords = async () => {
    setLoading(true)
    try {
      const searchParams: any = { ...filters }
      if (dateRange && dateRange[0] && dateRange[1]) {
        searchParams.start_date = dateRange[0].format('YYYY-MM-DD')
        searchParams.end_date = dateRange[1].format('YYYY-MM-DD')
      }
      const data = await window.electronAPI.searchRecords(searchParams)
      setRecords(data)
      const atb: Record<number, Attachment[]> = {}
      for (const r of data) {
        const atts = await window.electronAPI.getAttachments(r.id!)
        atb[r.id!] = atts
      }
      setAttachmentsByRecord(atb)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMonthlySummary = async () => {
    try {
      const data = await window.electronAPI.getMonthlySummary()
      setMonthlySummary(data)
    } catch (error) {
      console.error('加载月度汇总失败:', error)
    }
  }

  const loadUrgencyBoard = async () => {
    try {
      const data = await window.electronAPI.getUrgencyBoard()
      setUrgencyData(data)
    } catch (error) {
      console.error('加载催办看板失败:', error)
    }
  }

  const loadOperator = async () => {
    try {
      const op = await window.electronAPI.getOperator()
      setOperatorState(op || DEFAULT_OPERATOR)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadOperator()
  }, [])

  useEffect(() => {
    loadRecords()
    loadMonthlySummary()
    loadUrgencyBoard()
  }, [])

  useEffect(() => {
    const fid = localStorage.getItem('queryFocusRecordId')
    if (!fid) return
    const id = Number(fid)
    if (records.length > 0) {
      const r = records.find(x => x.id === id)
      if (r) {
        handleViewDetail(r)
        localStorage.removeItem('queryFocusRecordId')
        message.success(`已定位到 ${r.ledger_no} 的详情`)
        return
      }
    }
  }, [records])

  const handleSearch = () => {
    loadRecords()
  }

  const handleReset = () => {
    setFilters({
      specialty: '',
      record_type: '',
      proposed_by: '',
      not_stamped: false,
      not_settled: false,
      keyword: ''
    })
    setDateRange(null)
    setTimeout(() => loadRecords(), 0)
  }

  const handleDelete = async (id: number) => {
    try {
      const result = await window.electronAPI.deleteRecord(id)
      if (result) {
        message.success('删除成功')
        loadRecords()
        loadMonthlySummary()
        loadUrgencyBoard()
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleViewDetail = async (record: LedgerRecord) => {
    setDetailModal(record)
    setDetailVisible(true)
    loadAttachmentsForDetail(record)
  }

  const loadAttachmentsForDetail = async (record: LedgerRecord) => {
    try {
      const atts = await window.electronAPI.getAttachments(record.id!)
      setDetailAttachments(atts)
    } catch (e) {
      setDetailAttachments([])
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

  const handleMonthClick = (month: string) => {
    const summaryItem = monthlySummary.find((m: any) => m.month === month)
    if (summaryItem) {
      setSelectedMonth(month)
      setMonthRecords(summaryItem.records || [])
    }
  }

  const handleBackToSummary = () => {
    setSelectedMonth(null)
    setMonthRecords([])
  }

  const handleUrgencyClick = (item: any) => {
    setSelectedUrgency({ proposed_by: item.proposed_by, month: item.month })
    setUrgencyRecords(item.records || [])
  }

  const handleBackToUrgency = () => {
    setSelectedUrgency(null)
    setUrgencyRecords([])
  }

  const openUrgencyReceiptModal = (title: string, recordIds: number[]) => {
    setUrgencyReceiptTitle(title)
    setUrgencyReceiptRecordIds(recordIds)
    setUrgencyReceiptStatus('sent')
    setUrgencyReceiptNote('')
    setUrgencyReceiptModal(true)
  }

  const handleUpdateUrgencyStatus = async () => {
    if (urgencyReceiptRecordIds.length === 0) {
      message.warning('没有需要更新的单据')
      return
    }
    setUpdatingReceipt(true)
    try {
      await window.electronAPI.updateUrgencyStatus(
        urgencyReceiptRecordIds,
        urgencyReceiptStatus as any,
        operator,
        urgencyReceiptNote
      )
      message.success(`已更新 ${urgencyReceiptRecordIds.length} 条催办状态`)
      setUrgencyReceiptModal(false)
      await Promise.all([loadRecords(), loadUrgencyBoard()])
    } catch (e: any) {
      console.error(e)
      message.error(e.message || '更新失败')
    } finally {
      setUpdatingReceipt(false)
    }
  }

  const getFlowStatusTag = (status: string) => {
    if (['已归档', '已结算', '已盖章'].includes(status)) {
      return <Tag color="success">{status}</Tag>
    } else if (['待审核', '审核中', '施工中'].includes(status)) {
      return <Tag color="processing">{status}</Tag>
    }
    return <Tag color="default">{status}</Tag>
  }

  const getMissing = (record: LedgerRecord) => {
    return getMissingMaterials(record, attachmentsByRecord[record.id!] || [])
  }

  const getCurrentStepIndex = (status: string) => {
    const idx = flowStatusOrder.indexOf(status)
    return idx >= 0 ? idx : 0
  }

  const handleExportExcel = async () => {
    if (records.length === 0) {
      message.warning('当前无数据可导出')
      return
    }
    try {
      message.loading({ content: '正在生成 Excel...', key: 'exp' })
      const result = await window.electronAPI.exportExcel(records)
      message.destroy('exp')
      if (result) {
        message.success(`已导出到：${result}`)
      }
    } catch (e) {
      message.destroy('exp')
      console.error(e)
      message.error('导出失败')
    }
  }

  const handleExportUrgencyExcel = async () => {
    try {
      message.loading({ content: '正在生成催办单...', key: 'urg' })
      const opts: any = { format: 'xlsx' as const }
      if (urgencyExportUnit) opts.proposed_by = urgencyExportUnit
      if (urgencyExportMonth) opts.month = urgencyExportMonth
      const result = await window.electronAPI.exportUrgencyNotice(urgencyData, opts)
      message.destroy('urg')
      if (result) {
        message.success(`催办单 Excel 已生成`)
        setUrgencyExportModal(false)
      } else {
        message.error('生成失败')
      }
    } catch (e) {
      message.destroy('urg')
      console.error(e)
      message.error('生成催办单失败')
    }
  }

  const handleCopyUrgencyText = async () => {
    try {
      message.loading({ content: '正在生成催办文本...', key: 'urgtxt' })
      const opts: any = { format: 'text' as const }
      if (urgencyExportUnit) opts.proposed_by = urgencyExportUnit
      if (urgencyExportMonth) opts.month = urgencyExportMonth
      const result = await window.electronAPI.exportUrgencyNotice(urgencyData, opts)
      message.destroy('urgtxt')
      if (result && typeof result === 'string') {
        try {
          await navigator.clipboard.writeText(result)
          message.success('催办文本已复制到剪贴板，可直接粘贴到微信发送')
          setUrgencyExportModal(false)
        } catch (clipErr) {
          message.destroy('urgtxt')
          Modal.info({
            title: '催办文本已生成，请手动复制',
            content: <div style={{ maxHeight: 500, overflow: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f5f5f5', padding: 12 }}>{result}</pre>
            </div>
          })
        }
      } else {
        message.error('生成失败')
      }
    } catch (e) {
      message.destroy('urgtxt')
      console.error(e)
      message.error('生成催办文本失败')
    }
  }

  const columns = [
    {
      title: '台账编号',
      dataIndex: 'ledger_no',
      key: 'ledger_no',
      width: 180,
      fixed: 'left' as const,
      render: (text: string) => (
        <span style={{ fontFamily: 'Consolas, monospace', color: '#0958d9', fontWeight: 600 }}>
          {text}
        </span>
      )
    },
    {
      title: '类型',
      dataIndex: 'record_type',
      key: 'record_type',
      width: 90,
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          '设计变更': 'blue',
          '工程洽商': 'green',
          '现场签证': 'orange'
        }
        return <Tag color={colorMap[text] || 'default'}>{text}</Tag>
      }
    },
    {
      title: '工程名称',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 140,
      ellipsis: true
    },
    {
      title: '专业',
      dataIndex: 'specialty',
      key: 'specialty',
      width: 70
    },
    {
      title: '责任单位',
      dataIndex: 'proposed_by',
      key: 'proposed_by',
      width: 90
    },
    {
      title: '费用影响',
      dataIndex: 'estimated_cost_impact',
      key: 'estimated_cost_impact',
      width: 100,
      render: (val: number) => val ? `¥${val.toLocaleString()}` : '-'
    },
    {
      title: '流转状态',
      dataIndex: 'flow_status',
      key: 'flow_status',
      width: 90,
      render: (text: string) => getFlowStatusTag(text)
    },
    {
      title: '收文日期',
      dataIndex: 'receive_date',
      key: 'receive_date',
      width: 100
    },
    {
      title: '缺失材料',
      key: 'missing',
      width: 170,
      render: (_: any, record: LedgerRecord) => {
        const missing = getMissing(record)
        if (missing.length === 0) {
          return <Tag color="success">齐全</Tag>
        }
        return (
          <Space size={4} wrap>
            {missing.map(m => (
              <Tag key={m} color="error" style={{ fontSize: 11 }}>
                {m}
              </Tag>
            ))}
          </Space>
        )
      }
    },
    {
      title: '附件',
      key: 'attachment_count',
      width: 80,
      render: (_: any, record: LedgerRecord) => {
        const atts = attachmentsByRecord[record.id!] || []
        const count = atts.length
        const catCount = atts.reduce((acc: Record<string, number>, a: Attachment) => {
          acc[a.category] = (acc[a.category] || 0) + 1
          return acc
        }, {})
        const titleText = Object.entries(catCount).map(([k, v]) => `${k}:${v}`).join('，')
        return (
          <Tooltip title={count > 0 ? titleText : '无附件'}>
            <Badge count={count} size="small" style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}>
              <PaperClipOutlined style={{ fontSize: 16, color: '#8c8c8c' }} />
            </Badge>
          </Tooltip>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: LedgerRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id!)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const commonDetailColumns = (extraMissingGetter?: (r: any) => string[]) => [
    {
      title: '台账编号',
      dataIndex: 'ledger_no',
      key: 'ledger_no',
      width: 180,
      render: (text: string, record: any) => (
        <a
          style={{ fontFamily: 'Consolas, monospace', color: '#0958d9', fontWeight: 600 }}
          onClick={() => handleViewDetail(record)}
        >
          {text}
        </a>
      )
    },
    {
      title: '类型',
      dataIndex: 'record_type',
      key: 'record_type',
      width: 90,
      render: (text: string) => {
        const colorMap: Record<string, string> = { '设计变更': 'blue', '工程洽商': 'green', '现场签证': 'orange' }
        return <Tag color={colorMap[text] || 'default'}>{text}</Tag>
      }
    },
    { title: '工程名称', dataIndex: 'project_name', key: 'project_name', width: 160, ellipsis: true },
    { title: '专业', dataIndex: 'specialty', key: 'specialty', width: 70 },
    { title: '流转状态', dataIndex: 'flow_status', key: 'flow_status', width: 90, render: (t: string) => getFlowStatusTag(t) },
    {
      title: '问题',
      key: 'issues',
      width: 240,
      render: (_: any, record: any) => {
        const issues: JSX.Element[] = []
        if (!record.stamped) issues.push(<Tag key="stamp" color="error">未盖章</Tag>)
        if (!record.settled) issues.push(<Tag key="settle" color="error">未结算</Tag>)
        const attCount = record.attachment_count ?? 0
        if (attCount === 0) issues.push(<Tag key="att" color="warning">缺附件</Tag>)
        const miss = extraMissingGetter ? extraMissingGetter(record) : record.missing_materials || []
        if (miss && miss.length > 0) {
          miss.forEach((m: string, i: number) => issues.push(
            <Tag key={`m${i}`} color="magenta">{m}</Tag>
          ))
        }
        return issues.length > 0 ? <Space size={4} wrap>{issues}</Space> : <Tag color="success">正常</Tag>
      }
    },
    {
      title: '附件',
      dataIndex: 'attachment_count',
      key: 'attachment_count',
      width: 70,
      render: (val: number) => <Badge count={val || 0} style={{ backgroundColor: val > 0 ? '#52c41a' : '#d9d9d9' }} />
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      )
    }
  ]

  const monthDetailColumns = commonDetailColumns()

  const renderMonthlyView = () => {
    if (selectedMonth) {
      return (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button onClick={handleBackToSummary}>返回月度汇总</Button>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{selectedMonth} 月度单据明细</span>
            <Tag color="blue">{monthRecords.length} 条记录</Tag>
          </Space>
        </div>
          <Table
            columns={monthDetailColumns}
            dataSource={monthRecords}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
          />
        </div>
      )
    }

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            <CalendarOutlined style={{ marginRight: 8 }} />
            月底补账视图
          </span>
          <span style={{ color: '#8c8c8c', marginLeft: 12 }}>按收文月份汇总未盖章、未结算、缺附件的单据</span>
        </div>
        {monthlySummary.length === 0 ? (
          <Empty description="暂无台账数据" />
        ) : (
          <Row gutter={[16, 16]}>
            {monthlySummary.map((item: any) => {
              const hasIssues = item.not_stamped > 0 || item.not_settled > 0 || item.no_attachments > 0
              return (
                <Col span={8} key={item.month}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => handleMonthClick(item.month)}
                    style={{
                      borderColor: hasIssues ? '#ffccc7' : undefined,
                      background: hasIssues ? '#fff2f0' : undefined
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{item.month}</span>
                      <Tag color={hasIssues ? 'error' : 'success'}>
                        {hasIssues ? '需处理' : '正常'}
                      </Tag>
                    </div>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Statistic title="总单据" value={item.total} valueStyle={{ fontSize: 18 }} />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="未盖章"
                          value={item.not_stamped}
                          valueStyle={{ fontSize: 18, color: item.not_stamped > 0 ? '#cf1322' : '#52c41a' }}
                          prefix={item.not_stamped > 0 ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="未结算"
                          value={item.not_settled}
                          valueStyle={{ fontSize: 18, color: item.not_settled > 0 ? '#cf1322' : '#52c41a' }}
                          prefix={item.not_settled > 0 ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                        />
                      </Col>
                    </Row>
                    <div style={{ marginTop: 8 }}>
                      <Statistic
                        title="缺附件"
                        value={item.no_attachments}
                        valueStyle={{ fontSize: 14, color: item.no_attachments > 0 ? '#d46b08' : '#52c41a' }}
                      />
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </div>
    )
  }

  const urgencyUnits = useMemo(() => {
    const units = new Set<string>()
    urgencyData.forEach((d: any) => units.add(d.proposed_by))
    return Array.from(units).sort()
  }, [urgencyData])

  const urgencyMonths = useMemo(() => {
    const months = new Set<string>()
    urgencyData.forEach((d: any) => months.add(d.month))
    return Array.from(months).sort().reverse()
  }, [urgencyData])

  const renderUrgencyView = () => {
    if (selectedUrgency) {
      return (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button onClick={handleBackToUrgency}>返回催办看板</Button>
              <span style={{ fontSize: 16, fontWeight: 600 }}>
                {selectedUrgency.proposed_by} · {selectedUrgency.month}
              </span>
              <Tag color="blue">{urgencyRecords.length} 条待追单据</Tag>
            </Space>
            <Space>
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => {
                  setUrgencyExportUnit(selectedUrgency.proposed_by)
                  setUrgencyExportMonth(selectedUrgency.month)
                  setUrgencyExportModal(true)
                }}
              >
                生成本月催办单
              </Button>
              <Button
                type="primary"
                icon={<CheckSquareOutlined />}
                onClick={() => {
                  const ids = urgencyRecords.map((r: any) => r.id)
                  openUrgencyReceiptModal(`${selectedUrgency.proposed_by} · ${selectedUrgency.month} 催办回执`, ids)
                }}
              >
                登记回执
              </Button>
            </Space>
          </div>
          <Table
            columns={[
              ...commonDetailColumns((r: any) => r.missing_materials || []),
              {
                title: '催办状态',
                dataIndex: 'urgency_status',
                key: 'urgency_status',
                width: 110,
                render: (v: string) => {
                  const map: Record<string, { color: string; text: string }> = {
                    none: { color: 'default', text: '未催办' },
                    sent: { color: 'blue', text: '已发送' },
                    replied: { color: 'cyan', text: '已回复' },
                    submitted: { color: 'green', text: '已补交' },
                    overdue: { color: 'red', text: '逾期未回' }
                  }
                  const s = map[v || 'none']
                  return <Tag color={s.color}>{s.text}</Tag>
                }
              }
            ]}
            dataSource={urgencyRecords}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 1100 }}
          />
        </div>
      )
    }

    const byUnit: Record<string, any> = {}
    for (const item of urgencyData) {
      const key = item.proposed_by
      if (!byUnit[key]) {
        byUnit[key] = {
          proposed_by: key,
          total: 0,
          missing_stamp: 0,
          missing_settlement: 0,
          missing_attachments: 0,
          missing_total: 0,
          materials: {} as Record<string, number>,
          months: [] as any[]
        }
      }
      byUnit[key].total += item.total
      byUnit[key].missing_stamp += item.missing_stamp
      byUnit[key].missing_settlement += item.missing_settlement
      byUnit[key].missing_attachments += item.missing_attachments
      for (const [m, c] of Object.entries(item.missing_materials_detail || {})) {
        byUnit[key].materials[m] = (byUnit[key].materials[m] || 0) + (c as number)
        byUnit[key].missing_total += c as number
      }
      byUnit[key].months.push(item)
    }

    const unitList = Object.values(byUnit).sort((a: any, b: any) => b.missing_total - a.missing_total)

    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Row gutter={16} style={{ flex: 1 }}>
            <Col span={8}>
              <Card size="small">
                <Statistic title="责任单位总数" value={unitList.length} prefix={<TeamOutlined />} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="需追材料总数"
                  value={unitList.reduce((s: number, u: any) => s + u.missing_total, 0)}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="涉及单据总数"
                  value={unitList.reduce((s: number, u: any) => s + u.total, 0)}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
          <Space style={{ marginLeft: 16 }}>
            <Tooltip title="按筛选条件生成催办单（全部单位）">
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => {
                  setUrgencyExportUnit('')
                  setUrgencyExportMonth('')
                  setUrgencyExportModal(true)
                }}
              >
                生成催办单
              </Button>
            </Tooltip>
            <Tooltip title={`当前经办人：${operator}`}>
              <Button icon={<UserOutlined />} onClick={() => { setOperatorInput(operator); setOperatorModal(true) }}>
                经办人：{operator}
              </Button>
            </Tooltip>
          </Space>
        </div>

        {unitList.length === 0 ? (
          <Empty description="暂无催办数据" />
        ) : (
          <Collapse defaultActiveKey={unitList.slice(0, 3).map((u: any) => u.proposed_by)} ghost>
            {unitList.map((unit: any) => (
              <Panel
                key={unit.proposed_by}
                header={
                  <Space>
                    <TeamOutlined style={{ color: '#1677ff' }} />
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{unit.proposed_by}</span>
                    <Tag color="blue">{unit.total} 条单据</Tag>
                    <Badge
                      count={`${unit.missing_total}项待追`}
                      style={{ backgroundColor: unit.missing_total > 0 ? '#cf1322' : '#52c41a' }}
                    />
                  </Space>
                }
                extra={
                  <Space size={12} style={{ marginRight: 24 }}>
                    <Tag color={unit.missing_stamp > 0 ? 'error' : 'success'}>
                      未盖章 {unit.missing_stamp}
                    </Tag>
                    <Tag color={unit.missing_settlement > 0 ? 'error' : 'success'}>
                      未结算 {unit.missing_settlement}
                    </Tag>
                    <Tag color={unit.missing_attachments > 0 ? 'warning' : 'success'}>
                      缺附件 {unit.missing_attachments}
                    </Tag>
                  </Space>
                }
              >
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  {Object.entries(unit.materials).map(([mat, count]) => (
                    <Col key={mat}>
                      <Tag color="error" style={{ padding: '4px 12px', fontSize: 13 }}>
                        缺{mat}：{String(count)}单
                      </Tag>
                    </Col>
                  ))}
                  {Object.keys(unit.materials).length === 0 && (
                    <Col>
                      <Tag color="success">材料齐全</Tag>
                    </Col>
                  )}
                </Row>
                <Table
                  size="small"
                  dataSource={unit.months}
                  pagination={false}
                  rowKey={(r) => `${r.proposed_by}_${r.month}`}
                  columns={[
                    {
                      title: '收文月份',
                      dataIndex: 'month',
                      key: 'month',
                      width: 100,
                      render: (t) => <Space><CalendarOutlined style={{ color: '#8c8c8c' }} />{t}</Space>
                    },
                    { title: '单据数', dataIndex: 'total', key: 'total', width: 70 },
                    {
                      title: '未盖章',
                      dataIndex: 'missing_stamp',
                      key: 'missing_stamp',
                      width: 90,
                      render: (v) => v > 0 ? <Tag color="error">{v}</Tag> : <Tag color="success">0</Tag>
                    },
                    {
                      title: '未结算',
                      dataIndex: 'missing_settlement',
                      key: 'missing_settlement',
                      width: 90,
                      render: (v) => v > 0 ? <Tag color="error">{v}</Tag> : <Tag color="success">0</Tag>
                    },
                    {
                      title: '缺附件',
                      dataIndex: 'missing_attachments',
                      key: 'missing_attachments',
                      width: 90,
                      render: (v) => v > 0 ? <Tag color="warning">{v}</Tag> : <Tag color="success">0</Tag>
                    },
                    {
                      title: '待追材料',
                      key: 'miss',
                      render: (_: any, r: any) => {
                        const mats = Object.entries(r.missing_materials_detail || {})
                          .map(([k, v]) => `${k}×${v}`).join('，')
                        return mats || <Tag color="success">无</Tag>
                      }
                    },
                    {
                      title: '催办状态',
                      dataIndex: 'urgency_status',
                      key: 'urgency_status',
                      width: 110,
                      render: (_v: any, r: any) => {
                        const s = r.records || []
                        const statuses = s.map((rec: any) => rec.urgency_status || 'none')
                        if (statuses.every((st: string) => st === 'none')) {
                          return <Tag>未催办</Tag>
                        }
                        const sent = statuses.filter((st: string) => st === 'sent').length
                        const replied = statuses.filter((st: string) => st === 'replied').length
                        const submitted = statuses.filter((st: string) => st === 'submitted').length
                        const overdue = statuses.filter((st: string) => st === 'overdue').length
                        return (
                          <Space size={4}>
                            {sent > 0 && <Tag color="blue">已发{sent}</Tag>}
                            {replied > 0 && <Tag color="cyan">已回{replied}</Tag>}
                            {submitted > 0 && <Tag color="green">已交{submitted}</Tag>}
                            {overdue > 0 && <Tag color="red">逾期{overdue}</Tag>}
                          </Space>
                        )
                      }
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 180,
                      render: (_: any, r: any) => (
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleUrgencyClick(r)}
                          >
                            追这月
                          </Button>
                          <Popconfirm
                            title="登记本月催办回执？"
                            description="将更新该单位该月所有单据的催办状态"
                            onConfirm={() => {
                              const ids = (r.records || []).map((rec: any) => rec.id)
                              openUrgencyReceiptModal(`${r.proposed_by} · ${r.month} 催办回执`, ids)
                            }}
                          >
                            <Button size="small" icon={<CheckSquareOutlined />}>
                              登记回执
                            </Button>
                          </Popconfirm>
                        </Space>
                      )
                    }
                  ]}
                />
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
    )
  }

  return (
    <div className="page-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>台账查询</h2>
        <Tooltip title={`当前经办人：${operator}`}>
          <Button icon={<UserOutlined />} onClick={() => { setOperatorInput(operator); setOperatorModal(true) }}>
            经办人：{operator}
          </Button>
        </Tooltip>
      </div>

      <Tabs
        defaultActiveKey="list"
        items={[
          {
            key: 'list',
            label: (
              <span>
                <SearchOutlined />
                台账列表
              </span>
            ),
            children: (
              <>
                <div className="filter-section">
                  <Row gutter={[16, 16]}>
                    <Col span={6}>
                      <Input
                        placeholder="搜索编号/工程/原因"
                        value={filters.keyword}
                        prefix={<SearchOutlined />}
                        onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                        onPressEnter={handleSearch}
                      />
                    </Col>
                    <Col span={4}>
                      <Select
                        placeholder="选择专业"
                        allowClear
                        style={{ width: '100%' }}
                        value={filters.specialty || undefined}
                        onChange={(v) => setFilters({ ...filters, specialty: v || '' })}
                      >
                        {SPECIALTIES.map(s => (
                          <Option key={s} value={s}>{s}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={4}>
                      <Select
                        placeholder="单据类型"
                        allowClear
                        style={{ width: '100%' }}
                        value={filters.record_type || undefined}
                        onChange={(v) => setFilters({ ...filters, record_type: v || '' })}
                      >
                        {RECORD_TYPES.map(t => (
                          <Option key={t} value={t}>{t}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={4}>
                      <Select
                        placeholder="责任单位"
                        allowClear
                        style={{ width: '100%' }}
                        value={filters.proposed_by || undefined}
                        onChange={(v) => setFilters({ ...filters, proposed_by: v || '' })}
                      >
                        {PROPOSED_BY_OPTIONS.map(o => (
                          <Option key={o} value={o}>{o}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={6}>
                      <RangePicker
                        style={{ width: '100%' }}
                        value={dateRange}
                        onChange={(dates) => setDateRange(dates as any)}
                      />
                    </Col>
                    <Col span={24}>
                      <Space size="large">
                        <Checkbox
                          checked={filters.not_stamped}
                          onChange={(e) => setFilters({ ...filters, not_stamped: e.target.checked })}
                        >
                          <span style={{ color: '#cf1322' }}>
                            <ExclamationCircleOutlined /> 仅看未盖章
                          </span>
                        </Checkbox>
                        <Checkbox
                          checked={filters.not_settled}
                          onChange={(e) => setFilters({ ...filters, not_settled: e.target.checked })}
                        >
                          <span style={{ color: '#cf1322' }}>
                            <ExclamationCircleOutlined /> 仅看未结算
                          </span>
                        </Checkbox>
                        <Space>
                          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                            查询
                          </Button>
                          <Button icon={<ReloadOutlined />} onClick={handleReset}>
                            重置
                          </Button>
                          <Tooltip title="导出当前筛选结果为 Excel（包含缺失材料按附件重新计算）">
                            <Button
                              type="primary"
                              ghost
                              icon={<FileExcelOutlined />}
                              onClick={handleExportExcel}
                              disabled={records.length === 0}
                              style={{ borderColor: '#52c41a', color: '#52c41a' }}
                            >
                              导出Excel ({records.length})
                            </Button>
                          </Tooltip>
                        </Space>
                      </Space>
                    </Col>
                  </Row>
                </div>

                <Table
                  columns={columns}
                  dataSource={records}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1500, y: 420 }}
                  pagination={{
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`,
                    pageSize: 10
                  }}
                  locale={{
                    emptyText: <Empty description="暂无台账记录" />
                  }}
                />
              </>
            )
          },
          {
            key: 'monthly',
            label: (
              <span>
                <CalendarOutlined />
                月底补账
              </span>
            ),
            children: renderMonthlyView()
          },
          {
            key: 'urgency',
            label: (
              <span>
                <TeamOutlined />
                资料催办看板
              </span>
            ),
            children: renderUrgencyView()
          }
        ]}
      />

      <Modal
        title={
          <Space>
            <FileTextOutlined />
            <span>台账详情 - {detailModal?.ledger_no}</span>
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {detailModal && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="台账编号" span={1}>
                <span className="ledger-no-display">{detailModal.ledger_no}</span>
              </Descriptions.Item>
              <Descriptions.Item label="单据类型">{detailModal.record_type}</Descriptions.Item>
              <Descriptions.Item label="工程名称">{detailModal.project_name}</Descriptions.Item>
              <Descriptions.Item label="楼栋部位">{detailModal.building_location || '-'}</Descriptions.Item>
              <Descriptions.Item label="涉及专业">{detailModal.specialty}</Descriptions.Item>
              <Descriptions.Item label="提出单位">{detailModal.proposed_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="预计费用">
                ¥{detailModal.estimated_cost_impact?.toLocaleString() || '0'}
              </Descriptions.Item>
              <Descriptions.Item label="收文日期">{detailModal.receive_date}</Descriptions.Item>
              <Descriptions.Item label="流转状态">
                {getFlowStatusTag(detailModal.flow_status)}
              </Descriptions.Item>
              <Descriptions.Item label="状态标签">
                <Space>
                  {detailModal.stamped
                    ? <Tag color="success">已盖章</Tag>
                    : <Tag color="error">未盖章</Tag>}
                  {detailModal.settled
                    ? <Tag color="success">已结算</Tag>
                    : <Tag color="error">未结算</Tag>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="变更原因" span={2}>
                {detailModal.change_reason || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detailModal.remark || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">办理节点进度</Divider>
            <div style={{ padding: '8px 0' }}>
              {flowStatusOrder.map((step, idx) => {
                const currentIdx = getCurrentStepIndex(detailModal.flow_status)
                let className = 'progress-step'
                if (idx < currentIdx) className += ' completed'
                else if (idx === currentIdx) className += ' current'
                return (
                  <div key={step} className={className}>
                    <div style={{ fontWeight: idx === currentIdx ? 600 : 400 }}>
                      {step}
                      {idx < currentIdx && <Tag color="success" style={{ marginLeft: 8 }}>已完成</Tag>}
                      {idx === currentIdx && <Tag color="processing" style={{ marginLeft: 8 }}>进行中</Tag>}
                    </div>
                  </div>
                )
              })}
            </div>

            <Divider orientation="left">材料齐备情况（结合已上传附件重新计算）</Divider>
            {(() => {
              const missing = getMissingMaterials(detailModal, detailAttachments)
              return missing.length === 0 ? (
                <Badge status="success" text="材料齐全，可进行竣工资料移交" />
              ) : (
                <Space wrap>
                  {missing.map(m => (
                    <Tag key={m} color="error" icon={<ExclamationCircleOutlined />}>
                      缺少：{m}
                    </Tag>
                  ))}
                </Space>
              )
            })()}

            {(detailModal.completion_records || []).length > 0 && (
              <>
                <Divider orientation="left">
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    补齐确认记录
                  </Space>
                </Divider>
                <div style={{ padding: '8px 0' }}>
                  {(detailModal.completion_records || []).map((c: any, i: number) => (
                  <div key={i} style={{ marginBottom: 6, padding: '6px 10px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                    <Space>
                      <Tag color="success">{c.material_name}</Tag>
                      <span style={{ color: '#389e0d' }}>
                        <b>{c.operator}</b> 于 {c.completed_at} 确认补齐
                      </span>
                      {c.note && <Text type="secondary" style={{ marginLeft: 8 }}>（{c.note}）</Text>}
                    </Space>
                  </div>
                ))}
                </div>
              </>
            )}

            {(detailModal.handover_receipts || []).length > 0 && (
              <>
                <Divider orientation="left">
                  <Space>
                    <SolutionOutlined style={{ color: '#52c41a' }} />
                    移交签收记录
                  </Space>
                </Divider>
                <div style={{ padding: '8px 0' }}>
                  {(detailModal.handover_receipts || []).slice().reverse().map((r: any, i: number) => (
                    <div key={i} style={{ marginBottom: 6, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <Space>
                          <b>签收人：{r.receiver}</b>
                          <Tag color="green">
                            <UserOutlined /> 登记人：{r.operator}
                          </Tag>
                        </Space>
                        <span style={{ color: '#8c8c8c', fontSize: 12 }}>{r.received_at}</span>
                      </div>
                      {r.receipt_opinion && (
                        <div style={{ fontSize: 12, color: '#595959' }}>签收意见：{r.receipt_opinion}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {detailAttachments.length > 0 && (
              <>
                <Divider orientation="left">已归档附件（{detailAttachments.length}个）</Divider>
                <Row gutter={[8, 8]}>
                  {ATTACHMENT_CATEGORIES.map(cat => {
                    const list = detailAttachments.filter(a => a.category === cat)
                    if (list.length === 0) return null
                    return (
                      <Col span={24} key={cat}>
                        <Tag
                          color={CATEGORY_COLOR_MAP[cat] || '#8c8c8c'}
                          style={{ fontSize: 13, padding: '2px 8px', marginBottom: 4 }}
                        >
                          {cat}（{list.length}）
                        </Tag>
                        <div style={{ marginTop: 4, paddingLeft: 4 }}>
                          <Space wrap size={4}>
                            {list.map(a => (
                              <Tooltip
                                key={a.id}
                                title={`上传人：${a.uploaded_by || '-'} · ${a.created_at}${a.version_note ? '\n版本说明：' + a.version_note : ''}`}
                              >
                                <Tag color={a.is_current !== false ? 'blue' : 'default'} icon={<PaperClipOutlined />}>
                                  {a.file_name}
                                  {a.version && a.version > 1 && <span style={{ marginLeft: 4, fontWeight: 600 }}>v{a.version}</span>}
                                  {a.is_current === false && <span style={{ marginLeft: 4, opacity: 0.7 }}>（历史）</span>}
                                </Tag>
                              </Tooltip>
                            ))}
                          </Space>
                        </div>
                      </Col>
                    )
                  })}
                </Row>
              </>
            )}

            <Divider orientation="left">
              <Space>
                <ClockCircleOutlined style={{ color: '#1677ff' }} />
                全流程操作时间线
              </Space>
            </Divider>
            {(detailModal.timeline && detailModal.timeline.length > 0) ? (
              <div style={{ padding: '8px 4px 8px 12px', maxHeight: 420, overflow: 'auto' }}>
                <AntdTimeline
                  mode="left"
                  items={detailModal.timeline.slice().reverse().map((event: TimelineEvent) => ({
                    color: getTimelineColor(event.event_type),
                    dot: getTimelineIcon(event.event_type),
                    children: (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>
                          {event.event_name || getTimelineLabel(event.event_type)}
                          {event.operator && (
                            <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>
                              <UserOutlined /> {event.operator}
                            </Tag>
                          )}
                        </div>
                        <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 2 }}>{event.happened_at}</div>
                        {event.detail && (
                          <div style={{ fontSize: 13, color: '#595959' }}>{event.detail}</div>
                        )}
                      </div>
                    )
                  }))}
                />
              </div>
            ) : (
              <Empty description="暂无操作记录" style={{ padding: '20px 0' }} />
            )}
          </>
        )}
      </Modal>

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
          所有补齐材料、生成催办单操作均会记录此经办人
        </div>
      </Modal>

      <Modal
        title="生成催办单"
        open={urgencyExportModal}
        onCancel={() => setUrgencyExportModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setUrgencyExportModal(false)}>取消</Button>,
          <Button
            key="text" icon={<CopyOutlined />} onClick={handleCopyUrgencyText}>复制微信文本</Button>,
          <Button
            key="xlsx"
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={handleExportUrgencyExcel}
          >
            导出 Excel
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>选择催办范围（留空表示全部）：</div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              allowClear
              placeholder="责任单位（留空=所有单位）"
              style={{ width: '100%' }}
              value={urgencyExportUnit || undefined}
              onChange={(v) => setUrgencyExportUnit(v || '')}
            >
              {urgencyUnits.map(u => (
                <Option key={u} value={u}>{u}</Option>
              ))}
            </Select>
            <Select
              allowClear
              placeholder="收文月份（留空=所有月份）"
              style={{ width: '100%' }}
              value={urgencyExportMonth || undefined}
              onChange={(v) => setUrgencyExportMonth(v || '')}
            >
              {urgencyMonths.map(m => (
                <Option key={m} value={m}>{m}</Option>
              ))}
            </Select>
          </Space>
        </div>
        <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
          · Excel 包含「催办汇总」和「单据明细」两个 Sheet<br />
          · 微信文本为纯文字格式，可直接复制粘贴发送
        </div>
      </Modal>

      <Modal
        title={`登记催办回执 - ${urgencyReceiptTitle}`}
        open={urgencyReceiptModal}
        onOk={handleUpdateUrgencyStatus}
        onCancel={() => setUrgencyReceiptModal(false)}
        confirmLoading={updatingReceipt}
        okText="确认登记"
        cancelText="取消"
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>回执状态：</div>
          <Radio.Group
            value={urgencyReceiptStatus}
            onChange={(e) => setUrgencyReceiptStatus(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Radio value="sent">📤 已发送（催办单已发出）</Radio>
              <Radio value="replied">💬 已回复（对方已答复）</Radio>
              <Radio value="submitted">📥 已补交（资料已补齐）</Radio>
              <Radio value="overdue">⏰ 逾期未回（超期未反馈）</Radio>
            </Space>
          </Radio.Group>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>备注说明（可选）：</div>
          <Input.TextArea
            rows={3}
            value={urgencyReceiptNote}
            onChange={(e) => setUrgencyReceiptNote(e.target.value)}
            placeholder="例如：对方承诺下周三前补齐"
          />
        </div>
        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
          共 <b style={{ color: '#1677ff' }}>{urgencyReceiptRecordIds.length}</b> 条单据将被更新
          <span style={{ marginLeft: 16 }}>登记人：<b style={{ color: '#1677ff' }}>{operator}</b></span>
        </div>
      </Modal>
    </div>
  )
}

export default QueryPage
