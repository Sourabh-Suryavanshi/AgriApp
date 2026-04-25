import { useState } from 'react'
import { account, databases, DB_ID, PROFILES_ID, Query } from '../lib/appwrite'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const fakeEmail = `${username.trim().toLowerCase()}@gomteshagro.app`

      await account.createEmailPasswordSession(fakeEmail, password.trim())

      const user = await account.get()

      const profileRes = await databases.listDocuments(
        DB_ID,
        PROFILES_ID,
        [Query.equal('userId', user.$id)]
      )

      const profile = profileRes.documents?.[0]

      if (!profile) {
        setError('Account not found. Contact shop owner. / खाते सापडले नाही.')
        await account.deleteSession('current')
        return
      }
      if (profile.role === 'owner') {
        window.location.href = '/dashboard'
      } else if (profile.role === 'customer') {
        window.location.href = '/customer-dashboard'
      } else {
        setError('Unknown role. Contact shop owner.')
        await account.deleteSession('current')
      }

    } catch (err) {
      console.log('Login error:', err)
      setError('Invalid username or password. / चुकीचे युजरनेम किंवा पासवर्ड.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0fdf4] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 text-3xl flex items-center justify-center mx-auto mb-3">
            🚜
          </div>
          <h1 className="text-xl font-bold text-green-700">Gomtesh Agro Agency</h1>
          <p className="text-sm text-gray-400">गोमतेश अॅग्रो एजन्सी</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Username / युजरनेम
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="Enter your username"
              required
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Password / पासवर्ड
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Logging in...' : 'Login / लॉगिन'}
          </button>
        </form>

      </div>
    </div>
  )
}

export default Login