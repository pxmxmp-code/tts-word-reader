import assert from "node:assert/strict"
import { test } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { parseHTML } from "linkedom"
import { usePlayback } from "./usePlayback.ts"

test("暂停时进度跳转不播放，点击句子会启动对应音频，非法索引不改变位置", async () => {
  const previous = { window: globalThis.window, document: globalThis.document, Audio: globalThis.Audio, fetch: globalThis.fetch, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT }
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>')
  Object.assign(globalThis, { window, document, IS_REACT_ACT_ENVIRONMENT: true })
  const played = []
  class Audio extends EventTarget {
    currentTime = 0
    ended = false
    src = ""
    load() { queueMicrotask(() => this.onloadeddata?.()) }
    play() { played.push(this); return Promise.resolve() }
    pause() { this.dispatchEvent(new Event("pause")) }
  }
  globalThis.Audio = Audio
  const requests = []
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body))
    return new Response(new Blob(["audio"], { type: "audio/mpeg" }))
  }
  const sentences = [{ text: "第一句。", ranges: [] }, { text: "第二句。", ranges: [] }]
  let playback
  function Reader() {
    playback = usePlayback({ sentences, documentId: "doc", selectedVoice: "voice", selectedStyle: "general", playbackRate: 1, mounted: true, onError: (message) => { throw new Error(message) } })
    return null
  }
  const root = createRoot(document.getElementById("root"))
  try {
    await act(() => root.render(createElement(Reader)))
    await act(() => playback.handleProgressChange(1))
    assert.equal(playback.currentSentenceIndex, 1)
    assert.equal(playback.isPlaying, false)
    assert.equal(played.length, 0)
    await act(async () => {
      playback.handleSelectSentence(1)
      await new Promise((resolve) => setTimeout(resolve, 80))
    })
    assert.equal(playback.isPlaying, true)
    assert.equal(played.length, 1)
    assert.equal(requests[0].input, "第二句。")
    assert.equal(requests[0].documentId, "doc")
    await act(() => playback.handleSelectSentence(-1))
    assert.equal(playback.currentSentenceIndex, 1)
    await act(() => {
      played[0].ended = true
      played[0].dispatchEvent(new Event("ended"))
    })
    assert.equal(playback.isPlaying, false)
  } finally {
    await act(() => root.unmount())
    Object.assign(globalThis, previous)
  }
})
