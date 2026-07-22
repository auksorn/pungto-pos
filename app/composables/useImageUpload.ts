export async function uploadImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const { url } = await $fetch<{ url: string }>('/api/uploads/image', { method: 'POST', body: formData })
  return url
}
