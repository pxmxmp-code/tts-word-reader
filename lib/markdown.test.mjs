import assert from "node:assert/strict"
import test from "node:test"
import { parseHTML } from "linkedom"
import { markdownToHtml, textToHtml } from "./markdown.ts"

test("保留 MinerU HTML 表格供 DOMPurify 清理和展示", () => {
  const table = "<table><tr><td>问题主题</td><td>页码</td></tr></table>"
  const html = markdownToHtml(table)
  assert.match(html, /<table>/)
  assert.match(html, /<td>问题主题<\/td>/)
  assert.equal(html.includes("&lt;table"), false)
})

test("TXT 保留标签、Markdown 符号和换行，且不会插入可执行 HTML", () => {
  const source = '模板：<name> & **原文**。\n<script>alert("x")</script>\n\n下一行。'
  const { document } = parseHTML("<html><body></body></html>")
  const root = document.createElement("div")
  root.innerHTML = textToHtml(source)
  assert.equal(root.textContent, source)
  assert.equal(root.querySelector("script"), null)
  assert.ok(root.firstElementChild.classList.contains("whitespace-pre-wrap"))
})

test("MinerU 图片只使用已授权的资产地址", () => {
  const html = markdownToHtml("![示例](images/a.png) ![未知](missing.png)",
    new Map([["images/a.png", "https://example.com/signed.png"]]))
  assert.match(html, /src="https:\/\/example.com\/signed.png"/)
  assert.equal(html.includes("src=\"missing.png\""), false)
})
