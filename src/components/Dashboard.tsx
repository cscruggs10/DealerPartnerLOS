import { useClerk, useUser } from '@clerk/clerk-react'
import { useState } from 'react'

interface DashboardProps {
  dealerProfile: { name: string; address: string }
  onNewDeal: () => void
}

interface Lease {
  id: string
  status: 'PENDING' | 'POSTED' | 'FUNDED' | 'ACTIVE'
  customerName: string
  vehicle: string
  monthlyPayment: number
  createdAt: string
}

export function Dashboard({ dealerProfile, onNewDeal }: DashboardProps) {
  const { signOut } = useClerk()
  const { user } = useUser()
  const [leases, setLeases] = useState<Lease[]>(() => {
    // Load from localStorage for now (will be replaced with API)
    const saved = localStorage.getItem(`leases_${user?.id}`)
    return saved ? JSON.parse(saved) : []
  })

  const handleDelete = (leaseId: string) => {
    if (!confirm('Are you sure you want to delete this lease?')) return
    const updated = leases.filter(l => l.id !== leaseId)
    setLeases(updated)
    localStorage.setItem(`leases_${user?.id}`, JSON.stringify(updated))
  }

  const handlePost = (leaseId: string) => {
    const updated = leases.map(l =>
      l.id === leaseId ? { ...l, status: 'POSTED' as const } : l
    )
    setLeases(updated)
    localStorage.setItem(`leases_${user?.id}`, JSON.stringify(updated))
  }

  const getStatusColor = (status: Lease['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'POSTED': return 'bg-blue-100 text-blue-800'
      case 'FUNDED': return 'bg-green-100 text-green-800'
      case 'ACTIVE': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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
          <button
            onClick={onNewDeal}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            + New Deal
          </button>
        </div>

        {leases.length === 0 ? (
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
                {leases.map((lease) => (
                  <tr key={lease.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {lease.customerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lease.vehicle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${lease.monthlyPayment.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(lease.status)}`}>
                        {lease.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(lease.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {lease.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handlePost(lease.id)}
                            className="text-blue-600 hover:text-blue-800 mr-4"
                          >
                            Post
                          </button>
                          <button
                            onClick={() => handleDelete(lease.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {lease.status === 'POSTED' && (
                        <span className="text-gray-400">Awaiting Funding</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
