export function shouldIgnoreReaderShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return true
  const target = event.target
  return target instanceof Element && !!target.closest(
    'input,textarea,select,button,a[href],[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"],[role="spinbutton"],[role="combobox"],[role="listbox"],[role="option"],[role="menu"],[role="menuitem"],[role="textbox"],[role="checkbox"],[role="switch"],[role="tab"],[role="radio"],[role="dialog"]'
  )
}
