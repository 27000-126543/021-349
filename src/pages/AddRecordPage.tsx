import React, { useState, useEffect, useMemo } from 'react'
import {
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Button,
  Radio,
  message,
  Alert,
  Card,
  Row,
  Col,
  Space,
  Tag,
  Divider,
  Tooltip,
  Modal,
  Result,
  Statistic
} from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
  ReloadOutlined,
  PaperClipOutlined,
  EyeOutlined,
  PlusOutlined,
  FileDoneOutlined,
  UserOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import {
  RECORD_TYPES, SPECIALTIES, FLOW_STATUSES, PROPOSED_BY_OPTIONS,
  REQUIRED_FIELDS_FOR_SAVE, FIELD_LABELS, LedgerRecord, DEFAULT_OPERATOR
} from '../types'

const { TextArea } = Input
const { Option } = Select

const AddRecordPage: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [ledgerNo, setLedgerNo] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [successModal, setSuccessModal] = useState<{
    open: boolean
    record: LedgerRecord | null
    id: number
  }>({ open: false, record: null, id: 0 })
  const [operator, setOperatorState] = useState<string>(DEFAULT_OPERATOR)
  const [operatorModal, setOperatorModal] = useState(false)
  const [operatorInput, setOperatorInput] = useState('')

  useEffect(() => {
    loadOperator()
  }, [])

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

  const missingFields = useMemo(() => {
    const missing: string[] = []
    REQUIRED_FIELDS_FOR_SAVE.forEach(field => {
      const val = formValues[field]
      if (val === undefined || val === null || val === '' ||
          (field === 'estimated_cost_impact' && (val === undefined || val === null || (typeof val !== 'number' && !val)))) {
        missing.push(FIELD_LABELS[field] || field)
      }
    })
    return missing
  }, [formValues])

  const canSave = missingFields.length === 0

  useEffect(() => {
    if (canSave && formValues.record_type && formValues.project_name) {
      generateNo(formValues)
    } else {
      setLedgerNo('')
    }
  }, [canSave, formValues.record_type, formValues.project_name])

  useEffect(() => {
    const initial = form.getFieldsValue()
    setFormValues(initial)
  }, [])

  const generateNo = async (values: any) => {
    setIsGenerating(true)
    try {
      const no = await window.electronAPI.generateLedgerNo(values.record_type, values.project_name)
      setLedgerNo(no)
    } catch (error) {
      console.error('生成编号失败:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const onValuesChange = (_changedValues: any, allValues: any) => {
    setFormValues({ ...allValues })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (missingFields.length > 0) {
        message.error(`请先完善：${missingFields.join('、')}`)
        return
      }

      if (!ledgerNo) {
        message.error('台账编号未生成，请先完整填写所有必填项')
        return
      }

      const record: LedgerRecord = {
        ...values,
        ledger_no: ledgerNo,
        stamped: values.stamped ? 1 : 0,
        settled: values.settled ? 1 : 0,
        receive_date: values.receive_date ? dayjs(values.receive_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
      }

      const result = await window.electronAPI.addRecord(record, operator)
      if (result && result.id) {
        setSuccessModal({
          open: true,
          record: result.record || record,
          id: result.id
        })
      }
    } catch (error) {
      console.error('提交失败:', error)
    }
  }

  const handleReset = () => {
    form.resetFields()
    const newInitial = {
      receive_date: dayjs(),
      stamped: false,
      settled: false
    }
    form.setFieldsValue(newInitial)
    setFormValues(newInitial)
    setLedgerNo('')
  }

  const goUploadAttachment = () => {
    if (successModal.record) {
      localStorage.setItem('attachmentSelectedRecordId', String(successModal.id))
    }
    setSuccessModal({ open: false, record: null, id: 0 })
    navigate('/attachment')
  }

  const goViewDetail = () => {
    if (successModal.record) {
      localStorage.setItem('queryFocusRecordId', String(successModal.id))
    }
    setSuccessModal({ open: false, record: null, id: 0 })
    navigate('/query')
  }

  const goAddAnother = () => {
    setSuccessModal({ open: false, record: null, id: 0 })
    handleReset()
  }

  const requiredLabel = (label: string) => (
    <span>
      {label}
      <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>
    </span>
  )

  return (
    <div className="page-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="page-title" style={{ margin: 0 }}>新增登记</h2>
        <Tooltip title={`当前经办人：${operator}，登记台账会记录此经办人`}>
          <Button icon={<UserOutlined />} onClick={() => { setOperatorInput(operator); setOperatorModal(true) }}>
            经办人：{operator}
          </Button>
        </Tooltip>
      </div>

      <Card style={{ marginBottom: 20, background: canSave ? '#f6ffed' : '#fff7e6', border: canSave ? '1px solid #b7eb8f' : '1px solid #ffe58f' }}>
        <Row align="middle" gutter={16}>
          <Col>
            <span style={{ fontSize: 14, color: '#595959' }}>台账编号：</span>
            {canSave && ledgerNo ? (
              <span className="ledger-no-display">{ledgerNo}</span>
            ) : canSave && isGenerating ? (
              <Tag color="processing">正在生成编号...</Tag>
            ) : (
              <Tag color="warning">
                请完整填写所有必填项后自动生成
              </Tag>
            )}
          </Col>
          <Col flex="auto">
            {missingFields.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                icon={<ExclamationCircleOutlined />}
                message={
                  <Space wrap>
                    <span>待完善必填项（{missingFields.length}项）：</span>
                    {missingFields.map((f, i) => (
                      <Tag key={f} color="warning" style={{ marginLeft: 4 }}>{f}</Tag>
                    ))}
                  </Space>
                }
                style={{ border: 'none', padding: 0, background: 'transparent' }}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message="所有必填项已填写完整，台账编号已生成，可以保存入账"
                style={{ border: 'none', padding: 0, background: 'transparent' }}
              />
            )}
          </Col>
        </Row>
      </Card>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={onValuesChange}
        initialValues={{
          receive_date: dayjs(),
          stamped: false,
          settled: false
        }}
        requiredMark={false}
      >
        <h3 className="form-section-title">基本信息</h3>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="record_type"
              label={requiredLabel('单据类型')}
              rules={[{ required: true, message: '请选择单据类型' }]}
            >
              <Select placeholder="请选择单据类型">
                {RECORD_TYPES.map(type => (
                  <Option key={type} value={type}>{type}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="project_name"
              label={requiredLabel('工程名称')}
              rules={[{ required: true, message: '请输入工程名称' }]}
            >
              <Input placeholder="请输入工程名称" maxLength={100} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="building_location"
              label={requiredLabel('楼栋部位')}
              rules={[{ required: true, message: '请输入楼栋部位' }]}
            >
              <Input placeholder="如：1号楼-3层-机电" maxLength={100} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0 24px' }} />

        <h3 className="form-section-title">变更详情</h3>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="change_reason"
              label={requiredLabel('变更原因')}
              rules={[{ required: true, message: '请描述变更原因' }]}
            >
              <TextArea rows={3} placeholder="请描述变更原因及内容" maxLength={500} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="remark"
              label="备注"
            >
              <TextArea rows={3} placeholder="其他备注信息（可选）" maxLength={500} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0 24px' }} />

        <h3 className="form-section-title">责任与专业</h3>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="proposed_by"
              label={requiredLabel('提出单位')}
              rules={[{ required: true, message: '请选择提出单位' }]}
            >
              <Select placeholder="请选择提出单位">
                {PROPOSED_BY_OPTIONS.map(opt => (
                  <Option key={opt} value={opt}>{opt}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="specialty"
              label={requiredLabel('涉及专业')}
              rules={[{ required: true, message: '请选择涉及专业' }]}
            >
              <Select placeholder="请选择涉及专业">
                {SPECIALTIES.map(s => (
                  <Option key={s} value={s}>{s}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="estimated_cost_impact"
              label={requiredLabel('预计费用影响（元）')}
              rules={[{ required: true, message: '请输入预计费用影响，无影响填0' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="请输入金额，无影响填0"
                min={0}
                precision={2}
                step={1000}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0 24px' }} />

        <h3 className="form-section-title">流转状态</h3>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="flow_status"
              label={requiredLabel('当前流转状态')}
              rules={[{ required: true, message: '请选择流转状态' }]}
            >
              <Select placeholder="请选择流转状态">
                {FLOW_STATUSES.map(s => (
                  <Option key={s} value={s}>{s}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="receive_date"
              label={requiredLabel('收文日期')}
              rules={[{ required: true, message: '请选择收文日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="盖章/结算状态" style={{ marginBottom: 0 }}>
              <Space size="large">
                <Form.Item name="stamped" valuePropName="checked" noStyle>
                  <Radio>已盖章</Radio>
                </Form.Item>
                <Form.Item name="settled" valuePropName="checked" noStyle>
                  <Radio>已结算</Radio>
                </Form.Item>
              </Space>
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '24px 0' }} />

        <Row justify="center">
          <Space size="large">
            <Tooltip title={canSave ? '所有必填项已完整，编号已生成' : `还需完善：${missingFields.join('、')}`}>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={handleSubmit}
                loading={isGenerating}
                disabled={!canSave}
              >
                {canSave ? '保存入账' : `待完善 (${missingFields.length}项)`}
              </Button>
            </Tooltip>
            <Button
              size="large"
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置表单
            </Button>
          </Space>
        </Row>
      </Form>

      <Modal
        open={successModal.open}
        title={null}
        footer={null}
        closable={false}
        maskClosable={false}
        width={560}
      >
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          status="success"
          title="登记成功！"
          subTitle={
            <Space direction="vertical" size={4} align="center" style={{ width: '100%' }}>
              <span style={{ fontSize: 22, fontFamily: 'Consolas, monospace', color: '#0958d9', fontWeight: 600 }}>
                {successModal.record?.ledger_no}
              </span>
              <span style={{ color: '#8c8c8c' }}>
                {successModal.record?.project_name} · {successModal.record?.specialty}
              </span>
            </Space>
          }
          extra={[
            <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Button
                    block
                    type="primary"
                    size="large"
                    icon={<PaperClipOutlined />}
                    onClick={goUploadAttachment}
                  >
                    立即上传附件
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    block
                    size="large"
                    icon={<EyeOutlined />}
                    onClick={goViewDetail}
                  >
                    查看台账详情
                  </Button>
                </Col>
              </Row>
              <Button
                block
                size="large"
                icon={<PlusOutlined />}
                onClick={goAddAnother}
              >
                继续录入下一条
              </Button>
            </Space>
          ]}
        >
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col span={8}>
              <Statistic title="涉及专业" value={successModal.record?.specialty} />
            </Col>
            <Col span={8}>
              <Statistic
                title="费用影响"
                value={successModal.record?.estimated_cost_impact || 0}
                prefix="¥"
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="流转状态"
                valueRender={() => <FileDoneOutlined style={{ color: '#52c41a' }} />}
                value={successModal.record?.flow_status}
              />
            </Col>
          </Row>
        </Result>
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
          登记台账、上传附件、补齐材料、生成移交包操作均会记录此经办人
        </div>
      </Modal>
    </div>
  )
}

export default AddRecordPage
