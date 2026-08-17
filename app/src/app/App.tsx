import { RouterProvider } from "react-router";
import { useEffect, useState } from "react";
import { router } from "./routes";

type AuthState =
  | { status: "checking" }
  | { status: "authenticated"; username: string }
  | { status: "anonymous"; error?: string };

function LoginGate() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refreshSession() {
    try {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      const payload = await response.json();
      if (payload.authenticated) {
        setAuth({ status: "authenticated", username: payload.user?.username || "admin" });
      } else {
        setAuth({ status: "anonymous" });
      }
    } catch {
      setAuth({ status: "anonymous", error: "后端服务未启动或无法连接" });
    }
  }

  useEffect(() => {
    refreshSession();
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setAuth({ status: "anonymous", error: payload.error || "登录失败" });
        return;
      }
      setAuth({ status: "authenticated", username: payload.user?.username || username });
    } catch {
      setAuth({ status: "anonymous", error: "后端服务未启动或无法连接" });
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.status === "checking") {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="auth-muted">正在检查登录状态...</p>
        </section>
      </main>
    );
  }

  if (auth.status !== "authenticated") {
    return (
      <main className="auth-page">
        <form className="auth-panel" onSubmit={handleLogin}>
          <div>
            <h1>电商竞品分析系统</h1>
            <p className="auth-muted">请输入管理员账号后继续。</p>
          </div>
          <label>
            <span>账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {auth.error ? <p className="auth-error">{auth.error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "登录中..." : "登录"}
          </button>
        </form>
      </main>
    );
  }

  return <RouterProvider router={router} />;
}

export default function App() {
  return <LoginGate />;
}
