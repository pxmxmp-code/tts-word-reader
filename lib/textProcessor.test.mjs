import assert from "node:assert/strict"
import test from "node:test"
import { parseHTML } from "linkedom"
import { extractSentencesFromHtml, markSentencesInHtml } from "./textProcessor.ts"

test("跨粗体文本只标记对应句子，标记一次后可切换高亮", () => {
  const previous = { document: globalThis.document, window: globalThis.window, NodeFilter: globalThis.NodeFilter }
  const { document, window } = parseHTML("<html><body></body></html>")
  globalThis.document = document
  globalThis.window = window
  globalThis.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 }
  try {
    const source = "<p>你好，<strong>世界。</strong>下一句。</p>"
    const sentences = extractSentencesFromHtml(source)
    assert.deepEqual(sentences.map((sentence) => sentence.text), ["你好，世界。", "下一句。"])
    const marked = markSentencesInHtml(source, sentences)
    const root = document.createElement("div")
    root.innerHTML = marked
    const first = [...root.querySelectorAll('[data-reader-sentence="0"]')]
    assert.equal(first.map((node) => node.textContent).join(""), "你好，世界。")
    assert.equal(root.querySelector('[data-reader-sentence="1"]')?.textContent, "下一句。")
  } finally {
    globalThis.document = previous.document
    globalThis.window = previous.window
    globalThis.NodeFilter = previous.NodeFilter
  }
})

test("嵌套段落按正文顺序朗读，并保持句子标记一致", () => {
  const previous = { document: globalThis.document, window: globalThis.window, NodeFilter: globalThis.NodeFilter }
  const { document, window } = parseHTML("<html><body></body></html>")
  Object.assign(globalThis, { document, window, NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 } })
  try {
    for (const source of [
      "<div>第一段。<p>第二段。</p>第三段。</div>",
      "<ul><li>第一段。<ul><li>第二段。</li></ul>第三段。</li></ul>",
    ]) {
      const sentences = extractSentencesFromHtml(source)
      assert.deepEqual(sentences.map((sentence) => sentence.text), ["第一段。", "第二段。", "第三段。"])
      const root = document.createElement("div")
      root.innerHTML = markSentencesInHtml(source, sentences)
      assert.deepEqual([...root.querySelectorAll("[data-reader-sentence]")].map((node) => node.dataset.readerSentence), ["0", "1", "2"])
    }
  } finally {
    Object.assign(globalThis, previous)
  }
})
