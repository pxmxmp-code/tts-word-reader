"use client"

import { useEffect, useState, type ReactNode } from "react"
import type { User } from "@supabase/supabase-js"
import { browserDb } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Headphones, Sparkles, BookOpen, Lock, Mail, Loader2, ArrowRight } from "lucide-react"

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [registering, setRegistering] = useState(false)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const db = browserDb()
    db.auth.getUser().then(({ data }) => { setUser(data.user); setChecking(false) })
      .catch(() => setChecking(false))
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      if (registering) {
        const response = await fetch("/api/register", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, code }),
        })
        const result = await response.json()
        if (!response.ok) { setError(result.error || "注册失败，请稍后重试"); return }
        setRegistering(false)
        setCode("")
        setMessage("注册成功，请使用邮箱和密码登录")
      } else {
        const { error } = await browserDb().auth.signInWithPassword({ email, password })
        if (error) setError("登录失败，请检查邮箱和密码是否正确")
      }
    } catch {
      setError("请求失败，请稍后重试")
    } finally {
      setBusy(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Headphones className="h-8 w-8 text-primary" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary/30 to-sky-400/30 blur-lg -z-10" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
          正在载入阅读工作台…
        </p>
      </div>
    )
  }

  if (user) return <>{children}</>

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Ambient background glow decoration */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-10 -z-10 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand identity */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/25 ring-1 ring-white/20">
            <Headphones className="h-7 w-7" />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white ring-2 ring-background">
              <Sparkles className="h-3 w-3" />
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              言读 <span className="text-primary font-normal text-xl sm:text-2xl">ReadFlow</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              智能文档解析 · 逐句伴读与拟真人声朗读
            </p>
          </div>
        </div>

        {/* Feature Highlights Pills */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 rounded-lg border bg-card/60 p-2 backdrop-blur-sm">
            <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Word / PDF / OCR 深度解析</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border bg-card/60 p-2 backdrop-blur-sm">
            <Headphones className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">逐句高亮与多端进度同步</span>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-black/5 dark:shadow-black/20 sm:p-8">
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-1 text-left">
              <h2 className="text-lg font-semibold text-foreground">{registering ? "创建账号" : "欢迎使用"}</h2>
              <p className="text-xs text-muted-foreground">{registering ? "请输入邮箱、密码和注册码" : "请输入邮箱及密码登录"}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  账号邮箱
                </label>
                <div className="relative">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  {registering ? "设置密码" : "登录密码"}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoComplete={registering ? "new-password" : "current-password"}
                    minLength={registering ? 6 : undefined}
                    maxLength={registering ? 72 : undefined}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {registering && (
              <div className="space-y-1.5">
                <label htmlFor="registration-code" className="text-xs font-medium text-foreground/80">注册码</label>
                <input id="registration-code" type="password" required value={code} onChange={(event) => setCode(event.target.value)}
                  className="w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            )}
            {message && <p role="status" className="text-xs text-emerald-600">{message}</p>}
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive animate-in fade-in"
              >
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl font-medium gap-2 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{registering ? "正在注册…" : "正在登录…"}</span>
                </>
              ) : (
                <>
                  <span>{registering ? "注册账号" : "进入工作台"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          <button type="button" disabled={busy} onClick={() => { setRegistering(!registering); setError(""); setMessage("") }}
            className="mt-4 w-full text-center text-xs text-primary hover:underline disabled:opacity-50">
            {registering ? "已有账号？去登录" : "没有账号？使用注册码注册"}
          </button>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-muted-foreground">
          基于 Supabase 鉴权与私有存储
        </p>
      </div>
    </main>
  )
}
