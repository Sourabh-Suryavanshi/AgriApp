import { useAuth } from '../context/AuthContext'
import { account } from '../lib/appwrite'

const Navbar = () => {
  const { userProfile } = useAuth()

  const handleLogout = async () => {
    try {
      await account.deleteSession('current')
    } catch {
      // Session already gone — that's fine
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <nav className="w-full bg-green-700 text-white px-4 py-3">
      <div className="flex justify-between items-center">
        <div className="font-bold text-white">🚜 Gomtesh Agro</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-100">
            {userProfile?.full_name || ''}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm border border-white/50 rounded px-3 py-1 hover:bg-green-800 transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar