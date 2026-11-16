import assert from "node:assert/strict"
import { afterEach, mock, test } from "bun:test"

let db
mock.module("server-only", () => ({}))
mock.module("@/lib/supabase/server", () => ({ adminDb: () => db, currentUser: async () => ({ id: "owner" }) }))
mock.module("@/lib/mineruServer", () => ({ getMinerUServerConfig: () => ({ base: "https://mineru.test", token: "test" }) }))
const { DELETE: clearAudio } = await import("../app/api/audio-cache/route.ts")
const { DELETE: deleteDocument } = await import("../app/api/documents/[id]/route.ts")
const { refreshMineruJob } = await import("./mineruJob.ts")
const { POST: processDocument } = await import("../app/api/documents/[id]/process/route.ts")
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function database(tables, failedTable, source = "") {
  const removed = { audio: [], documents: [] }
  const operations = []
  return {
    tables, removed, operations,
    storage: { from: (bucket) => ({ download: async () => ({ data: new Blob([source]), error: null }), remove: async (paths) => {
      removed[bucket].push(...paths)
      return { error: null }
    } }) },
    from(table) {
      let action = "select"
      let values
      let single = false
      let start = 0
      let end = 999
      let sortKey
      const filters = []
      const query = {
        select() { return query },
        eq(key, value) { filters.push((row) => row[key] === value); return query },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query },
        order(key) { sortKey = key; return query },
        range(first, last) { start = first; end = last; return query },
        update(next) { action = "update"; values = next; return query },
        delete() { action = "delete"; return query },
        maybeSingle() { single = true; return query },
        then(resolve, reject) {
          operations.push({ table, action })
          if (table === failedTable) return Promise.resolve({ data: null, error: new Error("read failed") }).then(resolve, reject)
          let rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)))
          if (action === "update") rows.forEach((row) => Object.assign(row, values))
          if (action === "delete") tables[table] = tables[table].filter((row) => !rows.includes(row))
          if (action === "select") {
            if (sortKey) rows.sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey])))
            rows = rows.slice(start, Math.min(end + 1, start + 1000))
            rows = rows.map((row) => ({ ...row }))
          }
          return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
}

test("TXT 解析接口保存转义后的纯文本，而 Markdown 仍保留格式", async () => {
  const source = "模板：<name> & **原文**。\n下一行。"
  for (const sourceType of ["text", "markdown"]) {
    db = database({ documents: [{ id: "doc", user_id: "owner", name: "sample.txt", source_type: sourceType, status: "uploading", source_path: "source", file_size: new Blob([source]).size }] }, undefined, source)
    const response = await processDocument(new Request("https://reader.test"), { params: Promise.resolve({ id: "doc" }) })
    assert.equal(response.status, 200)
    assert.equal(db.tables.documents[0].status, "ready")
    assert.equal(db.tables.documents[0].markdown, source)
    if (sourceType === "text") {
      assert.ok(db.tables.documents[0].html.includes("&lt;name&gt;"))
      assert.ok(db.tables.documents[0].html.includes("**原文**"))
    } else {
      assert.ok(db.tables.documents[0].html.includes("<strong>原文</strong>"))
    }
  }
})

test("清空音频缓存会删除全部 1501 个文件，并保留其他账号缓存", async () => {
  const own = Array.from({ length: 1501 }, (_, id) => ({ user_id: "owner", storage_path: `audio/${id}` }))
  const other = { user_id: "other", storage_path: "other/file" }
  db = database({ audio_cache: [...own, other] })
  const response = await clearAudio(new Request("https://reader.test/api/audio-cache", { method: "DELETE", body: "{}" }))
  assert.equal(response.status, 200)
  assert.equal(db.removed.audio.length, own.length)
  assert.deepEqual(db.tables.audio_cache, [other])
})

test("删除文档先清理超过 1000 个资产和音频，再删除文档记录", async () => {
  db = database({
    documents: [{ id: "doc", user_id: "owner", source_path: "source" }],
    document_assets: Array.from({ length: 1501 }, (_, id) => ({ document_id: "doc", path: `${id}`, storage_path: `asset/${id}` })),
    audio_cache: Array.from({ length: 1501 }, (_, id) => ({ document_id: "doc", cache_key: `${id}`, storage_path: `audio/${id}` })),
  })
  const response = await deleteDocument(new Request("https://reader.test"), { params: Promise.resolve({ id: "doc" }) })
  assert.equal(response.status, 200)
  assert.equal(db.removed.documents.length, 1502)
  assert.equal(db.removed.audio.length, 1501)
  assert.equal(db.tables.documents.length, 0)
  assert.deepEqual(db.operations.at(-1), { table: "documents", action: "delete" })
})

test("读取资产失败时不清理文件或删除文档", async () => {
  db = database({ documents: [{ id: "doc", user_id: "owner", source_path: "source" }], audio_cache: [] }, "document_assets")
  const response = await deleteDocument(new Request("https://reader.test"), { params: Promise.resolve({ id: "doc" }) })
  assert.equal(response.status, 500)
  assert.equal(db.removed.documents.length, 0)
  assert.equal(db.tables.documents.length, 1)
})

test("MinerU 等待文件超过 15 分钟后允许重试，正常排队和处理中任务不受影响", async () => {
  for (const [state, age, expected] of [
    ["waiting-file", 16, "failed"], ["waiting-file", 5, "processing"],
    ["pending", 30, "processing"], ["running", 30, "processing"],
  ]) {
    db = database({
      parse_jobs: [{ document_id: "doc", mineru_id: "batch", state: "processing", updated_at: new Date(Date.now() - age * 60_000).toISOString() }],
      documents: [{ id: "doc", status: "processing" }],
    })
    globalThis.fetch = async () => Response.json({ code: 0, data: { extract_result: [{ state }] } })
    assert.equal(await refreshMineruJob("doc"), expected)
    assert.equal(db.tables.documents[0].status, expected === "failed" ? "failed" : "processing")
  }
})

test("过期任务的刷新响应不能把新重试的任务标记为失败", async () => {
  db = database({
    parse_jobs: [{ document_id: "doc", mineru_id: "old", state: "processing", updated_at: new Date(0).toISOString() }],
    documents: [{ id: "doc", status: "processing" }],
  })
  globalThis.fetch = async () => {
    db.tables.parse_jobs[0].mineru_id = "new"
    return Response.json({ code: 0, data: { extract_result: [{ state: "waiting-file" }] } })
  }
  assert.equal(await refreshMineruJob("doc"), "processing")
  assert.equal(db.tables.parse_jobs[0].state, "processing")
  assert.equal(db.tables.documents[0].status, "processing")
})
