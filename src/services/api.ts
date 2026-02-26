const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001'

export type DocumentType =
  | 'CONTRACT'
  | 'TIER_SHEET'
  | 'DRIVERS_LICENSE'
  | 'PROOF_OF_RESIDENCE'
  | 'PROOF_OF_INCOME'
  | 'INSURANCE'
  | 'CREDIT_APPLICATION'
  | 'CREDIT_REPORT'
  | 'TITLE_APPLICATION'
  | 'GPS_DISCLOSURE'

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LeaseDocument {
  id: string
  type: DocumentType
  status: DocumentStatus
  fileName: string
  fileSize?: number
  mimeType?: string
  notes?: string
  uploadedAt: string
  reviewedAt?: string
}

export interface LeaseData {
  id: string
  dealerId: string
  status: 'PENDING' | 'POSTED' | 'CHECKLIST' | 'FUNDED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  customerFirstName: string
  customerLastName: string
  customerAddress?: string
  customerCity?: string
  customerState?: string
  customerZip?: string
  customerPhone?: string
  customerEmail?: string
  customerEmailVerified?: boolean
  customerCellVerified?: boolean
  coLesseeFirstName?: string
  coLesseeLastName?: string
  vehicleYear: string
  vehicleMake: string
  vehicleModel: string
  vehicleVin: string
  vehicleMileage: number
  dealData: {
    calculation: Record<string, unknown>
    vehicle: Record<string, unknown>
    customer: Record<string, unknown>
    firstPaymentDate: string
  }
  documents?: LeaseDocument[]
  contractDate?: string // Official contract date for backdated deals
  isBackdated?: boolean // Flag to identify backdated entries
  createdAt: string
  updatedAt: string
  dealer?: {
    id: string
    name: string | null
    address: string | null
    phone: string
  }
}

export async function getLeases(clerkId: string, isAdmin = false): Promise<LeaseData[]> {
  const params = new URLSearchParams()
  if (isAdmin) {
    params.set('isAdmin', 'true')
  } else {
    params.set('clerkId', clerkId)
  }

  const response = await fetch(`${API_BASE}/api/leases?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch leases')
  }
  return response.json()
}

export async function getLease(id: string): Promise<LeaseData> {
  const response = await fetch(`${API_BASE}/api/leases/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch lease')
  }
  return response.json()
}

export async function createLease(clerkId: string, leaseData: {
  dealerName?: string
  dealerAddress?: string
  dealerPhone?: string
  customerFirstName: string
  customerLastName: string
  customerAddress?: string
  customerCity?: string
  customerState?: string
  customerZip?: string
  customerPhone?: string
  coLesseeFirstName?: string
  coLesseeLastName?: string
  vehicleYear: string
  vehicleMake: string
  vehicleModel: string
  vehicleVin: string
  vehicleMileage: number
  dealData: Record<string, unknown>
  contractDate?: string // For backdated deals
  isBackdated?: boolean // Flag for backdated deals
}): Promise<LeaseData> {
  const response = await fetch(`${API_BASE}/api/leases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clerkId, leaseData })
  })
  if (!response.ok) {
    throw new Error('Failed to create lease')
  }
  return response.json()
}

export async function updateLeaseStatus(
  id: string,
  status: LeaseData['status']
): Promise<LeaseData> {
  const response = await fetch(`${API_BASE}/api/leases/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
  if (!response.ok) {
    throw new Error('Failed to update lease status')
  }
  return response.json()
}

export async function updateLeaseVerification(
  id: string,
  data: {
    customerEmail?: string
    customerEmailVerified?: boolean
    customerCellVerified?: boolean
  }
): Promise<LeaseData> {
  const response = await fetch(`${API_BASE}/api/leases/${id}/verification`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    throw new Error('Failed to update verification')
  }
  return response.json()
}

export async function deleteLease(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/leases/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to delete lease')
  }
}

// Document functions
export async function uploadDocument(
  leaseId: string,
  type: DocumentType,
  file: File
): Promise<LeaseDocument> {
  // Convert file to base64
  const fileData = await fileToBase64(file)

  const response = await fetch(`${API_BASE}/api/leases/${leaseId}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileData
    })
  })

  if (!response.ok) {
    throw new Error('Failed to upload document')
  }
  return response.json()
}

export async function getDocumentFile(id: string): Promise<{ fileName: string; mimeType: string; fileData: string }> {
  const response = await fetch(`${API_BASE}/api/documents/${id}/file`)
  if (!response.ok) {
    throw new Error('Failed to fetch document')
  }
  return response.json()
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/documents/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) {
    throw new Error('Failed to delete document')
  }
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  notes?: string
): Promise<LeaseDocument> {
  const response = await fetch(`${API_BASE}/api/documents/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes })
  })
  if (!response.ok) {
    throw new Error('Failed to update document status')
  }
  return response.json()
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

// Helper to download a document
export async function downloadDocument(id: string): Promise<void> {
  const { fileName, mimeType, fileData } = await getDocumentFile(id)

  // Convert base64 back to blob
  const byteString = atob(fileData.split(',')[1])
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  const blob = new Blob([ab], { type: mimeType })

  // Create download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
