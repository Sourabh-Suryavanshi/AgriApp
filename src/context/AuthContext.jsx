import { createContext, useContext, useEffect, useState } from 'react'
import { account, databases, DB_ID, PROFILES_ID, Query } from '../lib/appwrite'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    try {
      const res = await databases.listDocuments(
        DB_ID,
        PROFILES_ID,
        [Query.equal('userId', userId)]
      )
      if (res.documents.length > 0) {
        return res.documents[0]
      }
      return null
    } catch (err) {
      console.log('fetchProfile error:', err)
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      try {
        const currentUser = await account.get()
        if (!mounted) return

        setUser(currentUser)

        const profile = await fetchProfile(currentUser.$id)
        if (!mounted) return

        setUserProfile(profile)
      } catch (err) {
        if (!mounted) return
        setUser(null)
        setUserProfile(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      loading, 
      fetchProfile,
      setUserProfile 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export default AuthProvider