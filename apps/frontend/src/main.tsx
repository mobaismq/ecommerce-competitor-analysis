import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AnalysisCollectPage } from './pages/AnalysisCollectPage'
import { ReportsListPage } from './pages/ReportsListPage'
import { AssetsPage } from './pages/AssetsPage'
import { AdminProviderProfilesPage, AdminRolesPage, AdminStoresPage, AdminTenantsPage, AdminUsersPage } from './pages/AdminListsPage'
import { StubPage } from './pages/StubPages'
import { VideoGalleryPage, VideoReplicatePage } from './pages/VideoPages'
import { DataAnalyticsPage } from './pages/DataAnalyticsPage'
import { LoginPage } from './pages/LoginPage'
import { useAuth } from './store/auth'
import './styles.css'

const queryClient = new QueryClient()

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuth((state) => state.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Protected><AppLayout /></Protected>}>
            <Route index element={<Navigate to="/analysis/reports" replace />} />
            <Route path="analysis/collect" element={<AnalysisCollectPage />} />
            <Route path="analysis/reports" element={<ReportsListPage />} />
            <Route path="analysis/reports/:id" element={<StubPage title="报告详情" />} />
            <Route path="analysis/reports/:id/products" element={<StubPage title="报告商品" />} />
            <Route path="analysis/agent" element={<StubPage title="数据 Agent" />} />
            <Route path="analysis/market-reports" element={<StubPage title="市场报告" />} />
            <Route path="analytics" element={<DataAnalyticsPage />} />
            <Route path="data/downloads" element={<StubPage title="数据下载" />} />
            <Route path="data/downloads/:id" element={<StubPage title="数据下载详情" />} />
            <Route path="content/product-sets" element={<StubPage title="图片生成" />} />
            <Route path="content/aplus" element={<StubPage title="详情图" />} />
            <Route path="content/replicate" element={<StubPage title="一键复刻" />} />
            <Route path="content/video-replicate" element={<VideoReplicatePage />} />
            <Route path="content/one-click-replicate" element={<VideoReplicatePage />} />
            <Route path="products/master-data" element={<StubPage title="商品主档" />} />
            <Route path="products/management" element={<StubPage title="平台商品" />} />
            <Route path="products/management/manual" element={<StubPage title="手动发布" />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="assets/images" element={<AssetsPage />} />
            <Route path="assets/videos" element={<VideoGalleryPage />} />
            <Route path="settings/accounts" element={<AdminUsersPage />} />
            <Route path="settings/roles" element={<AdminRolesPage />} />
            <Route path="settings/stores" element={<AdminStoresPage />} />
            <Route path="settings/tenants" element={<AdminTenantsPage />} />
            <Route path="settings/providers" element={<AdminProviderProfilesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
