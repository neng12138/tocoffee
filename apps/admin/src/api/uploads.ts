import client from './client'

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await client.post<{ url: string }>('/admin/uploads', formData)
  return data.url
}
