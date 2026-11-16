import assert from "node:assert/strict"
import test from "node:test"
import { parseHTML } from "linkedom"
import { shouldIgnoreReaderShortcut } from "./readerKeyboard.ts"

test("快捷键尊重控件、编辑区域、组合键和已处理的事件", () => {
  const { window, document } = parseHTML('<html><body><main id="reader">正文</main><button><span>按钮图标</span></button><div role="slider"></div><div contenteditable="true"><span>编辑内容</span></div><select></select><div role="dialog"><p>设置</p></div></body></html>')
  const previous = globalThis.Element
  globalThis.Element = window.Element
  try {
    const event = { target: document.getElementById("reader") }
    assert.equal(shouldIgnoreReaderShortcut(event), false)
    for (const selector of ["button span", "[role=slider]", "[contenteditable] span", "select", "[role=dialog] p"]) {
      assert.equal(shouldIgnoreReaderShortcut({ target: document.querySelector(selector) }), true)
    }
    for (const flag of ["defaultPrevented", "isComposing", "ctrlKey", "metaKey", "altKey", "shiftKey"]) {
      assert.equal(shouldIgnoreReaderShortcut({ ...event, [flag]: true }), true)
    }
  } finally {
    globalThis.Element = previous
  }
})
