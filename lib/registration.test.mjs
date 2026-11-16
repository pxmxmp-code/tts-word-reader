import { test, expect } from "bun:test"
import { registerUser } from "./registration.ts"

let calls = []
const createUser = async (input) => { calls.push(input); return { error: null } }

test("注册必须提供正确的注册码", async () => {
  calls = []
  const result = await registerUser({ email: "user@example.com", password: "12345678", code: "wrong" }, createUser, "pxmxmp")
  expect(result.status).toBe(403)
  expect(calls).toHaveLength(0)
})

test("正确注册码创建已确认邮箱的用户", async () => {
  calls = []
  const result = await registerUser({ email: "user@example.com", password: "12345678", code: "pxmxmp" }, createUser, "pxmxmp")
  expect(result.status).toBe(200)
  expect(calls).toEqual([{ email: "user@example.com", password: "12345678", email_confirm: true }])
})

test("拒绝无效账号信息", async () => {
  calls = []
  const result = await registerUser({ email: "bad", password: "123", code: "pxmxmp" }, createUser, "pxmxmp")
  expect(result.status).toBe(400)
  expect(calls).toHaveLength(0)
})
