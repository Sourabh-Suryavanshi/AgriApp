import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import {
  databases, storage,
  DB_ID, PROFILES_ID, TRANSACTIONS_ID, BILL_BUCKET_ID,
  Query, ID
} from '../lib/appwrite'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import imageCompression from 'browser-image-compression'

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
  const [compressing, setCompressing] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [customerPhone, setCustomerPhone] = useState('')
  const [expandedImage, setExpandedImage] = useState(null)
  const [zoomedImage, setZoomedImage] = useState(null)


  const canAccess = isOwner || customerId === userProfile?.$id

  const fetchLedgerData = async () => {
    setLoading(true)
    setError('')
    try {
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

  // ── Image compression + HEIC fix ──────────────────────────────
  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setCompressing(true)
    setError('')

    try {
      // Compression options
      const options = {
        maxSizeMB: 0.5,          // Max 500KB after compression
        maxWidthOrHeight: 1280,   // Max dimension 1280px
        useWebWorker: true,
        fileType: 'image/jpeg',   // Convert everything to JPEG
        // This fixes HEIC from iPhone — converts to JPEG
        onProgress: (progress) => {
          console.log('Compression progress:', progress)
        }
      }

      const compressedFile = await imageCompression(file, options)

      console.log('Original size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
      console.log('Compressed size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB')

      // Create a proper JPEG file with correct name
      const jpegFile = new File(
        [compressedFile],
        `bill_${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      )

      setBillImage(jpegFile)
      setBillPreview(URL.createObjectURL(jpegFile))

    } catch (err) {
      console.log('Compression error:', err)
      setError('Could not process image. Try again.')
    } finally {
      setCompressing(false)
    }
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
        try { await storage.deleteFile(BILL_BUCKET_ID, tx.image_id) } catch {}
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

  const formatDate = (tx) => {
    const dateStr = tx.date || tx.$createdAt
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  // ── PDF Generator ──────────────────────────────────────────────
  const generatePDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })

    doc.setFillColor(34, 102, 56)
    doc.rect(0, 0, pageWidth, 38, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Gomtesh Agro Agency', pageWidth / 2, 14, { align: 'center' })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Udhaar Ledger Statement', pageWidth / 2, 22, { align: 'center' })
    doc.text(`Generated: ${today}`, pageWidth / 2, 30, { align: 'center' })

    doc.setTextColor(0, 0, 0)
    doc.setFillColor(240, 253, 244)
    doc.roundedRect(14, 44, pageWidth - 28, 28, 3, 3, 'F')

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Customer Details', 20, 53)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Name: ${customer?.full_name || ''}`, 20, 61)
    doc.text(`Phone: ${customer?.phone || ''}`, 20, 67)
    doc.text(`Username: @${customer?.username || ''}`, 110, 61)

    doc.setFillColor(255, 245, 245)
    doc.roundedRect(14, 78, pageWidth - 28, 26, 3, 3, 'F')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 0, 0)
    doc.text(`Total Due:  Rs. ${totalDue.toFixed(2)}`, 20, 88)
    doc.setTextColor(0, 120, 60)
    doc.text(`Total Paid: Rs. ${totalPaid.toFixed(2)}`, 110, 88)

    doc.setFontSize(12)
    if (balance > 0) {
      doc.setTextColor(180, 0, 0)
      doc.text(`Balance Due: Rs. ${balance.toFixed(2)}`, 20, 98)
    } else if (balance === 0) {
      doc.setTextColor(0, 120, 60)
      doc.text('Balance: CLEAR (Hishob Saaf)', 20, 98)
    } else {
      doc.setTextColor(200, 100, 0)
      doc.text(`Advance: Rs. ${Math.abs(balance).toFixed(2)}`, 20, 98)
    }

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Transaction History', 14, 114)

    const tableRows = transactions.map((tx, index) => [
      index + 1,
      formatDate(tx),
      tx.type === 'due' ? 'Due (Udhaar)' : 'Payment (Bharle)',
      tx.note || '—',
      tx.type === 'due'
        ? `- Rs. ${Number(tx.amount).toFixed(2)}`
        : `+ Rs. ${Number(tx.amount).toFixed(2)}`,
    ])

    autoTable(doc, {
      startY: 118,
      head: [['#', 'Date', 'Type', 'Note', 'Amount']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [34, 102, 56],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 60 },
        4: { cellWidth: 35, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [245, 255, 248] },
      margin: { left: 14, right: 14 },
    })

    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'italic')
    doc.text(
      'This is a computer-generated statement from Gomtesh Agro Agency.',
      pageWidth / 2, finalY, { align: 'center' }
    )
    doc.text(
      'For any queries contact the shop owner.',
      pageWidth / 2, finalY + 5, { align: 'center' }
    )

    return doc
  }

  const handleDownloadPDF = () => {
    setGeneratingPdf(true)
    try {
      const doc = generatePDF()
      const fileName = `${customer?.full_name || 'customer'}_ledger_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch {
      setError('Failed to generate PDF.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const buildWhatsAppText = () => {
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    })

    let text = `🌾 *Gomtesh Agro Agency*\n`
    text += `📋 *Ledger Statement*\n`
    text += `📅 Date: ${today}\n`
    text += `─────────────────────\n`
    text += `👤 *Customer: ${customer?.full_name}*\n`
    text += `📞 Phone: ${customer?.phone}\n`
    text += `─────────────────────\n`
    text += `💰 *Balance Summary*\n`
    text += `🔴 Total Due:  ₹${totalDue.toFixed(2)}\n`
    text += `🟢 Total Paid: ₹${totalPaid.toFixed(2)}\n`

    if (balance > 0) {
      text += `⚠️ *Balance Due: ₹${balance.toFixed(2)}*\n`
    } else if (balance === 0) {
      text += `✅ *Balance: CLEAR (हिशोब साफ)*\n`
    } else {
      text += `🟡 *Advance: ₹${Math.abs(balance).toFixed(2)}*\n`
    }

    text += `─────────────────────\n`
    text += `📝 *Recent Transactions*\n\n`

    const recent = transactions.slice(0, 10)
    recent.forEach((tx, i) => {
      const emoji = tx.type === 'due' ? '🔴' : '🟢'
      const sign = tx.type === 'due' ? '-' : '+'
      const note = tx.note ? ` (${tx.note})` : ''
      text += `${emoji} ${formatDate(tx)}${note}\n`
      text += `   ${sign}₹${Number(tx.amount).toFixed(2)}\n`
      if (i < recent.length - 1) text += `\n`
    })

    if (transactions.length > 10) {
      text += `\n_...and ${transactions.length - 10} more transactions_\n`
    }

    text += `─────────────────────\n`
    text += `🌾 Gomtesh Agro Agency\n`
    text += `_Thank you for your business!_`

    return text
  }

  const handleShare = () => {
    setCustomerPhone(customer?.phone || '')
    setShareModalOpen(true)
  }

  const handleSendWhatsApp = () => {
    handleDownloadPDF()
    const text = buildWhatsAppText()
    const encoded = encodeURIComponent(text)
    const rawPhone = customerPhone.replace(/\D/g, '')
    const phone = rawPhone.startsWith('91') ? rawPhone : `91${rawPhone}`
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
    setShareModalOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <Navbar />

      <div className="w-full max-w-lg mx-auto px-3 py-4">

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
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-lg font-bold text-gray-800">
                {customer?.full_name || 'Customer Ledger'}
              </h1>
              <p className="text-sm text-gray-400">
                @{customer?.username || ''}
                {customer?.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
            {isOwner && (
              <button
                onClick={handleShare}
                disabled={generatingPdf || loading}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50 shrink-0"
              >
                📤 Share
              </button>
            )}
          </div>

          <div className="mt-3 pt-3 border-t">
            {balance > 0 && (
              <p className="text-2xl font-bold text-red-500">
                ₹{balance.toFixed(2)}
                <span className="text-sm font-normal text-gray-500 ml-2">Due / बाकी</span>
              </p>
            )}
            {balance === 0 && (
              <p className="text-2xl font-bold text-green-600">✓ Clear / हिशोब साफ</p>
            )}
            {balance < 0 && (
              <p className="text-2xl font-bold text-orange-500">
                ₹{Math.abs(balance).toFixed(2)}
                <span className="text-sm font-normal text-gray-500 ml-2">Advance</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-red-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-400">Total Due / उधार</p>
              <p className="text-base font-bold text-red-500">₹{totalDue.toFixed(2)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-gray-400">Total Paid / भरले</p>
              <p className="text-base font-bold text-green-600">₹{totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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
    <h2 className="font-semibold text-gray-700 text-sm">History / इतिहास</h2>
    <span className="text-xs text-gray-400">{filteredTransactions.length} entries</span>
  </div>

  {loading ? (
    <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
  ) : filteredTransactions.length === 0 ? (
    <div className="text-center py-10 text-gray-400 text-sm">
      <p>No transactions yet</p>
      <p className="text-xs mt-1">अजून कोणतेही व्यवहार नाही</p>
    </div>
  ) : (
    filteredTransactions.map(tx => (
      <div key={tx.$id} className="border-b last:border-b-0">

        {/* Transaction Row */}
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              tx.type === 'due' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
            }`}>
              {tx.type === 'due' ? 'उधार / Due' : 'भरले / Paid'}
            </span>
            {tx.note && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{tx.note}</p>
            )}
          </div>

          <p className="text-xs text-gray-400 shrink-0">{formatDate(tx)}</p>

          <div className="flex items-center gap-2 shrink-0">
            <p className={`font-bold text-sm ${
              tx.type === 'due' ? 'text-red-500' : 'text-green-600'
            }`}>
              {tx.type === 'due' ? '- ' : '+ '}₹{Number(tx.amount).toFixed(2)}
            </p>

            {/* View Bill toggle button */}
            {tx.image_id && (
              <button
                onClick={() =>
                  setExpandedImage(
                    expandedImage === tx.$id ? null : tx.$id
                  )
                }
                className={`text-xs px-2 py-1 rounded-lg border transition-colors shrink-0 ${
                  expandedImage === tx.$id
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                }`}
              >
                {expandedImage === tx.$id ? '🔼 Hide' : '🧾 Bill'}
              </button>
            )}

            {/* Delete button */}
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

       {/* Inline Bill Image — expands below the row */}
{tx.image_id && expandedImage === tx.$id && (
  <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">

    {/* Image header */}
    <div className="flex justify-between items-center py-2 mb-2">
      <p className="text-xs font-semibold text-gray-600">
        🧾 Bill Image / बिल फोटो
      </p>
      <button
        onClick={() => {
          setExpandedImage(null)
          setZoomedImage(null)
        }}
        className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
      >
        ✕ Close
      </button>
    </div>

    {/* Image */}
    <div className="relative">
      <img
        src={getBillImageUrl(tx.image_id)}
        alt="Bill"
        className="w-full rounded-xl border border-gray-200 object-contain max-h-72 bg-white cursor-zoom-in"
        onClick={() => setZoomedImage(getBillImageUrl(tx.image_id))}
        onError={(e) => {
          e.target.style.display = 'none'
          e.target.nextSibling.style.display = 'flex'
        }}
      />

      {/* Error fallback */}
      <div className="hidden flex-col items-center justify-center gap-2 py-8 bg-white rounded-xl border border-gray-200">
        <span className="text-3xl">🖼️</span>
        <p className="text-xs text-gray-400">Could not load image</p>
        
          href={getBillImageUrl(tx.image_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-700 underline"
        <a>
          Open in new tab →
        </a>
      </div>

      {/* Amount overlay */}
      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-lg">
        {tx.type === 'due' ? '- ' : '+ '}₹{Number(tx.amount).toFixed(2)}
      </div>

      {/* Zoom hint */}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
        🔍 Tap to zoom / झूम करा
      </div>
    </div>

    {/* Verify row */}
    <div className="mt-2 flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
      <div>
        <p className="text-xs text-gray-400">Entered Amount / रक्कम</p>
        <p className={`text-sm font-bold ${
          tx.type === 'due' ? 'text-red-500' : 'text-green-600'
        }`}>
          {tx.type === 'due' ? '- ' : '+ '}₹{Number(tx.amount).toFixed(2)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-400">Date / तारीख</p>
        <p className="text-xs font-semibold text-gray-700">{formatDate(tx)}</p>
      </div>
      {tx.note && (
        <div className="text-right">
          <p className="text-xs text-gray-400">Note / टीप</p>
          <p className="text-xs font-semibold text-gray-700">{tx.note}</p>
        </div>
      )}
    </div>
  </div>
)}
      </div>
    ))
  )}
</div>

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-800">📤 Share Ledger</h3>
              <button onClick={() => setShareModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-gray-700">{customer?.full_name}</p>
              <p className="text-xs text-gray-400">
                {balance > 0 ? `₹${balance.toFixed(2)} Due` : balance === 0 ? 'Clear / साफ' : `₹${Math.abs(balance).toFixed(2)} Advance`}
              </p>
              <p className="text-xs text-gray-400 mt-1">{transactions.length} transactions total</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">WhatsApp Number / व्हाट्सएप नंबर</label>
              <div className="flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
                <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-r">+91</span>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="9876543210"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-green-700 mb-1">What will happen:</p>
              <p className="text-xs text-green-600">📥 PDF downloads to your device</p>
              <p className="text-xs text-green-600">💬 WhatsApp opens with transaction summary</p>
              <p className="text-xs text-green-600">📎 Attach the PDF in WhatsApp manually</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShareModalOpen(false)} className="flex-1 border border-gray-300 rounded-xl py-3 text-gray-600 text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSendWhatsApp}
                disabled={!customerPhone || customerPhone.length < 10}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                <span>📲</span> Send on WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-base font-bold ${formType === 'due' ? 'text-red-500' : 'text-green-700'}`}>
                {formType === 'due' ? '+ Add Due / उधार जोडा' : '+ Payment / पैसे मिळाले'}
              </h3>
              <button onClick={() => setFormOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center">✕</button>
            </div>

            {error && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Amount (₹) / रक्कम</label>
                <input
                  type="number" min="1" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  required placeholder="0.00"
                  className="w-full border rounded-xl px-3 py-3 focus:ring-2 focus:ring-green-500 focus:outline-none text-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Note / टीप (optional)</label>
                <input
                  type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Fertilizer / खत"
                  className="w-full border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Date / तारीख</label>
                <input
                  type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
                />
              </div>

              {/* Bill Image — only for due */}
              {formType === 'due' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    Bill Image / बिल फोटो (optional)
                  </label>

                  {/* Compression info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
                    <p className="text-xs text-blue-600">
                      📦 Images are auto-compressed to save space. iPhone photos supported ✅
                    </p>
                  </div>

                  {/* Compressing indicator */}
                  {compressing && (
                    <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-2">
                      <div className="animate-spin w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full" />
                      Compressing image... / इमेज संकुचित करत आहे...
                    </div>
                  )}

                  {/* Preview */}
                  {billPreview && !compressing && (
                    <div className="relative mb-2">
                      <img
                        src={billPreview}
                        alt="Bill preview"
                        className="w-full h-40 object-cover rounded-xl border"
                      />
                      <button
                        type="button"
                        onClick={() => { setBillImage(null); setBillPreview(null) }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                      >
                        ✕
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                        {billImage && `${(billImage.size / 1024).toFixed(0)} KB`}
                      </div>
                    </div>
                  )}

                  {/* Camera + Gallery */}
                  {!billPreview && !compressing && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-xl py-4 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors active:bg-green-100">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs text-gray-500 font-medium">Camera / कॅमेरा</span>
                        <input
                          type="file" accept="image/*"
                          capture="environment"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-gray-300 rounded-xl py-4 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors active:bg-green-100">
                        <span className="text-2xl">🖼️</span>
                        <span className="text-xs text-gray-500 font-medium">Gallery / गॅलरी</span>
                        <input
                          type="file" accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={() => setFormOpen(false)}
                  className="flex-1 border border-gray-300 rounded-xl py-3 text-gray-600 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || compressing}
                  className={`flex-1 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-60 transition-colors ${
                    formType === 'due' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {compressing
                    ? 'Compressing...'
                    : saving
                    ? uploadProgress ? 'Uploading...' : 'Saving...'
                    : formType === 'due' ? 'Add Due' : 'Add Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Zoom Modal */}
{zoomedImage && (
  <div
    className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
    onClick={() => setZoomedImage(null)}
  >
    {/* Close button */}
    <button
      onClick={() => setZoomedImage(null)}
      className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/30 rounded-full w-9 h-9 flex items-center justify-center text-lg transition-colors z-10"
    >
      ✕
    </button>

    {/* Hint text */}
    <p className="absolute top-4 left-4 text-white/50 text-xs">
      Pinch to zoom • Tap outside to close
    </p>

    {/* Zoomable image */}
    <div
      className="w-full h-full flex items-center justify-center p-4"
      onClick={e => e.stopPropagation()}
    >
      <img
        src={zoomedImage}
        alt="Bill zoomed"
        className="max-w-full max-h-full object-contain rounded-lg"
        style={{
          touchAction: 'pinch-zoom',
          cursor: 'zoom-out'
        }}
        onClick={() => setZoomedImage(null)}
      />
    </div>
  </div>
)}
    </div>
    
  )
}

export default Ledger