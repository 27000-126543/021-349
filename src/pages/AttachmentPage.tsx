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
  Modal,
  Popconfirm,
  Progress,
  Tooltip
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
  FileUnknownOutlined
} from '@ant-design/icons'
import { LedgerRecord, Attachment } from '../types'

const { Option } = Select

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return <FileImageOutlined style={{ color: '#52c41a' }} />
  }
  if (ext === 'pdf') return <FilePdfOutlined style={{ color: '#ff4d4f' }} />
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return <FileTextOutlined style={{ color: '#1890ff' }} />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileZipOutlined style={{ color: '#faad14' }} />
  return <FileUnknownOutlined style={{ color: '#8c8c8c' }} />
}

const AttachmentPage: React.FC = () => {
  const [records, setRecords] = useState<LedgerRecord[]>([])
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<LedgerRecord | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ visible: boolean; file: Attachment | null }>({
    visible: false,
    file: null
  })
  const dropRef = useRef<HTMLDivElement>(null)
  const [userDataPath, setUserDataPath] = useState('')

  useEffect(() => {
    loadRecords()
    loadPaths()
  }, [])

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
    if (!selectedRecordId) {
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

    for (const filePath of filePaths) {
      try {
        const fs = window.require ? (window.require('fs') as typeof import('fs')) : null
        if (!fs) continue

        const pathModule = window.require('path') as typeof import('path')
        const fileName = pathModule.basename(filePath)
        const stats = fs.statSync(filePath)

        const uniqueName = `${Date.now()}_${fileName}`
        const savedPath = await window.electronAPI.saveFileToDirectory(
          filePath,
          selectedRecord.ledger_no,
          uniqueName
        )

        const attachment: Attachment = {
          record_id: selectedRecordId,
          file_name: fileName,
          file_path: savedPath,
          file_size: stats.size,
          file_type: pathModule.extname(fileName).slice(1)
        }

        await window.electronAPI.addAttachment(attachment)
        successCount++
      } catch (error) {
        console.error('保存文件失败:', error)
        message.error(`文件 ${filePath} 保存失败`)
      }
    }

    setUploading(false)
    if (successCount > 0) {
      message.success(`成功归档 ${successCount} 个文件`)
      loadAttachments(selectedRecordId)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!selectedRecordId) {
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
      await window.electronAPI.deleteAttachmentFile(att.id!, att.file_path)
      message.success('已删除附件')
      loadAttachments(selectedRecordId!)
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
      const pathModule = window.require('path') as typeof import('path')
      const targetDir = pathModule.join(userDataPath, 'attachments', selectedRecord.ledger_no)
      await window.electronAPI.openFolder(targetDir)
    } catch (error) {
      message.error('打开文件夹失败')
    }
  }

  return (
    <div className="page-card">
      <h2 className="page-title">附件归档</h2>

      <Row gutter={20} style={{ height: 'calc(100vh - 200px)' }}>
        <Col span={8} style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Card
            title="选择台账记录"
            size="small"
            style={{ marginBottom: 12 }}
            bodyStyle={{ padding: 12 }}
          >
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
                      <Tag color={r.record_type === '设计变更' ? 'blue' : r.record_type === '工程洽商' ? 'green' : 'orange'}>
                        {r.record_type}
                      </Tag>
                    </div>
                    <div style={{ color: '#595959', fontSize: 12 }}>
                      {r.project_name} {r.building_location ? `· ${r.building_location}` : ''}
                    </div>
                  </Space>
                </Option>
              ))}
            </Select>
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
            onClick={handleFileSelect}
          >
            {!selectedRecord ? (
              <>
                <div className="drop-zone-icon" style={{ color: '#d9d9d9' }}>
                  <InboxOutlined />
                </div>
                <p style={{ color: '#8c8c8c', margin: 0 }}>请先在上方选择一条台账记录</p>
                <p style={{ color: '#bfbfbf', fontSize: 12, marginTop: 4 }}>选中后即可拖入或点击上传附件</p>
              </>
            ) : (
              <>
                <div className="drop-zone-icon" style={{ color: isDragging ? '#1677ff' : '#bfbfbf' }}>
                  <InboxOutlined />
                </div>
                <p style={{ fontWeight: 500, margin: 0 }}>
                  {isDragging ? '释放文件即可归档' : '将扫描件拖入此处或点击选择'}
                </p>
                <p style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                  支持 PDF、图片、Word、Excel 等格式
                </p>
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

        <Col span={16} style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selectedRecord ? (
            <>
              <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Descriptions column={3} size="small">
                    <Descriptions.Item label="台账编号">
                      <span className="ledger-no-display">{selectedRecord.ledger_no}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="工程名称">{selectedRecord.project_name}</Descriptions.Item>
                    <Descriptions.Item label="专业/类型">
                      {selectedRecord.specialty} / {selectedRecord.record_type}
                    </Descriptions.Item>
                  </Descriptions>
                  <Button icon={<FolderOpenOutlined />} onClick={handleOpenFolder}>
                    打开归档文件夹
                  </Button>
                </div>
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
                style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, overflow: 'auto', padding: 12 }}
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
                  <List
                    dataSource={attachments}
                    renderItem={(item) => (
                      <List.Item
                        key={item.id}
                        actions={[
                          <Tooltip key="path" title={item.file_path}>
                            <Button
                              type="link"
                              size="small"
                              icon={<FolderOpenOutlined />}
                              onClick={() => {
                                const pathModule = window.require('path') as typeof import('path')
                                window.electronAPI.openFolder(pathModule.dirname(item.file_path))
                              }}
                            >
                              所在目录
                            </Button>
                          </Tooltip>,
                          <Popconfirm
                            key="del"
                            title="确定删除此附件吗？"
                            onConfirm={() => handleDeleteAttachment(item)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <span style={{ fontSize: 32 }}>
                              {getFileIcon(item.file_name)}
                            </span>
                          }
                          title={
                            <span>
                              {item.file_name}
                              <Tag style={{ marginLeft: 8 }}>{item.file_type?.toUpperCase() || 'FILE'}</Tag>
                            </span>
                          }
                          description={
                            <Space>
                              <span style={{ color: '#8c8c8c' }}>{formatFileSize(item.file_size)}</span>
                              <span style={{ color: '#bfbfbf' }}>·</span>
                              <span style={{ color: '#8c8c8c' }}>归档于 {item.created_at}</span>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </>
          ) : (
            <Card
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Empty description="请在左侧选择台账记录以查看和管理附件" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={previewModal.file?.file_name}
        open={previewModal.visible}
        onCancel={() => setPreviewModal({ visible: false, file: null })}
        footer={null}
        width={800}
      >
        {previewModal.file && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#8c8c8c' }}>
              文件位置：{previewModal.file.file_path}
            </p>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={() => {
                const pathModule = window.require('path') as typeof import('path')
                window.electronAPI.openFolder(pathModule.dirname(previewModal.file!.file_path))
              }}
            >
              打开文件所在目录
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AttachmentPage
