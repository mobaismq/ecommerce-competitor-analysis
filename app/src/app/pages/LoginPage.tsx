import { useState } from "react";
import { useNavigate } from "react-router";

export function LoginPage() {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState<"password" | "sms">("password");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [accountError, setAccountError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleLogin = () => {
    let hasError = false;

    if (!account.trim()) {
      setAccountError("请输入账号名称或手机号");
      hasError = true;
    } else {
      setAccountError("");
    }

    if (!password.trim()) {
      setPasswordError("请输入密码");
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) return;

    navigate("/market/competitive/ai-collect");
  };

  const handleSendSms = () => {
    if (countdown > 0) return;
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Promotional Area */}
      <div className="w-1/2 bg-gradient-to-br from-[#e8f0fe] to-[#f0f4ff] flex flex-col justify-center items-start px-16 relative overflow-hidden">
        {/* Background decorative elements - star theme */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20">
          <div className="absolute top-10 right-10 w-40 h-40 bg-[#3388ff] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-60 h-60 bg-[#66aaff] rounded-full blur-3xl" />
        </div>

        {/* Stars decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[15%] left-[20%] w-2 h-2 bg-[#3388ff] rounded-full opacity-60 animate-pulse" />
          <div className="absolute top-[25%] left-[60%] w-1.5 h-1.5 bg-[#66aaff] rounded-full opacity-40 animate-pulse" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-[40%] left-[30%] w-1 h-1 bg-[#3388ff] rounded-full opacity-50 animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-[55%] left-[70%] w-2 h-2 bg-[#66aaff] rounded-full opacity-30 animate-pulse" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-[70%] left-[15%] w-1.5 h-1.5 bg-[#3388ff] rounded-full opacity-40 animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[80%] left-[50%] w-1 h-1 bg-[#66aaff] rounded-full opacity-50 animate-pulse" style={{ animationDelay: '0.3s' }} />
          <div className="absolute top-[10%] left-[45%] w-1 h-1 bg-[#3388ff] rounded-full opacity-30 animate-pulse" style={{ animationDelay: '0.8s' }} />
          <div className="absolute top-[60%] left-[85%] w-1.5 h-1.5 bg-[#3388ff] rounded-full opacity-40 animate-pulse" style={{ animationDelay: '1.2s' }} />
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-16 relative z-10">
          <div className="w-8 h-8 bg-[#3388ff] rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
            </svg>
          </div>
          <span className="text-[20px] font-bold text-[#0A1B39]">繁星</span>
        </div>

        {/* Main Text */}
        <div className="relative z-10">
          <h1 className="text-[48px] font-bold text-[#0A1B39] mb-4">繁星</h1>
          <p className="text-[18px] text-[#86909C] mb-8">智能电商运营助手</p>
        </div>

        {/* Phone Mockup */}
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] opacity-90">
          <div className="relative w-full h-full">
            {/* Phone body */}
            <div className="absolute bottom-0 right-10 w-[280px] h-[380px] bg-white rounded-[40px] shadow-2xl overflow-hidden">
              {/* Screen */}
              <div className="w-full h-full bg-gradient-to-b from-[#f0f4ff] to-[#e8f0fe] flex items-center justify-center">
                {/* App Icon - star themed */}
                <div className="w-[120px] h-[120px] bg-[#3388ff] rounded-[30px] flex items-center justify-center shadow-lg">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Decorative elements around phone */}
            <div className="absolute top-20 right-60 w-20 h-20 bg-[#3388ff] rounded-2xl opacity-20 rotate-12" />
            <div className="absolute bottom-40 right-80 w-16 h-16 bg-[#66aaff] rounded-xl opacity-30 -rotate-12" />
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-1/2 flex flex-col">
        {/* Login Form Container */}
        <div className="flex-1 flex items-center justify-center px-12">
          <div className="w-full max-w-[360px]">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-[28px] font-bold text-[#0A1B39] mb-2">欢迎登录</h2>
            </div>

            {/* Login Card */}
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#eef1f5] p-8">
              {/* Login Type Tabs */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setLoginType("password")}
                    className={`text-[15px] font-medium transition-colors ${
                      loginType === "password"
                        ? "text-[#0A1B39]"
                        : "text-[#86909C] hover:text-[#0A1B39]"
                    }`}
                  >
                    密码登录
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              {loginType === "password" ? (
                <>
                  <div className="mb-4">
                    <input
                      type="text"
                      value={account}
                      onChange={(e) => { setAccount(e.target.value); setAccountError(""); }}
                      placeholder="账号名称/手机号"
                      className="w-full h-[44px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                    />
                    {accountError && <p className="mt-1 text-[12px] text-[#ff4d4f]">{accountError}</p>}
                  </div>
                  <div className="mb-4">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                      placeholder="请输入登录密码"
                      className="w-full h-[44px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                    />
                    {passwordError && <p className="mt-1 text-[12px] text-[#ff4d4f]">{passwordError}</p>}
                  </div>
                  <div className="flex items-center gap-4 mb-6 text-[13px]">
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); navigate('/verify-phone?target=password'); }}
                      className="text-[#86909C] hover:text-[#3388ff] transition-colors"
                    >
                      忘记密码
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <input
                      type="text"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      placeholder="请输入手机号"
                      className="w-full h-[44px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                    />
                  </div>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value)}
                      placeholder="请输入验证码"
                      className="flex-1 h-[44px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                    />
                    <button
                      onClick={handleSendSms}
                      disabled={countdown > 0}
                      className={`h-[44px] px-4 rounded-lg text-[13px] font-medium transition-colors ${
                        countdown > 0
                          ? "bg-[#f0f2f5] text-[#86909C] cursor-not-allowed"
                          : "bg-[#3388ff] text-white hover:bg-[#1a6fe8]"
                      }`}
                    >
                      {countdown > 0 ? `${countdown}s` : "获取验证码"}
                    </button>
                  </div>
                </>
              )}

              {/* Login Button */}
              <button
                onClick={handleLogin}
                className="w-full h-[44px] rounded-full bg-[#3388ff] text-white text-[15px] font-medium hover:bg-[#1a6fe8] transition-colors shadow-[0_4px_12px_rgba(51,136,255,0.3)]"
              >
                登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
