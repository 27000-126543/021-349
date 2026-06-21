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
  Empty
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { LedgerRecord, RECORD_TYPES, SPECIALTIES, FLOW_STATUSES, PROPOSED_BY_OPTIONS } from '../types'

const { RangePicker } = DatePicker
const { Option } = Select

const flowStatusOrder = ['待审核', '审核中', '已审核', '施工中', '已完工', '已盖章', '已结算', '已归档']

const QueryPage: React.FC = () => {
  const [records, setRecords] = useState<LedgerRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [detailModal, setDetailModal] = useState<LedgerRecord | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [filters, setFilters] = useState({
    specialty: '',
    record_type: '',
    proposed_by: '',
    not_stamped: false,
    not_settled: false,
    keyword: ''
  })
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

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
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
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
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleViewDetail = (record: LedgerRecord) => {
    setDetailModal(record)
    setDetailVisible(true)
  }

  const getFlowStatusTag = (status: string) => {
    if (['已归档', '已结算', '已盖章'].includes(status)) {
      return <Tag color="success">{status}</Tag>
    } else if (['待审核', '审核中', '施工中'].includes(status)) {
      return <Tag color="processing">{status}</Tag>
    }
    return <Tag color="default">{status}</Tag>
  }

  const getMissingMaterials = (record: LedgerRecord) => {
    const missing: string[] = []
    if (!record.stamped) missing.push('盖章件')
    if (!record.settled) missing.push('结算单')
    if (!record.change_reason) missing.push('变更说明')
    if (!record.proposed_by) missing.push('提出单位确认')
    return missing
  }

  const getCurrentStepIndex = (status: string) => {
    const idx = flowStatusOrder.indexOf(status)
    return idx >= 0 ? idx : 0
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
      width: 160,
      ellipsis: true
    },
    {
      title: '楼栋部位',
      dataIndex: 'building_location',
      key: 'building_location',
      width: 140,
      ellipsis: true
    },
    {
      title: '专业',
      dataIndex: 'specialty',
      key: 'specialty',
      width: 80
    },
    {
      title: '提出单位',
      dataIndex: 'proposed_by',
      key: 'proposed_by',
      width: 100
    },
    {
      title: '费用影响(元)',
      dataIndex: 'estimated_cost_impact',
      key: 'estimated_cost_impact',
      width: 120,
      render: (val: number) => val ? `¥${val.toLocaleString()}` : '-'
    },
    {
      title: '流转状态',
      dataIndex: 'flow_status',
      key: 'flow_status',
      width: 100,
      render: (text: string) => getFlowStatusTag(text)
    },
    {
      title: '收文日期',
      dataIndex: 'receive_date',
      key: 'receive_date',
      width: 110
    },
    {
      title: '缺失材料',
      key: 'missing',
      width: 140,
      render: (_: any, record: LedgerRecord) => {
        const missing = getMissingMaterials(record)
        if (missing.length === 0) {
          return <Tag color="success">齐全</Tag>
        }
        return (
          <Space size={4} wrap>
            {missing.map(m => (
              <Tag key={m} color="error" className="missing-material-tag">
                {m}
              </Tag>
            ))}
          </Space>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
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

  return (
    <div className="page-card">
      <h2 className="page-title">台账查询</h2>

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
        scroll={{ x: 1400, y: 500 }}
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

            <Divider orientation="left">缺失材料提示</Divider>
            {getMissingMaterials(detailModal).length === 0 ? (
              <Badge status="success" text="材料齐全" />
            ) : (
              <Space wrap>
                {getMissingMaterials(detailModal).map(m => (
                  <Tag key={m} color="error">
                    缺少：{m}
                  </Tag>
                ))}
              </Space>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

export default QueryPage
