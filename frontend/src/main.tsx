import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return <main style={{ fontFamily: 'system-ui', padding: 40 }}><h1>电商竞品分析系统</h1><p>新前端工程已就绪，等待业务模块接入。</p></main>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></React.StrictMode>)
