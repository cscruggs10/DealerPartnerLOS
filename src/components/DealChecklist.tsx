import { useState, useCallback, useEffect } from 'react'
import {
  getLease,
  uploadDocument,
  deleteDocument,
  updateLeaseVerification,
  updateLeaseStatus,
  downloadDocument,
  type LeaseData,
  type DocumentType,
  type LeaseDocument
} from '../services/api'

interface DealChecklistProps {
  leaseId: string
  onBack: () => void
  onComplete?: () => void
}

interface StipItem {
  type: DocumentType
  label: string
  description: string
  required: boolean
}

const STIP_ITEMS: StipItem[] = [
  {
    type: 'CONTRACT',
    label: 'Contract',
    description: 'Upload a copy of the executed lease contract',
    required: true
  },
  {
    type: 'TIER_SHEET',
    label: 'Tier Sheet',
    description: 'Copy of the customer Tier Calculator result',
    required: true
  },
  {
    type: 'DRIVERS_LICENSE',
    label: "Driver's License",
    description: 'Copy of valid driver\'s license',
    required: true
  },
  {
    type: 'PROOF_OF_RESIDENCE',
    label: 'Proof of Residence',
    description: 'Copy of acceptable POR (utility bill, bank statement, etc.)',
    required: true
  },
  {
    type: 'PROOF_OF_INCOME',
    label: 'Proof of Income',
    description: 'Copy of acceptable POI (pay stubs, bank statements, etc.)',
    required: true
  },
  {
    type: 'INSURANCE',
    label: 'Insurance',
    description: 'Dec page with $500 deductibles. Lienholder: I Finance, PO Box 225, Gautier, MS 39553',
    required: true
  },
  {
    type: 'CREDIT_APPLICATION',
    label: 'Credit Application',
    description: 'Copy of completed credit application',
    required: true
  },
  {
    type: 'CREDIT_REPORT',
    label: 'Credit Report',
    description: 'Copy of credit report',
    required: true
  },
  {
    type: 'TITLE_APPLICATION',
    label: 'Title Application',
    description: 'Title application from state where titled (MS or TN only)',
    required: true
  }
]

export function DealChecklist({ leaseId, onBack, onComplete }: DealChecklistProps) {
  const [lease, setLease] = useState<LeaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null)
  const [dragOverType, setDragOverType] = useState<DocumentType | null>(null)

  // Verification states
  const [email, setEmail] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [cellVerified, setCellVerified] = useState(false)
  const [savingVerification, setSavingVerification] = useState(false)

  useEffect(() => {
    loadLease()
  }, [leaseId])

  const loadLease = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLease(leaseId)
      setLease(data)
      setEmail(data.customerEmail || '')
      setEmailVerified(data.customerEmailVerified || false)
      setCellVerified(data.customerCellVerified || false)
    } catch (err) {
      setError('Failed to load lease')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getDocumentForType = (type: DocumentType): LeaseDocument | undefined => {
    return lease?.documents?.find(d => d.type === type)
  }

  const handleFileUpload = useCallback(async (type: DocumentType, file: File) => {
    if (!lease) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF or image file (JPG, PNG, GIF)')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    try {
      setUploadingType(type)
      await uploadDocument(lease.id, type, file)
      await loadLease()
    } catch (err) {
      alert('Failed to upload document')
      console.error(err)
    } finally {
      setUploadingType(null)
    }
  }, [lease])

  const handleDrop = useCallback((type: DocumentType) => (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverType(null)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(type, file)
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((type: DocumentType) => (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverType(type)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverType(null)
  }, [])

  const handleFileSelect = (type: DocumentType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(type, file)
    }
    // Reset input
    e.target.value = ''
  }

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?')) return
    try {
      await deleteDocument(docId)
      await loadLease()
    } catch (err) {
      alert('Failed to delete document')
      console.error(err)
    }
  }

  const handleSaveVerification = async () => {
    if (!lease) return
    try {
      setSavingVerification(true)
      await updateLeaseVerification(lease.id, {
        customerEmail: email,
        customerEmailVerified: emailVerified,
        customerCellVerified: cellVerified
      })
      await loadLease()
    } catch (err) {
      alert('Failed to save verification')
      console.error(err)
    } finally {
      setSavingVerification(false)
    }
  }

  const handleSubmitForReview = async () => {
    if (!lease) return

    // Check all required documents
    const missingDocs = STIP_ITEMS.filter(item =>
      item.required && !getDocumentForType(item.type)
    )

    if (missingDocs.length > 0) {
      alert(`Please upload all required documents:\n${missingDocs.map(d => d.label).join('\n')}`)
      return
    }

    if (!email || !emailVerified || !cellVerified) {
      alert('Please verify email and cell phone before submitting')
      return
    }

    if (!confirm('Submit this deal for funding review?')) return

    try {
      await updateLeaseStatus(lease.id, 'CHECKLIST')
      if (onComplete) onComplete()
      else onBack()
    } catch (err) {
      alert('Failed to submit for review')
      console.error(err)
    }
  }

  const getStatusBadge = (doc: LeaseDocument | undefined) => {
    if (!doc) return null

    const statusColors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800'
    }

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[doc.status]}`}>
        {doc.status}
      </span>
    )
  }

  const completedCount = STIP_ITEMS.filter(item => getDocumentForType(item.type)).length
  const totalRequired = STIP_ITEMS.filter(item => item.required).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading checklist...</p>
      </div>
    )
  }

  if (error || !lease) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Lease not found'}</p>
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Deal Checklist</h1>
                <p className="text-sm text-gray-500">
                  {lease.customerFirstName} {lease.customerLastName} - {lease.vehicleYear} {lease.vehicleMake} {lease.vehicleModel}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-600">
                {completedCount} / {totalRequired} Documents
              </div>
              <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{ width: `${(completedCount / totalRequired) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Document Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Required Documents</h2>

          <div className="space-y-4">
            {STIP_ITEMS.map((item) => {
              const doc = getDocumentForType(item.type)
              const isUploading = uploadingType === item.type
              const isDragOver = dragOverType === item.type

              return (
                <div
                  key={item.type}
                  className={`border-2 rounded-lg p-4 transition-colors ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-50'
                      : doc
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onDrop={handleDrop(item.type)}
                  onDragOver={handleDragOver(item.type)}
                  onDragLeave={handleDragLeave}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {doc ? (
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        <span className="font-medium text-gray-900">{item.label}</span>
                        {item.required && <span className="text-red-500 text-xs">*</span>}
                        {getStatusBadge(doc)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 ml-7">{item.description}</p>
                      {doc && (
                        <div className="mt-2 ml-7 flex items-center gap-2 text-sm">
                          <span className="text-gray-600">{doc.fileName}</span>
                          <button
                            onClick={() => downloadDocument(doc.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                          {doc.notes && (
                            <span className="text-red-600 text-xs">Note: {doc.notes}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      {isUploading ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="text-sm">Uploading...</span>
                        </div>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {doc ? 'Replace' : 'Upload'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.gif"
                            className="hidden"
                            onChange={handleFileSelect(item.type)}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {!doc && (
                    <div className="mt-3 text-center text-sm text-gray-400 border-t border-dashed pt-3">
                      or drag and drop file here
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Verification Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Customer Verification</h2>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Email <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={emailVerified}
                    onChange={(e) => setEmailVerified(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Verified</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">We will verify this email address</p>
            </div>

            {/* Cell Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cell Phone Verification <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                <span className="text-gray-600">{lease.customerPhone || 'No phone on file'}</span>
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={cellVerified}
                    onChange={(e) => setCellVerified(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Verified</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">We will verify this cell phone number</p>
            </div>

            <button
              onClick={handleSaveVerification}
              disabled={savingVerification}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {savingVerification ? 'Saving...' : 'Save Verification'}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Save & Exit
          </button>
          <button
            onClick={handleSubmitForReview}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Submit for Funding Review
          </button>
        </div>
      </main>
    </div>
  )
}
