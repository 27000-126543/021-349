import React, { useState, useEffect } from 'react'
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
  Tooltip
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
  PaperClipOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { LedgerRecord, Attachment, RECORD_TYPES, SPECIALTIES, FLOW_STATUSES, PROPOSED_BY_OPTIONS, getMissingMaterials } from '../types'

const { RangePicker } = DatePicker
const { Option } = Select

const flowStatusOrder = ['待审核', '审核中', '已审核', '施工中', '已完工', '已盖章', '已结算', '已归档']

const QueryPage: React.FC = () => {
  const [records, setRecords] = useState<LedgerRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [detailModal, setDetailModal] = useState<LedgerRecord | null>(null)
  const [detailAttachments, setDetailAttachments] = useState<Attachment[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [attachmentCounts, setAttachmentCounts] = useState<Record<number, number>>({})
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
      const counts = await window.electronAPI.getAttachmentCounts()
      setAttachmentCounts(counts)
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

  useEffect(() => {
    loadRecords()
    loadMonthlySummary()
  }, [])

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
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleViewDetail = async (record: LedgerRecord) => {
    setDetailModal(record)
    setDetailVisible(true)
    try {
      const atts = await window.electronAPI.getAttachments(record.id!)
      setDetailAttachments(atts)
    } catch (e) {
      setDetailAttachments([])
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

  const getFlowStatusTag = (status: string) => {
    if (['已归档', '已结算', '已盖章'].includes(status)) {
      return <Tag color="success">{status}</Tag>
    } else if (['待审核', '审核中', '施工中'].includes(status)) {
      return <Tag color="processing">{status}</Tag>
    }
    return <Tag color="default">{status}</Tag>
  }

  const getMissingMaterialsForRecord = (record: LedgerRecord) => {
    return getMissingMaterials(record, [])
  }

  const getCurrentStepIndex = (status: string) => {
    const idx = flowStatusOrder.indexOf(status)
    return idx >= 0 ? idx : 0
  }

  const handleExportCSV = async () => {
    const dataToExport = records
    if (dataToExport.length === 0) {
      message.warning('当前无数据可导出')
      return
    }

    const headers = ['台账编号', '单据类型', '工程名称', '楼栋部位', '涉及专业', '提出单位', '预计费用影响(元)', '流转状态', '收文日期', '盖章状态', '结算状态', '缺失材料', '附件数量']
    const rows = dataToExport.map(r => {
      const missing = getMissingMaterialsForRecord(r)
      const attCount = attachmentCounts[r.id!] || 0
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
        missing.length > 0 ? missing.join('+') : '齐全',
        attCount
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const str = String(cell)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(','))
    ].join('\n')

    const defaultName = `台账导出_${dayjs().format('YYYYMMDD_HHmmss')}.csv`
    const result = await window.electronAPI.exportExcel(csvContent, defaultName)
    if (result) {
      message.success(`已导出到 ${result}`)
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
      title: '提出单位',
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
      width: 160,
      render: (_: any, record: LedgerRecord) => {
        const missing = getMissingMaterialsForRecord(record)
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
      width: 60,
      render: (_: any, record: LedgerRecord) => {
        const count = attachmentCounts[record.id!] || 0
        return (
          <Badge count={count} size="small" style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}>
            <PaperClipOutlined style={{ fontSize: 16, color: '#8c8c8c' }} />
          </Badge>
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

  const monthDetailColumns = [
    {
      title: '台账编号',
      dataIndex: 'ledger_no',
      key: 'ledger_no',
      width: 180,
      render: (text: string) => (
        <a style={{ fontFamily: 'Consolas, monospace', color: '#0958d9', fontWeight: 600 }} onClick={() => {
          const fullRecord = records.find(r => r.id === text) || null
        }}>
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
    {
      title: '工程名称',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 160,
      ellipsis: true
    },
    {
      title: '专业',
      dataIndex: 'specialty',
      key: 'specialty',
      width: 70
    },
    {
      title: '流转状态',
      dataIndex: 'flow_status',
      key: 'flow_status',
      width: 90,
      render: (text: string) => getFlowStatusTag(text)
    },
    {
      title: '问题标记',
      key: 'issues',
      width: 200,
      render: (_: any, record: any) => {
        const issues: JSX.Element[] = []
        if (!record.stamped) issues.push(<Tag key="stamp" color="error">未盖章</Tag>)
        if (!record.settled) issues.push(<Tag key="settle" color="error">未结算</Tag>)
        if (record.attachment_count === 0) issues.push(<Tag key="att" color="warning">缺附件</Tag>)
        return issues.length > 0 ? <Space size={4} wrap>{issues}</Space> : <Tag color="success">正常</Tag>
      }
    },
    {
      title: '附件数',
      dataIndex: 'attachment_count',
      key: 'attachment_count',
      width: 70,
      render: (val: number) => <Badge count={val} style={{ backgroundColor: val > 0 ? '#52c41a' : '#d9d9d9' }} />
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

  return (
    <div className="page-card">
      <h2 className="page-title">台账查询</h2>

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
                          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                            导出当前结果
                          </Button>
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
                  scroll={{ x: 1400, y: 460 }}
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
        width={800}
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

            <Divider orientation="left">材料齐备情况</Divider>
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

            {detailAttachments.length > 0 && (
              <>
                <Divider orientation="left">已归档附件（{detailAttachments.length}个）</Divider>
                <Space wrap>
                  {detailAttachments.map(att => (
                    <Tag key={att.id} color="blue" icon={<PaperClipOutlined />}>
                      {att.category}：{att.file_name}
                    </Tag>
                  ))}
                </Space>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

export default QueryPage
