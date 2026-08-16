import { useState } from "react";
import { useNavigate } from "react-router";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!newPassword) {
      setError("密码不可为空");
      return;
    }

    // 6-20 位字母、数字、特殊字符（ASCII 可打印字符，不含空格）
    if (!/^[\x21-\x7E]{6,20}$/.test(newPassword)) {
      setError("密码格式错误");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    const accountId = localStorage.getItem("current_user_id") || "";
    if (!accountId) {
      setError("未获取到当前登录账号，请重新登录");
      return;
    }

    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          password: newPassword,
          updatedBy: localStorage.getItem("current_user") || "",
        }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) {
        setError(res?.error || "修改密码失败");
        return;
      }
      alert("密码修改成功");
      navigate(-1);
    } catch {
      setError("网络异常，请稍后重试");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] p-8">
      <div className="max-w-[600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-[24px] font-bold text-[#0A1B39] mb-8">修改密码</h1>

          <div className="space-y-6">
            {/* 新密码 */}
            <div className="py-4 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-[#86909C] w-[100px]">新密码</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="请输入新密码（6-20字母、数字、特殊字符）"
                  className="flex-1 h-[40px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                />
              </div>
            </div>

            {/* 确认密码 */}
            <div className="py-4 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-[#86909C] w-[100px]">确认密码</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="请再次输入新密码"
                  className="flex-1 h-[40px] px-4 rounded-lg border border-[#dce3ee] bg-[#f8f9fb] text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:bg-white focus:ring-2 focus:ring-[#d8ebff]"
                />
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
