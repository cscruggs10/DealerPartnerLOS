import { useClerk, useUser } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import {
  getLeases,
  updateLeaseStatus,
  downloadDocument,
  updateDocumentStatus,
  LeaseData,
  LeaseDocument,
  DocumentType
} from '../services/api'

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  CONTRACT: 'Contract',
  TIER_SHEET: 'Tier Sheet',
  DRIVERS_LICENSE: "Driver's License",
  PROOF_OF_RESIDENCE: 'Proof of Residence',
  PROOF_OF_INCOME: 'Proof of Income',
  INSURANCE: 'Insurance',
  CREDIT_APPLICATION: 'Credit Application',
  CREDIT_REPORT: 'Credit Report',
  TITLE_APPLICATION: 'Title Application'
}

interface AdminDashboardProps {
  onBackdateDeal?: () => void
}

export function AdminDashboard({ onBackdateDeal }: AdminDashboardProps = {}) {
  const { signOut } = useClerk()
  const { user } = useUser()
  const [leases, setLeases] = useState<LeaseData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'CHECKLIST' | 'POSTED' | 'FUNDED' | 'ACTIVE'>('CHECKLIST')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedLease, setSelectedLease] = useState<LeaseData | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [previewDoc, setPreviewDoc] = useState<{ url: string; type: string; name: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    loadLeases()
  }, [])

  const loadLeases = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getLeases('', true) // isAdmin = true
      setLeases(data)
    } catch (err) {
      setError('Failed to load leases')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFund = async (leaseId: string) => {
    const lease = leases.find(l => l.id === leaseId)
    if (!lease) return

    // Check if all documents are approved
    const pendingDocs = lease.documents?.filter(d => d.status !== 'APPROVED') || []
    if (pendingDocs.length > 0) {
      alert(`Please review all documents before funding. ${pendingDocs.length} document(s) still need review.`)
      return
    }

    if (!confirm('Approve and fund this lease?')) return
    try {
      setProcessingId(leaseId)
      await updateLeaseStatus(leaseId, 'FUNDED')
      await loadLeases()
      setSelectedLease(null)
    } catch (err) {
      alert('Failed to fund lease')
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleActivate = async (leaseId: string) => {
    if (!confirm('Activate this lease?')) return
    try {
      setProcessingId(leaseId)
      await updateLeaseStatus(leaseId, 'ACTIVE')
      await loadLeases()
    } catch (err) {
      alert('Failed to activate lease')
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (leaseId: string) => {
    if (!confirm('Reject and cancel this lease? This action cannot be undone.')) return
    try {
      setProcessingId(leaseId)
      await updateLeaseStatus(leaseId, 'CANCELLED')
      await loadLeases()
      setSelectedLease(null)
    } catch (err) {
      alert('Failed to reject lease')
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const handleApproveDocument = async (docId: string) => {
    try {
      await updateDocumentStatus(docId, 'APPROVED')
      await loadLeases()
      // Refresh selected lease
      if (selectedLease) {
        const updated = leases.find(l => l.id === selectedLease.id)
        if (updated) setSelectedLease(updated)
      }
    } catch (err) {
      alert('Failed to approve document')
      console.error(err)
    }
  }

  const handleRejectDocument = async (docId: string, notes: string) => {
    if (!notes.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    try {
      await updateDocumentStatus(docId, 'REJECTED', notes)
      await loadLeases()
      setRejectNote('')
    } catch (err) {
      alert('Failed to reject document')
      console.error(err)
    }
  }

  const handlePreviewDocument = async (docId: string) => {
    try {
      setLoadingPreview(true)
      const doc = await downloadDocument(docId)
      // Create a data URL from the base64 file data
      const dataUrl = `data:${doc.mimeType};base64,${doc.fileData}`
      setPreviewDoc({ url: dataUrl, type: doc.mimeType, name: doc.fileName })
    } catch (err) {
      alert('Failed to load document preview')
      console.error(err)
    } finally {
      setLoadingPreview(false)
    }
  }

  const getStatusColor = (status: LeaseData['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'POSTED': return 'bg-blue-100 text-blue-800'
      case 'CHECKLIST': return 'bg-purple-100 text-purple-800'
      case 'FUNDED': return 'bg-green-100 text-green-800'
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-800'
      case 'COMPLETED': return 'bg-gray-100 text-gray-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDocStatusColor = (status: LeaseDocument['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredLeases = filter === 'ALL'
    ? leases
    : leases.filter(l => l.status === filter)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  // Document Preview Modal
  const PreviewModal = () => {
    if (!previewDoc) return null

    const isImage = previewDoc.type.startsWith('image/')
    const isPdf = previewDoc.type === 'application/pdf'

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-semibold text-gray-800">{previewDoc.name}</h3>
            <button
              onClick={() => setPreviewDoc(null)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 bg-gray-100">
            {isImage ? (
              <img
                src={previewDoc.url}
                alt={previewDoc.name}
                className="max-w-full mx-auto"
              />
            ) : isPdf ? (
              <iframe
                src={previewDoc.url}
                className="w-full h-[70vh]"
                title={previewDoc.name}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Preview not available for this file type</p>
                <a
                  href={previewDoc.url}
                  download={previewDoc.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Document Review Modal
  if (selectedLease) {
    return (
      <div className="min-h-screen bg-gray-100">
        <PreviewModal />
        <header className="bg-indigo-600 text-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedLease(null)}
                className="p-2 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold">Document Review</h1>
                <p className="text-sm text-indigo-200">
                  {selectedLease.customerFirstName} {selectedLease.customerLastName} - {selectedLease.vehicleYear} {selectedLease.vehicleMake} {selectedLease.vehicleModel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReject(selectedLease.id)}
                disabled={processingId !== null}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                Reject Deal
              </button>
              <button
                onClick={() => handleFund(selectedLease.id)}
                disabled={processingId !== null}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                Approve & Fund
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Deal Info */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Deal Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Dealer:</span>
                <span className="ml-2 font-medium">{selectedLease.dealer?.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Payment:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency((selectedLease.dealData as { calculation?: { basePayment?: number } })?.calculation?.basePayment || 0)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 font-medium">{selectedLease.customerEmail || 'Not provided'}</span>
                {selectedLease.customerEmailVerified && (
                  <span className="ml-2 text-green-600 text-xs">Verified</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">Phone:</span>
                <span className="ml-2 font-medium">{selectedLease.customerPhone || 'Not provided'}</span>
                {selectedLease.customerCellVerified && (
                  <span className="ml-2 text-green-600 text-xs">Verified</span>
                )}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Uploaded Documents</h2>

            {selectedLease.documents && selectedLease.documents.length > 0 ? (
              <div className="space-y-4">
                {selectedLease.documents.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {DOCUMENT_LABELS[doc.type] || doc.type}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getDocStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {doc.fileName} - Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        {doc.notes && (
                          <p className="text-sm text-red-600 mt-1">Note: {doc.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePreviewDocument(doc.id)}
                          disabled={loadingPreview}
                          className="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                        >
                          {loadingPreview ? 'Loading...' : 'View'}
                        </button>
                        {doc.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApproveDocument(doc.id)}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                            >
                              Approve
                            </button>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Reason..."
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                              <button
                                onClick={() => handleRejectDocument(doc.id, rejectNote)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                              >
                                Reject
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No documents uploaded yet</p>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Deal Machine Admin</h1>
            <p className="text-sm text-indigo-200">Lease Management System</p>
          </div>
          <div className="flex items-center gap-4">
            {onBackdateDeal && (
              <button
                onClick={onBackdateDeal}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Backdate Deal
              </button>
            )}
            <span className="text-sm">{user?.primaryPhoneNumber?.phoneNumber}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-indigo-200 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {leases.filter(l => l.status === 'PENDING').length}
              </div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {leases.filter(l => l.status === 'POSTED').length}
              </div>
              <div className="text-sm text-gray-500">Docs Needed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {leases.filter(l => l.status === 'CHECKLIST').length}
              </div>
              <div className="text-sm text-gray-500">Ready for Review</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {leases.filter(l => l.status === 'FUNDED').length}
              </div>
              <div className="text-sm text-gray-500">Funded</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {leases.filter(l => l.status === 'ACTIVE').length}
              </div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Lease Queue</h2>
          <div className="flex gap-2">
            {(['CHECKLIST', 'POSTED', 'FUNDED', 'ACTIVE', 'ALL'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {status === 'ALL' ? 'All' : status === 'CHECKLIST' ? 'Review Queue' : status}
              </button>
            ))}
            <button
              onClick={loadLeases}
              className="px-4 py-2 rounded-md text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Loading leases...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-red-500">{error}</p>
            <button
              onClick={loadLeases}
              className="mt-4 text-indigo-600 hover:text-indigo-800"
            >
              Try Again
            </button>
          </div>
        ) : filteredLeases.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              {filter === 'ALL'
                ? 'No leases in the system yet.'
                : filter === 'CHECKLIST'
                  ? 'No leases ready for review.'
                  : `No ${filter.toLowerCase()} leases.`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dealer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Docs
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeases.map((lease) => {
                  const totalDocs = 9
                  const uploadedDocs = lease.documents?.length || 0
                  const approvedDocs = lease.documents?.filter(d => d.status === 'APPROVED').length || 0

                  return (
                    <tr key={lease.id} className={processingId === lease.id ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {lease.dealer?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">{lease.dealer?.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {lease.customerFirstName} {lease.customerLastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lease.vehicleYear} {lease.vehicleMake} {lease.vehicleModel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency((lease.dealData as { calculation?: { basePayment?: number } })?.calculation?.basePayment || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lease.status)}`}>
                          {lease.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(approvedDocs / totalDocs) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{approvedDocs}/{uploadedDocs}/{totalDocs}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {lease.status === 'CHECKLIST' && (
                          <button
                            onClick={() => setSelectedLease(lease)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Review
                          </button>
                        )}
                        {lease.status === 'FUNDED' && (
                          <button
                            onClick={() => handleActivate(lease.id)}
                            disabled={processingId !== null}
                            className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {lease.status === 'ACTIVE' && (
                          <span className="text-emerald-500">Active</span>
                        )}
                        {lease.status === 'POSTED' && (
                          <span className="text-blue-500">Awaiting Docs</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
