type CreateUser = (input: { email: string; password: string; email_confirm: true }) => Promise<{ error: unknown }>

export async function registerUser(body: unknown, createUser: CreateUser, code = process.env.REGISTRATION_CODE || "pxmxmp") {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {}
  if (typeof input.code !== "string" || input.code !== code) {
    return { status: 403, error: "注册码不正确" }
  }
  const { email, password } = input
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" || password.length < 6 || password.length > 72) {
    return { status: 400, error: "请输入有效的邮箱和 6 至 72 位密码" }
  }
  try {
    const { error } = await createUser({ email, password, email_confirm: true })
    if (error) return { status: 400, error: "注册失败，邮箱可能已被使用或密码不符合要求" }
    return { status: 200 }
  } catch {
    return { status: 500, error: "注册服务暂时不可用" }
  }
}
