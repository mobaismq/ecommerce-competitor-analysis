import { useState } from "react";
import { useNavigate } from "react-router";

export function ChangePhonePage() {
  const navigate = useNavigate();
  const [newPhone, setNewPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  const handleSendSms = () => {
    if (countdown > 0) return;
    if (!newPhone || !/^1\d{10}$/.test(newPhone)) {
      setError("请输入正确的手机号");
      return;
    }
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
    // TODO: 调用短信发送接口
    console.log("发送短信验证码到:", newPhone);
  };

  const handleSubmit = () => {
    if (!newPhone || !/^1\d{10}$/.test(newPhone)) {
      setError("请输入正确的手机号");
      return;
    }

    if (!smsCode || !/^\d{4,6}$/.test(smsCode)) {
      setError("请正确输入短信验证码");
      return;
    }

    setError("");
    // TODO: 调用修改手机号接口
    console.log("修改手机号:", newPhone, "验证码:", smsCode);
    alert("手机号修改成功");
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] p-8">
      <div className="max-w-[600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-[24px] font-bold text-[#0A1B39] mb-8">修改手机号</h1>

          <div className="space-y-6">
            {/* 新手机号 */}
            <div className="py-4 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-[#86909C] w-[100px]">新手机号</span>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="请输入新手机号"
                  className="flex-1 h-[40px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                  maxLength={11}
                />
              </div>
            </div>

            {/* 验证码 */}
            <div className="py-4 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-[#86909C] w-[100px]">验证码</span>
                <input
                  type="text"
                  value={smsCode}
                  onChange={(e) => {
                    setSmsCode(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="请输入短信验证码"
                  className="flex-1 h-[40px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                  maxLength={6}
                />
                <button
                  onClick={handleSendSms}
                  disabled={countdown > 0}
                  className={`h-[40px] px-6 text-[13px] font-medium rounded-lg border transition-colors shrink-0 ${
                    countdown > 0
                      ? "border-[#dce3ee] text-[#86909C] bg-[#f8f9fb] cursor-not-allowed"
                      : "border-[#3388ff] text-[#3388ff] hover:bg-[#f0f7ff]"
                  }`}
                >
                  {countdown > 0 ? `${countdown}s` : "获取短信验证码"}
                </button>
              </div>
              {error && (
                <p className="ml-[100px] mt-2 text-[12px] text-[#ff4d4f]">{error}</p>
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleSubmit}
              className="px-12 py-2.5 bg-[#3388ff] text-white text-[14px] font-medium rounded-lg hover:bg-[#1a6fe8] transition-colors"
            >
              确认修改
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              onClick={() => navigate(-1)}
              className="text-[14px] text-[#3388ff] hover:underline transition-colors"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
