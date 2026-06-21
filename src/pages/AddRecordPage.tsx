import React, { useState, useEffect } from 'react'
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
  Divider
} from 'antd'
import { CheckCircleOutlined, ExclamationCircleOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { RECORD_TYPES, SPECIALTIES, FLOW_STATUSES, PROPOSED_BY_OPTIONS, LedgerRecord } from '../types'

const { TextArea } = Input
const { Option } = Select

const AddRecordPage: React.FC = () => {
  const [form] = Form.useForm()
  const [ledgerNo, setLedgerNo] = useState<string>('')
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const requiredFields = ['record_type', 'project_name', 'specialty', 'flow_status', 'receive_date']

  const fieldLabels: Record<string, string> = {
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

  const generateNo = async (values: any) => {
    if (values.record_type && values.project_name) {
      setIsGenerating(true)
      try {
        const no = await window.electronAPI.generateLedgerNo(values.record_type, values.project_name)
        setLedgerNo(no)
      } catch (error) {
        console.error('生成编号失败:', error)
      } finally {
        setIsGenerating(false)
      }
    } else {
      setLedgerNo('')
    }
  }

  const checkRequiredFields = (values: any) => {
    const missing: string[] = []
    requiredFields.forEach(field => {
      if (!values[field]) {
        missing.push(fieldLabels[field] || field)
      }
    })
    setMissingFields(missing)
  }

  useEffect(() => {
    generateNo(form.getFieldsValue())
  }, [])

  const onValuesChange = (changedValues: any, allValues: any) => {
    checkRequiredFields(allValues)
    if (changedValues.record_type || changedValues.project_name) {
      generateNo(allValues)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (!ledgerNo) {
        message.error('台账编号未生成，请先填写单据类型和工程名称')
        return
      }

      const record: LedgerRecord = {
        ...values,
        ledger_no: ledgerNo,
        stamped: values.stamped ? 1 : 0,
        settled: values.settled ? 1 : 0,
        receive_date: values.receive_date ? dayjs(values.receive_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
      }

      const id = await window.electronAPI.addRecord(record)
      if (id) {
        message.success(`登记成功！台账编号：${ledgerNo}`)
        form.resetFields()
        form.setFieldsValue({
          receive_date: dayjs(),
          stamped: false,
          settled: false
        })
        setLedgerNo('')
        setMissingFields([])
      }
    } catch (error) {
      console.error('提交失败:', error)
    }
  }

  const handleReset = () => {
    form.resetFields()
    form.setFieldsValue({
      receive_date: dayjs(),
      stamped: false,
      settled: false
    })
    setLedgerNo('')
    setMissingFields([])
  }

  return (
    <div className="page-card">
      <h2 className="page-title">新增登记</h2>

      <Card style={{ marginBottom: 20, background: '#f9f9f9' }}>
        <Row align="middle" gutter={16}>
          <Col>
            <span style={{ fontSize: 14, color: '#595959' }}>台账编号：</span>
            {ledgerNo ? (
              <span className="ledger-no-display">{ledgerNo}</span>
            ) : (
              <Tag color="default">请先选择单据类型和工程名称</Tag>
            )}
          </Col>
          <Col flex="auto">
            {missingFields.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                icon={<ExclamationCircleOutlined />}
                message={`待完善必填项：${missingFields.join('、')}`}
                style={{ border: 'none', padding: 0, background: 'transparent' }}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message="必填项已完整"
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
      >
        <h3 className="form-section-title">基本信息</h3>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="record_type"
              label="单据类型"
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
              label="工程名称"
              rules={[{ required: true, message: '请输入工程名称' }]}
            >
              <Input placeholder="请输入工程名称" maxLength={100} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="building_location"
              label="楼栋部位"
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
              label="变更原因"
            >
              <TextArea rows={3} placeholder="请描述变更原因及内容" maxLength={500} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="remark"
              label="备注"
            >
              <TextArea rows={3} placeholder="其他备注信息" maxLength={500} />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0 24px' }} />

        <h3 className="form-section-title">责任与专业</h3>
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="proposed_by"
              label="提出单位"
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
              label="涉及专业"
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
              label="预计费用影响（元）"
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="请输入金额"
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
              label="当前流转状态"
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
              label="收文日期"
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
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSubmit}
              loading={isGenerating}
            >
              保存登记
            </Button>
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
    </div>
  )
}

export default AddRecordPage
