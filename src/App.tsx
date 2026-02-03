import { SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { DealCalculator } from './components/DealCalculator'
import { Dashboard } from './components/Dashboard'
import { DealerSetup } from './components/DealerSetup'
import { AdminDashboard } from './components/AdminDashboard'

type View = 'dashboard' | 'calculator'

function App() {
  const { user, isLoaded } = useUser()
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [dealerProfile, setDealerProfile] = useState<{ name: string; address: string } | null>(null)

  // Check if user is admin (set via Clerk metadata)
  const isAdmin = user?.unsafeMetadata?.role === 'admin'

  useEffect(() => {
    if (user?.unsafeMetadata?.dealerProfile) {
      setDealerProfile(user.unsafeMetadata.dealerProfile as { name: string; address: string })
    }
  }, [user])

  const handleProfileSaved = (profile: { name: string; address: string }) => {
    setDealerProfile(profile)
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
              Car World Dealer Portal
            </h1>
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'mx-auto',
                  card: 'shadow-none',
                }
              }}
            />
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {isAdmin ? (
          // Admin users see the Admin Dashboard
          <AdminDashboard />
        ) : !dealerProfile ? (
          // New dealers need to set up their profile
          <DealerSetup onProfileSaved={handleProfileSaved} />
        ) : currentView === 'dashboard' ? (
          // Dealers see their dashboard
          <Dashboard
            dealerProfile={dealerProfile}
            onNewDeal={() => setCurrentView('calculator')}
          />
        ) : (
          // Deal calculator view
          <DealCalculator
            dealerProfile={dealerProfile}
            onBack={() => setCurrentView('dashboard')}
          />
        )}
      </SignedIn>
    </>
  )
}

export default App
