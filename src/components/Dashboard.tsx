import { useClerk, useUser } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { getLeases, updateLeaseStatus, deleteLease, LeaseData } from '../services/api'
import { DealChecklist } from './DealChecklist'

interface DashboardProps {
  dealerProfile: { name: string; address: string }
  onNewDeal: () => void
}

export function Dashboard({ dealerProfile, onNewDeal }: DashboardProps) {
  const { signOut } = useClerk()
  const { user } = useUser()
  const [leases, setLeases] = useState<LeaseData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [checklistLeaseId, setChecklistLeaseId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadLeases()
    }
  }, [user?.id])

  const loadLeases = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      setError(null)
      const data = await getLeases(user.id)
      setLeases(data)
    } catch (err) {
      setError('Failed to load leases')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (leaseId: string) => {
    if (!confirm('Are you sure you want to delete this lease?')) return
    try {
      setProcessingId(leaseId)
      await deleteLease(leaseId)
      await loadLeases()
    } catch (err) {
      alert('Failed to delete lease')
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  const handlePost = async (leaseId: string) => {
    if (!confirm('Submit this lease? You will need to complete the document checklist next.')) return
    try {
      setProcessingId(leaseId)
      await updateLeaseStatus(leaseId, 'POSTED')
      await loadLeases()
      // Open checklist for the posted lease
      setChecklistLeaseId(leaseId)
    } catch (err) {
      alert('Failed to post lease')
      console.error(err)
    } finally {
      setProcessingId(null)
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

  const getStatusText = (status: LeaseData['status']) => {
    switch (status) {
      case 'PENDING': return 'Draft'
      case 'POSTED': return 'Documents Needed'
      case 'CHECKLIST': return 'Under Review'
      case 'FUNDED': return 'Funded'
      case 'ACTIVE': return 'Active'
      case 'COMPLETED': return 'Completed'
      case 'CANCELLED': return 'Cancelled'
      default: return status
    }
  }

  const getDocumentProgress = (lease: LeaseData) => {
    const total = 9 // Total required documents
    const uploaded = lease.documents?.length || 0
    return { uploaded, total }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  // Show checklist if a lease is selected
  if (checklistLeaseId) {
    return (
      <DealChecklist
        leaseId={checklistLeaseId}
        onBack={() => {
          setChecklistLeaseId(null)
          loadLeases()
        }}
        onComplete={() => {
          setChecklistLeaseId(null)
          loadLeases()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{dealerProfile.name}</h1>
            <p className="text-sm text-gray-500">{dealerProfile.address}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.primaryPhoneNumber?.phoneNumber}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Lease Dashboard</h2>
          <div className="flex gap-2">
            <button
              onClick={loadLeases}
              className="text-gray-600 hover:text-gray-800 px-3 py-2"
            >
              ↻ Refresh
            </button>
            <button
              onClick={onNewDeal}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              + New Deal
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
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Try Again
            </button>
          </div>
        ) : leases.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">No leases yet. Create your first deal to get started.</p>
            <button
              onClick={onNewDeal}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Create New Deal
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
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
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leases.map((lease) => {
                  const docProgress = getDocumentProgress(lease)
                  return (
                    <tr key={lease.id} className={processingId === lease.id ? 'opacity-50' : ''}>
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
                          {getStatusText(lease.status)}
                        </span>
                        {(lease.status === 'POSTED' || lease.status === 'CHECKLIST') && (
                          <div className="mt-1">
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${(docProgress.uploaded / docProgress.total) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">{docProgress.uploaded}/{docProgress.total} docs</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(lease.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {lease.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handlePost(lease.id)}
                              disabled={processingId !== null}
                              className="text-blue-600 hover:text-blue-800 mr-4 disabled:opacity-50"
                            >
                              Submit
                            </button>
                            <button
                              onClick={() => handleDelete(lease.id)}
                              disabled={processingId !== null}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {lease.status === 'POSTED' && (
                          <button
                            onClick={() => setChecklistLeaseId(lease.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Complete Checklist
                          </button>
                        )}
                        {lease.status === 'CHECKLIST' && (
                          <span className="text-purple-500">Under Review</span>
                        )}
                        {lease.status === 'FUNDED' && (
                          <span className="text-green-500">Funded!</span>
                        )}
                        {lease.status === 'ACTIVE' && (
                          <span className="text-emerald-500">Active Lease</span>
                        )}
                        {lease.status === 'CANCELLED' && (
                          <span className="text-red-500">Cancelled</span>
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
