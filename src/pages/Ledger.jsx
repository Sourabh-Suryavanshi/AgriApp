import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  databases, storage,
  DB_ID, PROFILES_ID, TRANSACTIONS_ID, BILL_BUCKET_ID,
  Query, ID
} from '../lib/appwrite'

const Ledger = () => {
  const navigate = useNavigate()
  const { customerId } = useParams()
  const { userProfile } = useAuth()
  const isOwner = userProfile?.role === 'owner'

  const [customer, setCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState('due')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [billImage, setBillImage] = useState(null)
  const [billPreview, setBillPreview] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const [viewImage, setViewImage] = useState(null)

  const canAccess = isOwner || customerId === userProfile?.$id

  const fetchLedgerData = async () => {
    setLoading(true)
    setError('')
    try {
              console.log("transactions:", TRANSACTIONS_ID);
      const [customerRes, txRes] = await Promise.all([
        databases.listDocuments(DB_ID, PROFILES_ID, [
          Query.equal('$id', customerId)
        ]),
        
        databases.listDocuments(DB_ID, TRANSACTIONS_ID, [
          Query.equal('customer_id', customerId),
          Query.orderDesc('$createdAt'),
        ]),
      ])
      setCustomer(customerRes.documents?.[0] || null)
      setTransactions(txRes.documents || [])
    } catch {
      setError('Failed to load ledger.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userProfile) return
    if (!canAccess) {
      navigate('/customer-dashboard', { replace: true })
      return
    }
    fetchLedgerData()
  }, [customerId, userProfile?.$id])

  const { totalDue, totalPaid, balance } = useMemo(() => {
    const totalDue = transactions
      .filter(t => t.type === 'due')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const totalPaid = transactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
    return { totalDue, totalPaid, balance: totalDue - totalPaid }
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions
    if (filter === 'due') return transactions.filter(t => t.type === 'due')
    if (filter === 'paid') return transactions.filter(t => t.type === 'payment')
    return transactions
  }, [transactions, filter])

  const openEntryForm = (type) => {
    setFormType(type)
    setFormOpen(true)
    setAmount('')
    setNote('')
    setDate(new Date().toISOString().split('T')[0])
    setBillImage(null)
    setBillPreview(null)
    setError('')
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Max 10MB.')
      return
    }
    setBillImage(file)
    setBillPreview(URL.createObjectURL(file))
    setError('')
  }

  const handleAddEntry = async (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount.')
      return
    }
    setSaving(true)
    setError('')

    try {
      let imageId = null

      if (billImage) {
        setUploadProgress(true)
        const uploaded = await storage.createFile(
          BILL_BUCKET_ID,
          ID.unique(),
          billImage
        )
        imageId = uploaded.$id
        setUploadProgress(false)
      }

      await databases.createDocument(
        DB_ID,
        TRANSACTIONS_ID,
        ID.unique(),
        {
          customer_id: customerId,
          type: formType,
          amount: Number(amount),
          note: note.trim(),
          date: date,
          ...(imageId && { image_id: imageId }),
        }
      )

      setFormOpen(false)
      setBillImage(null)
      setBillPreview(null)
      setAmount('')
      setNote('')
      setDate(new Date().toISOString().split('T')[0])
      await fetchLedgerData()

    } catch (err) {
      setError(err?.message || 'Failed to add transaction.')
    } finally {
      setSaving(false)
      setUploadProgress(false)
    }
  }

  const handleDelete = async (tx) => {
    if (!window.confirm('Delete this entry? / हा व्यवहार काढायचा का?')) return
    setDeletingId(tx.$id)
    try {
      if (tx.image_id) {
        try {
          await storage.deleteFile(BILL_BUCKET_ID, tx.image_id)
        } catch {
          // continue even if image delete fails
        }
      }
      await databases.deleteDocument(DB_ID, TRANSACTIONS_ID, tx.$id)
      await fetchLedgerData()
    } catch {
      setError('Failed to delete transaction.')
    } finally {
      setDeletingId(null)
    }
  }

  const getBillImageUrl = (imageId) => {
    return storage.getFileView(BILL_BUCKET_ID, imageId)
  }

  const formatDate = (tx) => {
    const dateStr = tx.date || tx.$createdAt
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Navbar />

      <div className="w-full max-w-lg mx-auto px-3 py-4">

        {/* Back button */}
        {isOwner && (
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-green-700 mb-3 hover:underline flex items-center gap-1"
          >
            ← Back to Dashboard
          </button>
        )}

        {/* Customer Info + Balance Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
          <h1 className="text-lg font-bold text-gray-800">
            {customer?.full_name || 'Customer Ledger'}
          </h1>
          <p className="text-sm text-gray-400">
            @{customer?.username || ''}
            {customer?.phone ? ` · ${customer.phone}` : ''}
          </p>

          <div className="mt-3 pt-3 border-t">
            {balance > 0 && (
              <p className="text-2xl font-bold text-red-500">
                ₹{balance.toFixed(2)}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  Due / बाकी
                </span>
              </p>
            )}
            {balance === 0 && (
              <p className="text-2xl font-bold text-green-600">
                ✓ Clear / हिशोब साफ
              </p>
            )}
            {balance < 0 && (
              <p className="text-2xl font-bold text-orange-500">
                ₹{Math.abs(balance).toFixed(2)}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  Advance
                </span>
              </p>
            )}
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-red-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-400">Total Due / उधार</p>
              <p className="text-base font-bold text-red-500">
                ₹{totalDue.toFixed(2)}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-400">Total Paid / भरले</p>
              <p className="text-base font-bold text-green-600">
                ₹{totalPaid.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons — Owner only */}
        {isOwner && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => openEntryForm('due')}
              className="bg-red-500 text-white rounded-xl py-3 font-semibold hover:bg-red-600 active:bg-red-700 transition-colors text-sm"
            >
              + Add Due / उधार जोडा
            </button>
            <button
              onClick={() => openEntryForm('payment')}
              className="bg-green-600 text-white rounded-xl py-3 font-semibold hover:bg-green-700 active:bg-green-800 transition-colors text-sm"
            >
              + Payment / पैसे मिळाले
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All / सर्व' },
            { key: 'due', label: 'Due / उधार' },
            { key: 'paid', label: 'Paid / भरले' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex justify-between items-center">
            <h2 className="font-semibold text-gray-700 text-sm">
              History / इतिहास
            </h2>
            <span className="text-xs text-gray-400">
              {filteredTransactions.length} entries
            </span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Loading...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <p>No transactions yet</p>
              <p className="text-xs mt-1">अजून कोणतेही व्यवहार नाही</p>
            </div>
          ) : (
            filteredTransactions.map(tx => (
              <div
                key={tx.$id}
                className="px-4 py-3 border-b last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">

                  {/* Left — type + note */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tx.type === 'due'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {tx.type === 'due' ? 'उधार / Due' : 'भरले / Paid'}
                    </span>
                    {tx.note && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {tx.note}
                      </p>
                    )}
                  </div>

                  {/* Center — date */}
                  <p className="text-xs text-gray-400 shrink-0">
                    {formatDate(tx)}
                  </p>

                  {/* Right — amount + delete */}
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={`font-bold text-sm ${
                      tx.type === 'due' ? 'text-red-500' : 'text-green-600'
                    }`}>
                      {tx.type === 'due' ? '- ' : '+ '}
                      ₹{Number(tx.amount).toFixed(2)}
                    </p>
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(tx)}
                        disabled={deletingId === tx.$id}
                        className="text-gray-300 hover:text-red-500 transition-colors text-base disabled:opacity-40"
                      >
                        {deletingId === tx.$id ? '...' : '✕'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bill image button */}
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

        {/* Error message */}
        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-base font-bold ${
                formType === 'due' ? 'text-red-500' : 'text-green-700'
              }`}>
                {formType === 'due'
                  ? '+ Add Due / उधार जोडा'
                  : '+ Payment / पैसे मिळाले'}
              </h3>
              <button
                onClick={() => setFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleAddEntry} className="space-y-4">

              {/* Amount */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Amount (₹) / रक्कम
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full border rounded-xl px-3 py-3 focus:ring-2 focus:ring-green-500 focus:outline-none text-xl font-bold"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Note / टीप (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Fertilisers /Cash Payment / Online Payment / Cheque Payment"
                  className="w-full border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Date / तारीख
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                />
              </div>

              {/* Bill Image — only for due */}
              {formType === 'due' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Bill Image / बिल फोटो (optional)
                  </label>

                  {/* Image preview */}
                  {billPreview && (
                    <div className="relative mb-2">
                      <img
                        src={billPreview}
                        alt="Bill preview"
                        className="w-full h-40 object-cover rounded-xl border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBillImage(null)
                          setBillPreview(null)
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Camera + Gallery buttons */}
                  {!billPreview && (
                    <div className="grid grid-cols-2 gap-2">
                      {/* Camera */}
                      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-xl py-4 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors active:bg-green-100">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs text-gray-500 font-medium">
                          Camera / कॅमेरा
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>

                      {/* Gallery */}
                      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-xl py-4 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors active:bg-green-100">
                        <span className="text-2xl">🖼️</span>
                        <span className="text-xs text-gray-500 font-medium">
                          Gallery / गॅलरी
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 border border-gray-300 rounded-xl py-3 text-gray-600 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-60 transition-colors ${
                    formType === 'due'
                      ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
                  }`}
                >
                  {saving
                    ? uploadProgress
                      ? 'Uploading...'
                      : 'Saving...'
                    : formType === 'due'
                    ? 'Add Due'
                    : 'Add Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default Ledger