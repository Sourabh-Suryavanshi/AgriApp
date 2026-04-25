import { Client, Account, Databases,Storage,Functions, Query, ID } from 'appwrite'

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID
const APPWRITE_DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID
const APPWRITE_PROFILES_COLLECTION_ID = import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID
const APPWRITE_TRANSACTIONS_COLLECTION_ID = import.meta.env.VITE_APPWRITE_TRANSACTIONS_COLLECTION_ID

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
  throw new Error('Missing Appwrite endpoint or project ID in environment variables.')
}


const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)

export const account = new Account(client)
export const databases = new Databases(client)

export const DB_ID = APPWRITE_DATABASE_ID
export const PROFILES_ID = APPWRITE_PROFILES_COLLECTION_ID
export const TRANSACTIONS_ID = APPWRITE_TRANSACTIONS_COLLECTION_ID
export const storage = new Storage(client)
export const BILL_BUCKET_ID = '69ebcb78001b3a005b1d'
export const functions = new Functions(client)


export { Query, ID }
export default client