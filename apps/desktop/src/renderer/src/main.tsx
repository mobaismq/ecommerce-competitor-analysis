import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AnalysisCollectPage } from './pages/AnalysisCollectPage'
import { ReportsListPage } from './pages/ReportsListPage'
import { AssetsPage } from './pages/AssetsPage'
import { ImageGalleryPage } from './pages/ImageGalleryPage'
import { AdminDepartmentsPage, AdminProviderProfilesPage, AdminRolesPage, AdminStoresPage, AdminTenantsPage, AdminUsersPage } from './pages/AdminListsPage'
import { VideoGalleryPage } from './pages/VideoGalleryPage'
import { ViralVideoReplicationPage } from './pages/ViralVideoReplicationPage'
import { DataAnalyticsPage } from './pages/DataAnalyticsPage'
import { DataAgentChatPage } from './pages/DataAgentChatPage'
import { AnalysisReportViewPage } from './pages/AnalysisReportViewPage'
import { ProductManagementPage } from './pages/ProductManagementPage'
import { LoginPage } from './pages/LoginPage'
import { ImageEditPage } from './pages/ImageEditPage'
import { AccountInfoPage } from './pages/AccountInfoPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { ChangePhonePage } from './pages/ChangePhonePage'
import { PhoneVerificationPage } from './pages/PhoneVerificationPage'
import { ReportProductsPage } from './pages/ReportProductsPage'
import { ProductMasterDataPage } from './pages/ProductMasterDataPage'
import { ManualListingPage } from './pages/ManualListingPage'
import { DataDownloadPage } from './pages/DataDownloadPage'
import { ProductImageSetsPage } from './pages/ProductImageSetsPage'
import { APlusDetailPage } from './pages/APlusDetailPage'
import { MarketReportPage } from './pages/MarketReportPage'
import { OneClickReplicatePage } from './pages/OneClickReplicatePage'
import { ViralReplicationPage } from './pages/ViralReplicationPage'
import { AiConfigPage } from './pages/AiConfigPage'
import { useAuth } from './store/auth'
import '@arco-design/web-react/dist/css/arco.css'
import './styles.css'

const queryClient = new QueryClient()

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuth((state) => state.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function SuperProtected({ children }: { children: React.ReactNode }) {
  const user = useAuth((state) => state.user)
  const isSuper = user?.username === 'super_admin' || user?.tenantId === 'system'
  return isSuper ? <>{children}</> : <Navigate to="/analysis/reports" replace />
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Protected><AppLayout /></Protected>}>
            <Route index element={<Navigate to="/market/competitive/ai-collect" replace />} />
            {/* 市场板块 */}
            <Route path="market/competitive/ai-collect" element={<AnalysisCollectPage />} />
            <Route path="market/competitive/report" element={<ReportsListPage />} />
            <Route path="market/competitive/report/view" element={<AnalysisReportViewPage />} />
            <Route path="market/competitive/report/products" element={<ReportProductsPage />} />
            <Route path="market/competitive/agent" element={<DataAgentChatPage />} />
            <Route path="market/market-reports" element={<MarketReportPage />} />

            {/* AIGC 板块 */}
            <Route path="product-sets" element={<ProductImageSetsPage />} />
            <Route path="aplus" element={<APlusDetailPage />} />
            <Route path="replicate" element={<ViralReplicationPage />} />
            <Route path="video-replicate" element={<ViralVideoReplicationPage />} />
            <Route path="one-click-replicate" element={<OneClickReplicatePage />} />

            {/* 资产库板块 */}
            <Route path="asset/image-gallery" element={<ImageGalleryPage />} />
            <Route path="asset/video-gallery" element={<VideoGalleryPage />} />

            {/* 商品板块 */}
            <Route path="product/master-data" element={<ProductMasterDataPage />} />
            <Route path="product/management" element={<ProductManagementPage />} />
            <Route path="product/management/manual" element={<ManualListingPage />} />

            {/* 系统设置板块 */}
            <Route path="settings/account" element={<AdminUsersPage />} />
            <Route path="settings/role" element={<AdminRolesPage />} />
            <Route path="settings/store" element={<AdminStoresPage />} />
            <Route path="settings/accounts" element={<AdminUsersPage />} />
            <Route path="settings/roles" element={<AdminRolesPage />} />
            <Route path="settings/stores" element={<AdminStoresPage />} />
            <Route path="settings/departments" element={<SuperProtected><AdminDepartmentsPage /></SuperProtected>} />
            <Route path="settings/tenants" element={<SuperProtected><AdminTenantsPage /></SuperProtected>} />
            <Route path="settings/providers" element={<SuperProtected><AdminProviderProfilesPage /></SuperProtected>} />
            <Route path="settings/account-info" element={<AccountInfoPage />} />
            <Route path="settings/ai-config" element={<AiConfigPage />} />
            <Route path="settings/change-password" element={<ChangePasswordPage />} />
            <Route path="settings/change-phone" element={<ChangePhonePage />} />
            <Route path="settings/verify-phone" element={<PhoneVerificationPage />} />

            {/* 存量旧路由别名兼容 */}
            <Route path="analysis/collect" element={<AnalysisCollectPage />} />
            <Route path="analysis/reports" element={<ReportsListPage />} />
            <Route path="analysis/reports/:id" element={<AnalysisReportViewPage />} />
            <Route path="analysis/reports/:id/products" element={<ReportProductsPage />} />
            <Route path="analysis/agent" element={<DataAgentChatPage />} />
            <Route path="analysis/market-reports" element={<MarketReportPage />} />
            <Route path="analytics" element={<DataAnalyticsPage />} />
            <Route path="data/downloads" element={<DataDownloadPage />} />
            <Route path="data/downloads/:id" element={<DataDownloadPage />} />
            <Route path="content/product-sets" element={<ProductImageSetsPage />} />
            <Route path="content/aplus" element={<APlusDetailPage />} />
            <Route path="content/image-edit" element={<ImageEditPage />} />
            <Route path="content/replicate" element={<ViralReplicationPage />} />
            <Route path="content/video-replicate" element={<ViralVideoReplicationPage />} />
            <Route path="content/one-click-replicate" element={<OneClickReplicatePage />} />
            <Route path="products/master-data" element={<ProductMasterDataPage />} />
            <Route path="products/management" element={<ProductManagementPage />} />
            <Route path="products/management/manual" element={<ManualListingPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="assets/images" element={<ImageGalleryPage />} />
            <Route path="assets/videos" element={<VideoGalleryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
