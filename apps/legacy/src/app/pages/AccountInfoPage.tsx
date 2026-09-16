import { useState } from "react";
import { useNavigate } from "react-router";

export function AccountInfoPage() {
  const navigate = useNavigate();
  const [accountName] = useState("天天向辉");
  const [phone] = useState("136******46");
  const [password] = useState("••••••••");

  return (
    <div className="min-h-screen bg-[#f4f7fb] p-8">
      <div className="max-w-[600px] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-[24px] font-bold text-[#0A1B39] mb-8">账号信息</h1>
          
          <div className="space-y-6">
            {/* 账号名 */}
            <div className="flex items-center justify-between py-4 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-[#86909C] w-[100px]">账号名称</span>
                <span className="text-[14px] text-[#0A1B39] font-medium">{accountName}</span>
              </div>
            </div>

            {/* 绑定手机 */}
            <div className="flex items-center justify-between py-4 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-[#86909C] w-[100px]">绑定手机号</span>
                <span className="text-[14px] text-[#0A1B39] font-medium">{phone}</span>
              </div>
              <button
                onClick={() => navigate('/verify-phone?target=phone')}
                className="w-[100px] py-1.5 text-[13px] text-[#3388ff] border border-[#3388ff] rounded hover:bg-[#f0f7ff] transition-colors"
              >
                修改手机号
              </button>
            </div>

            {/* 登录密码 */}
            <div className="flex items-center justify-between py-4 border-b border-[#f0f2f5]">
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-[#86909C] w-[100px]">登录密码</span>
                <span className="text-[14px] text-[#0A1B39] font-medium">{password}</span>
              </div>
              <button
                onClick={() => navigate('/verify-phone?target=password')}
                className="w-[100px] py-1.5 text-[13px] text-[#3388ff] border border-[#3388ff] rounded hover:bg-[#f0f7ff] transition-colors"
              >
                修改密码
              </button>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => window.history.back()}
              className="px-8 py-2.5 bg-[#3388ff] text-white text-[14px] font-medium rounded-lg hover:bg-[#1a6fe8] transition-colors"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
