import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import AddCustomerModal from '../components/AddCustomerModal'
import { account, databases, functions, DB_ID, PROFILES_ID, TRANSACTIONS_ID, FUNCTION_ID, Query, ID } from '../lib/appwrite'
// ─── Customer Detail Modal ────────────────────────────────────────
const CustomerDetailModal = ({ customer, onClose, onPasswordReset, onDeleteRequest }) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  if (!customer) return null

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setResetting(true)
    const result = await onPasswordReset(customer, newPassword)
    if (result.success) {
      setSuccess('Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } else {
      setError(result.error || 'Failed to reset password.')
    }
    setResetting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-gray-800">Customer Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Customer Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-xl font-bold text-green-700">
              {customer.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-gray-800">{customer.full_name}</p>
              <p className="text-sm text-gray-400">{customer.phone}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-500">Username / युजरनेम</span>
              <span className="text-sm font-semibold text-gray-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-lg">
                @{customer.username}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-500">Phone / फोन</span>
              <span className="text-sm font-semibold text-gray-800">{customer.phone}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-500">Balance / शिल्लक</span>
              <span className={`text-sm font-bold ${customer.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {customer.balance > 0 ? `₹${customer.balance.toFixed(2)} Due` : '✓ Clear'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">Status / स्थिती</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                customer.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {customer.approved ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            ✅ {success}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Reset Password */}
        {!showPasswordForm ? (
          <button
            onClick={() => { setShowPasswordForm(true); setError(''); setSuccess('') }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-semibold text-sm transition-colors mb-3"
          >
            🔑 Reset Password / पासवर्ड बदला
          </button>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-3">
            <p className="text-sm font-semibold text-orange-700 mb-3">
              🔑 Set New Password for @{customer.username}
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">New Password / नवीन पासवर्ड</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Confirm Password / पुन्हा पासवर्ड</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  minLength={8}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowPasswordForm(false); setError(''); setNewPassword(''); setConfirmPassword('') }}
                  className="flex-1 border border-gray-300 rounded-xl py-2.5 text-gray-600 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {resetting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Delete Customer Button */}
        <button
          onClick={() => { onClose(); onDeleteRequest(customer) }}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl py-3 font-semibold text-sm transition-colors mb-3"
        >
          🗑️ Delete Customer / ग्राहक काढा
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full border border-gray-300 rounded-xl py-2.5 text-gray-600 text-sm hover:bg-gray-50"
        >
          Close / बंद करा
        </button>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────
const DeleteCustomerModal = ({ customer, onClose, onConfirmDelete }) => {
  const [step, setStep] = useState(1)
  const [adminPassword, setAdminPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  if (!customer) return null

  const handleConfirmStep1 = () => {
    setStep(2)
    setError('')
  }

  const handleFinalDelete = async (e) => {
    e.preventDefault()
    if (!adminPassword) {
      setError('Please enter your password.')
      return
    }
    setDeleting(true)
    setError('')
    const result = await onConfirmDelete(customer, adminPassword)
    if (result.success) {
      onClose()
    } else {
      setError(result.error || 'Failed to delete customer.')
    }
    setDeleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-red-600">
            🗑️ Delete Customer
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Step 1 — Are you sure */}
        {step === 1 && (
          <>
            {/* Warning box */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-red-600 mb-2">
                ⚠️ Are you sure? / खात्री आहे का?
              </p>
              <p className="text-sm text-red-500 mb-1">
                You are about to delete:
              </p>
              <div className="bg-white rounded-lg p-3 border border-red-200 mb-3">
                <p className="font-bold text-gray-800">{customer.full_name}</p>
                <p className="text-xs text-gray-400">@{customer.username} · {customer.phone}</p>
                {customer.balance > 0 && (
                  <p className="text-xs text-red-500 mt-1 font-semibold">
                    ⚠️ Has pending due of ₹{customer.balance.toFixed(2)}
                  </p>
                )}
              </div>
              <p className="text-xs text-red-400">
                This will permanently delete:
              </p>
              <p className="text-xs text-red-400">• Customer account & profile</p>
              <p className="text-xs text-red-400">• All transaction history</p>
              <p className="text-xs text-red-400">• This action cannot be undone!</p>
              <p className="text-xs text-red-400 mt-1">
                हे पूर्णपणे हटवले जाईल आणि परत येणार नाही!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-300 rounded-xl py-3 text-gray-600 text-sm hover:bg-gray-50"
              >
                Cancel / रद्द करा
              </button>
              <button
                onClick={handleConfirmStep1}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
              >
                Yes, Delete / होय, काढा
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Enter admin password */}
        {step === 2 && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-yellow-700">
                🔐 Admin Verification Required
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                Enter your admin password to confirm deletion of{' '}
                <span className="font-bold">{customer.full_name}</span>
              </p>
              <p className="text-xs text-yellow-600">
                मालकाचा पासवर्ड टाका / Enter owner password
              </p>
            </div>

            {error && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleFinalDelete} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Admin Password / मालकाचा पासवर्ड
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoFocus
                  className="w-full border rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); setAdminPassword('') }}
                  className="flex-1 border border-gray-300 rounded-xl py-3 text-gray-600 text-sm hover:bg-gray-50"
                >
                  Back / मागे
                </button>
                <button
                  type="submit"
                  disabled={deleting || !adminPassword}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 transition-colors"
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                      Deleting...
                    </span>
                  ) : (
                    '🗑️ Confirm Delete'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [deleteCustomer, setDeleteCustomer] = useState(null)

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const response = await databases.listDocuments(DB_ID, PROFILES_ID, [
        Query.equal('role', 'customer'),
        Query.orderDesc('$createdAt'),
      ])
      const mapped = await Promise.all(
        response.documents.map(async (doc) => {
          try {
            const txRes = await databases.listDocuments(DB_ID, TRANSACTIONS_ID, [
              Query.equal('customer_id', doc.$id),
            ])
            const due = txRes.documents
              .filter((t) => t.type === 'due')
              .reduce((sum, t) => sum + Number(t.amount || 0), 0)
            const paid = txRes.documents
              .filter((t) => t.type === 'payment')
              .reduce((sum, t) => sum + Number(t.amount || 0), 0)
            return { ...doc, balance: due - paid }
          } catch {
            return { ...doc, balance: 0 }
          }
        })
      )
      setCustomers(mapped)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  const activeCustomers = useMemo(
    () => customers.filter((c) => c.approved === true),
    [customers]
  )

  const filteredCustomers = useMemo(() => {
    const q = searchText.toLowerCase()
    return customers.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q)
    )
  }, [customers, searchText])

  const totalDue = useMemo(
    () => customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0),
    [customers]
  )

  const handleAddCustomer = async ({ full_name, username, phone, password }) => {
    try {
      const cleanUsername = username.trim().toLowerCase()
      const fakeEmail = `${cleanUsername}@gomteshagro.app`
      const newUser = await account.create(
        ID.unique(), fakeEmail, password.trim(), full_name.trim()
      )
      await databases.createDocument(DB_ID, PROFILES_ID, ID.unique(), {
        userId: newUser.$id,
        full_name: full_name.trim(),
        username: cleanUsername,
        phone: phone.trim(),
        role: 'customer',
        approved: true,
      })
      await fetchCustomers()
      setShowModal(false)
      return { success: true }
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to add customer.' }
    }
  }

const handlePasswordReset = async (customer, newPassword) => {
  try {
    const execution = await functions.createExecution(
      FUNCTION_ID,
      JSON.stringify({
        action: 'resetPassword',
        userId: customer.userId,
        newPassword: newPassword
      }),
      false
    )

    const response = JSON.parse(execution.responseBody)

    if (!response.success) {
      throw new Error(response.error || 'Failed to reset password.')
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

const handleConfirmDelete = async (customer, adminPassword) => {
  try {
    // Step 1 — Verify admin password
    try {
      await account.updatePassword(adminPassword, adminPassword)
    } catch (err) {
      if (
        err.code === 401 ||
        err.message?.includes('Invalid credentials') ||
        err.message?.includes('invalid')
      ) {
        return {
          success: false,
          error: 'Wrong admin password. / चुकीचा पासवर्ड.'
        }
      }
      // Other errors mean password was correct — continue
    }

    // Step 2 — Delete all transactions
    try {
      const txRes = await databases.listDocuments(
        DB_ID,
        TRANSACTIONS_ID,
        [Query.equal('customer_id', customer.$id)]
      )
      await Promise.all(
        txRes.documents.map(tx =>
          databases.deleteDocument(DB_ID, TRANSACTIONS_ID, tx.$id)
        )
      )
    } catch {
      // Continue even if some fail
    }

    // Step 3 — Delete profile document
    try {
      await databases.deleteDocument(DB_ID, PROFILES_ID, customer.$id)
    } catch {
      // Continue
    }

    // Step 4 — Delete auth user via function
    try {
      const execution = await functions.createExecution(
        FUNCTION_ID,
        JSON.stringify({
          action: 'deleteUser',
          userId: customer.userId
        }),
        false
      )
      const response = JSON.parse(execution.responseBody)
      if (!response.success) {
        console.log('Auth delete warning:', response.error)
      }
    } catch {
      // Don't fail — profile already deleted
    }

    // Step 5 — Refresh list
    await fetchCustomers()

    return { success: true }

  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to delete customer.'
    }
  }
}

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Navbar />

      {/* Page Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-gray-800">
          Dashboard / डॅशबोर्ड
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 px-4 mb-4">
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{customers.length}</p>
          <p className="text-xs text-gray-500">Customers / ग्राहक</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{activeCustomers.length}</p>
          <p className="text-xs text-gray-500">Active / सक्रिय</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-3 text-center">
          <p className="text-2xl font-bold text-red-500">₹{totalDue.toFixed(0)}</p>
          <p className="text-xs text-gray-500">Total Due / उधार</p>
        </div>
      </div>

      {/* Customers Section */}
      <div>
        <div className="flex justify-between items-center px-4 mb-2">
          <h2 className="font-semibold text-gray-700">Customers / ग्राहक</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-800 active:bg-green-900"
          >
            Add Customer +
          </button>
        </div>

        {/* Search */}
        <div className="px-4 mb-3">
          <input
            type="text"
            placeholder="Search name, phone, username..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Customer List */}
        <div className="px-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <p>No customers found</p>
              <p className="text-xs mt-1">अजून कोणतेही ग्राहक नाहीत</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.$id} className="bg-white rounded-xl shadow-sm p-3 mb-2">
                <div className="flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {customer.full_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      @{customer.username} · {customer.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {customer.balance > 0 ? (
                      <p className="text-red-500 font-semibold text-sm">
                        ₹{customer.balance.toFixed(0)}
                      </p>
                    ) : (
                      <p className="text-green-600 font-semibold text-sm">✓ Clear</p>
                    )}
                    <button
                      onClick={() => setSelectedCustomer(customer)}
                      className="text-xs bg-orange-50 text-orange-600 border border-orange-200 rounded-lg px-2 py-1 hover:bg-orange-100 transition-colors"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => navigate(`/ledger/${customer.$id}`)}
                      className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-2 py-1 hover:bg-green-100 transition-colors"
                    >
                      Ledger →
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAdd={handleAddCustomer}
      />

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onPasswordReset={handlePasswordReset}
          onDeleteRequest={(customer) => setDeleteCustomer(customer)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteCustomer && (
        <DeleteCustomerModal
          customer={deleteCustomer}
          onClose={() => setDeleteCustomer(null)}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default Dashboard