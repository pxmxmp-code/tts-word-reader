import assert from "node:assert/strict"
import { afterEach, mock, test } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { parseHTML } from "linkedom"

// Isolate the reader's DOM updates from the uploader, scroll widget and sanitizer.
mock.module("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }) => createElement("div", null, children),
}))
mock.module("@/components/FileUploader", () => ({ FileUploader: () => null }))
mock.module("dompurify", () => ({ default: { sanitize: (html) => html } }))
const { DocumentViewer } = await import("../components/DocumentViewer.tsx")
const { SettingsPanel } = await import("../components/SettingsPanel.tsx")

const previous = {
  window: globalThis.window,
  document: globalThis.document,
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
}
let root
afterEach(async () => {
  if (root) await act(() => root.unmount())
  root = undefined
  Object.assign(globalThis, previous)
})

function setup(overrides = {}) {
  const { window, document } = parseHTML("<html><body><div id='root'></div></body></html>")
  Object.assign(globalThis, { window, document, IS_REACT_ACT_ENVIRONMENT: true })
  const scrolled = []
  window.HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this) }
  const container = document.getElementById("root")
  root = createRoot(container)
  let props = {
    isLoading: false,
    html: '<p><span data-reader-sentence="0">第一句。</span><span data-reader-sentence="1">第二句。</span></p>',
    currentSentenceIndex: 1,
    fontSize: 110,
    followReading: true,
    ...overrides,
  }
  return {
    container,
    scrolled,
    async render(changes = {}) {
      props = { ...props, ...changes }
      await act(() => root.render(createElement(DocumentViewer, props)))
    },
  }
}

test("changing typography and unrelated props preserves the reading highlight", async () => {
  const reader = setup()
  await reader.render()
  const sentence = reader.container.querySelector('[data-reader-sentence="1"]')
  assert.equal(sentence.classList.contains("current-reading"), true)
  for (const change of [
    { fontFamily: "kaiti" }, { fontSize: 140 }, { lineHeight: "loose" },
    { maxWidth: "wide" }, { paperTheme: "midnight" }, { onSelectSentence: () => {} },
  ]) {
    await reader.render(change)
    assert.ok(reader.container.querySelector('[data-reader-sentence="1"]') === sentence)
    assert.equal(sentence.classList.contains("current-reading"), true)
  }
  await reader.render({ currentSentenceIndex: 0 })
  assert.equal(sentence.classList.contains("current-reading"), false)
  assert.equal(reader.container.querySelector('[data-reader-sentence="0"]').classList.contains("current-reading"), true)
})

test("restoring a document after loading highlights and follows the saved sentence", async () => {
  const reader = setup({ isLoading: true })
  await reader.render()
  assert.equal(reader.container.querySelector(".current-reading"), null)
  await reader.render({ isLoading: false })
  const sentence = reader.container.querySelector('[data-reader-sentence="1"]')
  assert.equal(sentence.classList.contains("current-reading"), true)
  assert.ok(reader.scrolled.at(-1) === sentence)
  await reader.render({ isLoading: true })
  await reader.render({ isLoading: false, followReading: false })
  assert.equal(reader.container.querySelector(".current-reading").dataset.readerSentence, "1")
  assert.equal(reader.scrolled.length, 1)
})

test("switching historical documents keeps the saved index and highlights every sentence fragment", async () => {
  const reader = setup()
  await reader.render()
  await reader.render({
    html: '<p><span data-reader-sentence="0">开头。</span><span data-reader-sentence="1">历史文档</span><strong><span data-reader-sentence="1">续读。</span></strong></p>',
  })
  assert.equal(reader.container.querySelectorAll(".current-reading").length, 2)
  assert.equal(reader.container.querySelector('[data-reader-sentence="0"]').classList.contains("current-reading"), false)
  assert.equal([...reader.container.querySelectorAll(".current-reading")].map((node) => node.textContent).join(""), "历史文档续读。")
})

test("cache cleanup failure shows an alert and allows a retry", async () => {
  const reader = setup()
  await act(() => root.render(createElement(SettingsPanel, {
    voices: [], styles: [], selectedVoice: "voice", selectedStyle: "general",
    onVoiceChange: () => {}, onStyleChange: () => {},
    onClearCache: async () => { throw new Error("存储服务暂时不可用") },
  })))
  const button = [...reader.container.querySelectorAll("button")].find((button) => button.textContent.includes("清空云端音频缓存"))
  await act(async () => button.click())
  assert.equal(reader.container.querySelector('[role="alert"]').textContent, "存储服务暂时不可用")
  assert.equal(button.disabled, false)
  assert.equal(button.textContent.includes("缓存已成功清空"), false)
})
