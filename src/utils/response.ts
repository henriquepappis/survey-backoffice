export const toArray = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) {
    return data
  }
  if (data && typeof data === 'object') {
    const maybeContent = (data as { content?: T[] }).content
    if (Array.isArray(maybeContent)) {
      return maybeContent
    }
    const maybeData = (data as { data?: T[] }).data
    if (Array.isArray(maybeData)) {
      return maybeData
    }
  }
  return []
}
