import assert from "node:assert/strict"
import test from "node:test"
import { readAllRows } from "./paginatedQuery.ts"

test("分页读取超过 1000 条，并适应更小的服务端返回上限", async () => {
  const rows = Array.from({ length: 2501 }, (_, id) => ({ id }))
  for (const cap of [1000, 300]) {
    const actual = await readAllRows(async (start, end) => ({
      data: rows.slice(start, Math.min(end + 1, start + cap)), error: null,
    }))
    assert.deepEqual(actual, rows)
  }
})

test("后续页查询失败时抛出错误，不返回不完整的路径列表", async () => {
  const error = new Error("数据库断开")
  await assert.rejects(readAllRows(async (start) => start === 0
    ? { data: [{ id: 1 }], error: null }
    : { data: null, error }), /数据库断开/)
})
