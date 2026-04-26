import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { databases, storage, DB_ID, TRANSACTIONS_ID, BILL_BUCKET_ID, Query } from '../lib/appwrite'

const CustomerDashboard = () => {
  const { userProfile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [activeFilter, setActiveFilter] = useState('all')
  const [viewImage, setViewImage] = useState(null)

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!userProfile?.$id) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await databases.listDocuments(DB_ID, TRANSACTIONS_ID, [
          Query.equal('customer_id', userProfile.$id),
          Query.orderDesc('$createdAt'),
        ])
        const docs = res.documents || []
        const due = docs
          .filter((t) => t.type === 'due')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        const paid = docs
          .filter((t) => t.type === 'payment')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        setTransactions(docs)
        setBalance(due - paid)
      } catch {
        setTransactions([])
        setBalance(0)
      } finally {
        setLoading(false)
      }
    }
    fetchTransactions()
  }, [userProfile?.$id])

  const filteredTransactions = useMemo(() => {
    if (activeFilter === 'all') return transactions
    if (activeFilter === 'due') return transactions.filter((t) => t.type === 'due')
    return transactions.filter((t) => t.type === 'payment')
  }, [activeFilter, transactions])

  const formatDate = (tx) => {
    const dateStr = tx.date || tx.$createdAt
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

 const getBillImageUrl = (imageId) => {
  try {
    const urlObj = storage.getFileView(BILL_BUCKET_ID, imageId)
    if (urlObj && typeof urlObj === 'object' && urlObj.href) {
      return urlObj.href
    }
    if (urlObj && typeof urlObj === 'string') {
      return urlObj
    }
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID
    return `${endpoint}/storage/buckets/${BILL_BUCKET_ID}/files/${imageId}/view?project=${projectId}`
  } catch {
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT
    const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID
    return `${endpoint}/storage/buckets/${BILL_BUCKET_ID}/files/${imageId}/view?project=${projectId}`
  }
}
  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Navbar />

      {/* Welcome Card */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4">
        <p className="text-sm text-gray-400">Welcome / नमस्कार</p>
        <h2 className="text-xl font-bold text-gray-800">
          {userProfile?.full_name}
        </h2>
        <p className="text-sm text-gray-400">{userProfile?.phone}</p>
      </div>

      {/* Balance Card */}
      <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm p-5 text-center">
        <p className="text-gray-400 text-sm mb-2">
          Your Balance / तुमची शिल्लक
        </p>
        {balance > 0 && (
          <>
            <p className="text-3xl font-bold text-red-500">
              ₹{balance.toFixed(2)}
            </p>
            <p className="text-sm text-gray-400 mt-1">Due / बाकी</p>
          </>
        )}
        {balance === 0 && (
          <>
            <p className="text-2xl font-bold text-green-600">✓ Clear</p>
            <p className="text-sm text-gray-400 mt-1">हिशोब साफ</p>
          </>
        )}
        {balance < 0 && (
          <>
            <p className="text-3xl font-bold text-orange-500">
              ₹{Math.abs(balance).toFixed(2)}
            </p>
            <p className="text-sm text-gray-400 mt-1">Advance</p>
          </>
        )}
      </div>

      {/* Transactions Section */}
      <div className="mx-4 mt-3">
        <h3 className="font-semibold text-gray-700 mb-2">
          Transactions / व्यवहार
        </h3>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'all', label: 'All / सर्व' },
            { key: 'due', label: 'Due / उधार' },
            { key: 'payment', label: 'Paid / भरले' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                activeFilter === tab.key
                  ? 'bg-green-700 text-white border-green-700'
                  : 'border-gray-300 text-gray-600 bg-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-4 py-10 text-center text-gray-400 text-sm">
              Loading...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400 text-sm">
              <p>No transactions yet</p>
              <p className="text-xs mt-1">अजून कोणतेही व्यवहार नाही</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.$id}
                className="border-b last:border-b-0 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">

                  {/* Left — badge + note */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full w-fit font-medium ${
                      tx.type === 'due'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {tx.type === 'due' ? 'उधार / Due' : 'भरले / Paid'}
                    </span>
                    {tx.note && (
                      <p className="text-xs text-gray-400 truncate">
                        {tx.note}
                      </p>
                    )}
                  </div>

                  {/* Center — date */}
                  <p className="text-xs text-gray-400 shrink-0">
                    {formatDate(tx)}
                  </p>

                  {/* Right — amount */}
                  <p className={`text-sm font-bold shrink-0 ${
                    tx.type === 'due' ? 'text-red-500' : 'text-green-600'
                  }`}>
                    {tx.type === 'due' ? '- ' : '+ '}
                    ₹{Number(tx.amount).toFixed(2)}
                  </p>
                </div>

                {/* View Bill button — only if image exists */}
                {tx.image_id && (
                  <button
                    onClick={() => setViewImage(getBillImageUrl(tx.image_id))}
                    className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 hover:bg-green-100 active:bg-green-200 transition-colors"
                  >
                    🧾 View Bill / बिल पहा
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Full screen bill image viewer */}
      {viewImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setViewImage(null)}
        >
          <div className="relative w-full max-w-lg">
            <button
              onClick={() => setViewImage(null)}
              className="absolute -top-10 right-0 text-white text-sm bg-white/20 rounded-full px-3 py-1"
            >
              Close ✕
            </button>
            <img
              src={viewImage}
              alt="Bill"
              className="w-full rounded-xl shadow-2xl object-contain max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerDashboard