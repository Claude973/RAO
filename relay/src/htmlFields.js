export function extractHiddenValue(html, fieldName) {
  const pattern = new RegExp(`name="${fieldName}"\\s+value="([^"]*)"`)
  const match = html.match(pattern)
  return match ? match[1] : null
}
