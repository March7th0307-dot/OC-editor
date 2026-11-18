/**
 * 菜单里的快捷键提示文字。
 *
 * 原代码统一写 "Ctrl+Z" 这类 Windows 写法；Mac 上实际按的是 ⌘，
 * 所以在 Mac 上换成系统习惯的符号写法（⇧⌘Z），其他平台原样返回。
 * 只在菜单打开时（客户端）调用，不会造成静态导出的水合不一致。
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
}

export function shortcutLabel(combo: string): string {
  if (!isMacPlatform()) return combo
  const parts = combo.split('+')
  const key = parts.pop() ?? ''
  // Mac 习惯的修饰键顺序：⌥ ⇧ ⌘（Ctrl 在 Mac 上对应 ⌘，放最后）
  const order = ['Alt', 'Shift', 'Ctrl']
  const symbols: Record<string, string> = { Ctrl: '⌘', Alt: '⌥', Shift: '⇧' }
  const mods = parts
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((m) => symbols[m] ?? m)
    .join('')
  return mods + key
}
