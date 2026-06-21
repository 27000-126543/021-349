import React, { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import {
  FileAddOutlined,
  SearchOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import AddRecordPage from './pages/AddRecordPage'
import QueryPage from './pages/QueryPage'
import AttachmentPage from './pages/AttachmentPage'

const App: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    {
      key: '/add',
      icon: <FileAddOutlined />,
      label: '新增登记'
    },
    {
      key: '/query',
      icon: <SearchOutlined />,
      label: '台账查询'
    },
    {
      key: '/attachment',
      icon: <FolderOpenOutlined />,
      label: '附件归档'
    }
  ]

  const selectedKey = location.pathname === '/' ? '/add' : location.pathname

  return (
    <div className="app-layout">
      <div className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>变更洽商台账管理系统</h1>
        <Menu
          mode="horizontal"
          theme="dark"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            border: 'none',
            minWidth: 400
          }}
        />
      </div>
      <div className="app-content">
        <Routes>
          <Route path="/" element={<AddRecordPage />} />
          <Route path="/add" element={<AddRecordPage />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/attachment" element={<AttachmentPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
