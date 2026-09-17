import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MorphIcon } from 'morphicons/react'
import { Eye, EyeOff } from 'lucide'
import { useAuth } from '../store/auth'

const REMEMBER_USERNAME_KEY = 'eca.remember_username'
const REMEMBER_PASSWORD_KEY = 'eca.remember_password'
const REMEMBER_FLAG_KEY = 'eca.remember_flag'

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuth((state) => state.login)

  // 默认一直记住账号（未存过则默认为 admin）
  const [username, setUsername] = useState(() => {
    return localStorage.getItem(REMEMBER_USERNAME_KEY) ?? 'admin'
  })

  // 是否记住密码（默认为勾选状态）
  const [rememberPassword, setRememberPassword] = useState(() => {
    const savedFlag = localStorage.getItem(REMEMBER_FLAG_KEY)
    return savedFlag === null ? true : savedFlag === 'true'
  })

  // 密码：如果开启记住密码则自动读取
  const [password, setPassword] = useState(() => {
    return localStorage.getItem(REMEMBER_PASSWORD_KEY) ?? ''
  })

  // 是否显示明文密码
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>电商竞品分析</h1>
        <label>
          账号
          <input
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              localStorage.setItem(REMEMBER_USERNAME_KEY, event.target.value)
            }}
            autoComplete="username"
            placeholder="请输入账号"
            required
          />
        </label>
        <label>
          密码
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              value={password}
              onChange={(event) => {
                const val = event.target.value
                setPassword(val)
                if (!val) setShowPassword(false)
              }}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="请输入密码"
              required
              style={{ width: '100%', paddingRight: password ? '38px' : '10px' }}
            />
            {Boolean(password) && (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                title={showPassword ? '隐藏密码' : '显示密码'}
                style={{
                  position: 'absolute',
                  right: '4px',
                  background: 'transparent',
                  border: 'none',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#656d76',
                  borderRadius: '4px',
                }}
              >
                <MorphIcon icon={showPassword ? EyeOff : Eye} size={18} spring="snappy" />
              </button>
            )}
          </div>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#57606a', marginTop: '-4px' }}>
          <input
            id="remember-pwd"
            type="checkbox"
            checked={rememberPassword}
            onChange={(e) => setRememberPassword(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
          />
          <label htmlFor="remember-pwd" style={{ cursor: 'pointer', userSelect: 'none', display: 'inline' }}>
            记住密码
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
      </form>
    </div>
  )
}
