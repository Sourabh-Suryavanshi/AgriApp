# Supabase to Appwrite Migration Guide

## ✅ Completed Changes

All Supabase references have been removed from your project and replaced with Appwrite.

### Files Modified:
1. **package.json** - Removed `@supabase/supabase-js`, added `appwrite`
2. **src/lib/appwrite.js** - NEW: Appwrite configuration file
3. **src/context/AuthContext.jsx** - Updated to use Appwrite auth and database
4. **src/pages/Login.jsx** - Updated to use Appwrite authentication
5. **src/pages/Register.jsx** - Updated to use Appwrite auth and database
6. **src/pages/Ledger.jsx** - Updated to use Appwrite database queries
7. **src/pages/PendingApproval.jsx** - Updated to use Appwrite logout
8. **src/components/Navbar.jsx** - Updated to use Appwrite logout
9. **src/hooks/useCustomers.js** - Updated to use Appwrite database operations
10. **src/hooks/useTransactions.js** - Updated to use Appwrite database operations

### Old Files to Delete:
- `src/lib/supabase.js` - No longer needed

---

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Appwrite Account & Project
- Go to https://cloud.appwrite.io
- Sign up and create a new project
- Note your:
  - **Endpoint** (e.g., https://cloud.appwrite.io/v1)
  - **Project ID**

### 3. Create Database & Collections
In Appwrite Console:

#### Database
- Create a new database and note its **Database ID**

#### Collections (with these attributes):
1. **profiles** collection
   - `userId` (String)
   - `full_name` (String)
   - `username` (String, unique)
   - `phone` (String)
   - `role` (String, enum: "owner", "customer")
   - `approved` (Boolean)

2. **transactions** collection
   - `customer_id` (String)
   - `type` (String, enum: "due", "payment")
   - `amount` (Number)
   - `note` (String)
   - `created_at` (DateTime)

### 4. Set Environment Variables
Create a `.env.local` file in your project root:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id_here
VITE_APPWRITE_DATABASE_ID=your_database_id_here
VITE_APPWRITE_PROFILES_COLLECTION_ID=your_profiles_collection_id_here
VITE_APPWRITE_TRANSACTIONS_COLLECTION_ID=your_transactions_collection_id_here
```

### 5. Configure Appwrite Permissions
In Appwrite Console, set collection permissions to allow guest/user access:
- **profiles** collection: Allow create, read, update, delete for authenticated users
- **transactions** collection: Allow create, read, update, delete for authenticated users

### 6. Install npm packages
```bash
npm install
npm run dev
```

---

## 📝 API Changes Summary

### Authentication
- **Supabase**: `supabase.auth.signInWithPassword()`
- **Appwrite**: `account.createEmailPasswordSession()`

### Database Queries
- **Supabase**: `.from('table').select().eq()`
- **Appwrite**: `databases.listDocuments(..., [Query.equal()])`

### Insert/Update/Delete
- **Supabase**: `.insert()`, `.update()`, `.delete()`
- **Appwrite**: `databases.createDocument()`, `updateDocument()`, `deleteDocument()`

---

## ⚠️ Important Notes

1. **Document IDs**: In Appwrite, the `$id` field is the document ID (equivalent to Supabase's `id`)
2. **Metadata Fields**: Appwrite automatically adds `$id`, `$createdAt`, `$updatedAt` fields
3. **Unique IDs**: Use `'unique()'` when creating documents to auto-generate IDs
4. **Queries**: Import `Query` from appwrite for filters: `import { Query } from 'appwrite'`
5. **Error Handling**: Appwrite throws exceptions directly; wrap in try-catch blocks

---

## 🧪 Testing Checklist

- [ ] Dependencies installed successfully
- [ ] .env.local configured with Appwrite credentials
- [ ] Can register a new user
- [ ] Can login with created account
- [ ] Can add/view transactions
- [ ] Can manage customers (if owner)
- [ ] User profile fetches correctly
- [ ] Logout works properly

---

## 📚 Resources

- [Appwrite Documentation](https://appwrite.io/docs)
- [Appwrite SDK for Web](https://appwrite.io/docs/sdks/web)
- [Appwrite Database Guide](https://appwrite.io/docs/databases)
