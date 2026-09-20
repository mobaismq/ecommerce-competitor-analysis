import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../store/auth'

const REMEMBER_USERNAME_KEY = 'eca.remember_username'
const REMEMBER_PASSWORD_KEY = 'eca.remember_password'
const REMEMBER_FLAG_KEY = 'eca.remember_flag'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuth((state) => state.login)

  // 默认一直记住账号（未存过则默认为 admin）
  const [username, setUsername] = useState(() => {
    return localStorage.getItem(REMEMBER_USERNAME_KEY) || 'admin'
  })
  // 是否记住密码（默认为勾选状态）
  const [rememberPassword, setRememberPassword] = useState(() => {
    return localStorage.getItem(REMEMBER_FLAG_KEY) !== 'false'
  })
  // 密码：如果开启记住密码则自动读取
  const [password, setPassword] = useState(() => {
    if (localStorage.getItem(REMEMBER_FLAG_KEY) !== 'false') {
      return localStorage.getItem(REMEMBER_PASSWORD_KEY) || ''
    }
    return ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 登录逻辑保持桌面端现状：useAuth.login + 记住密码持久化
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(username, password)
      // 登录成功：持久化账号（默认一直记住）
      localStorage.setItem(REMEMBER_USERNAME_KEY, username)
      localStorage.setItem(REMEMBER_FLAG_KEY, String(rememberPassword))
      if (rememberPassword) {
        localStorage.setItem(REMEMBER_PASSWORD_KEY, password)
      } else {
        localStorage.removeItem(REMEMBER_PASSWORD_KEY)
      }
      navigate('/analysis/reports', { replace: true })
    } catch {
      setError('登录失败，请检查账号密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* ─── 左侧宣传区（对照旧版渐变+星点+Logo+手机 mockup） ─── */}
      <div className="relative flex w-1/2 flex-col items-start justify-center overflow-hidden bg-gradient-to-br from-[#e8f0fe] to-[#f0f4ff] px-16">
        {/* 背景光斑 */}
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-20">
          <div className="absolute right-10 top-10 h-40 w-40 rounded-full bg-[#3388ff] blur-3xl" />
          <div className="absolute bottom-20 right-20 h-60 w-60 rounded-full bg-[#66aaff] blur-3xl" />
        </div>

        {/* 星点装饰 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[
            ['15%', '20%', 'w-2 h-2', 'opacity-60', '0s'],
            ['25%', '60%', 'w-1.5 h-1.5', 'opacity-40', '0.5s'],
            ['40%', '30%', 'w-1 h-1', 'opacity-50', '1s'],
            ['55%', '70%', 'w-2 h-2', 'opacity-30', '1.5s'],
            ['70%', '15%', 'w-1.5 h-1.5', 'opacity-40', '2s'],
            ['80%', '50%', 'w-1 h-1', 'opacity-50', '0.3s'],
            ['10%', '45%', 'w-1 h-1', 'opacity-30', '0.8s'],
            ['60%', '85%', 'w-1.5 h-1.5', 'opacity-40', '1.2s'],
          ].map(([top, left, size, opacity, delay], i) => (
            <div
              key={i}
              className={`absolute animate-pulse rounded-full bg-[#3388ff] ${size} ${opacity}`}
              style={{ top, left, animationDelay: delay }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative z-10 mb-16 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3388ff]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
            </svg>
          </div>
          <span className="text-[20px] font-bold text-[#0A1B39]">繁星</span>
        </div>

        {/* 主文案 */}
        <div className="relative z-10">
          <h1 className="mb-4 text-[48px] font-bold text-[#0A1B39]">繁星</h1>
          <p className="mb-8 text-[18px] text-[#86909C]">智能电商运营助手</p>
        </div>

        {/* 手机 mockup 装饰 */}
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] opacity-90">
          <div className="relative h-full w-full">
            <div className="absolute bottom-0 right-10 h-[380px] w-[280px] overflow-hidden rounded-[40px] bg-white shadow-2xl">
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#f0f4ff] to-[#e8f0fe]">
                <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[30px] bg-[#3388ff] shadow-lg">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="absolute right-60 top-20 h-20 w-20 rotate-12 rounded-2xl bg-[#3388ff] opacity-20" />
            <div className="absolute bottom-40 right-80 h-16 w-16 -rotate-12 rounded-xl bg-[#66aaff] opacity-30" />
          </div>
        </div>
      </div>

      {/* ─── 右侧登录区 ─── */}
      <div className="flex w-1/2 flex-col">
        <div className="flex flex-1 items-center justify-center px-12">
          <form className="w-full max-w-[360px]" onSubmit={submit}>
            <div className="mb-8">
              <h2 className="mb-2 text-[28px] font-bold text-[#0A1B39]">欢迎登录</h2>
            </div>

            <div className="rounded-2xl border border-[#eef1f5] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
              {/* 账号 */}
              <div className="mb-4">
                <input
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    localStorage.setItem(REMEMBER_USERNAME_KEY, event.target.value)
                  }}
                  autoComplete="username"
                  placeholder="账号名称/手机号"
                  required
                  className="h-[44px] w-full rounded-lg border border-[#dce3ee] bg-[#f8f9fb] px-4 text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                />
              </div>

              {/* 密码 */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    value={password}
                    onChange={(event) => {
                      const val = event.target.value
                      setPassword(val)
                      if (!val) setShowPassword(false)
                    }}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="请输入登录密码"
                    required
                    className="h-[44px] w-full rounded-lg border border-[#dce3ee] bg-[#f8f9fb] px-4 pr-10 text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                  />
                  {Boolean(password) && (
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-1 text-[#98A2B3] transition-colors hover:text-[#3388ff]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* 记住密码（桌面端业务保留） */}
              <div className="mb-6 flex items-center gap-2 text-[13px] text-[#57606a]">
                <input
                  id="remember-pwd"
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-[#3388ff]"
                />
                <label htmlFor="remember-pwd" className="cursor-pointer select-none">
                  记住密码
                </label>
              </div>

              {error && <p className="mb-3 text-center text-[12px] text-[#ff4d4f]">{error}</p>}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="h-[44px] w-full cursor-pointer rounded-full border-0 bg-[#3388ff] text-[15px] font-medium text-white shadow-[0_4px_12px_rgba(51,136,255,0.3)] transition-colors hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
