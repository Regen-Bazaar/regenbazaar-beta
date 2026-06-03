import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create a single instance of the Supabase client with improved configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Add retries and timeout configuration
  global: {
    fetch: (...args) => {
      return fetchWithRetry(() => fetch(...args))
    },
  },
})

// Utility function to handle retries
async function fetchWithRetry(
  fetchFn: () => Promise<Response>,
  maxRetries = 3,
  delay = 1000
): Promise<Response> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetchFn()
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Fetch attempt ${i + 1} failed:`, error)

      // Don't wait on the last attempt
      if (i < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, i))
        ) // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Failed to fetch after retries')
}

// Helper function to check if error is a network error
export function isNetworkError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: string }).message
    return (
      message === 'Failed to fetch' ||
      message === 'Network request failed' ||
      message.includes('network')
    )
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code
    return code === 'ECONNABORTED' || code === 'ETIMEDOUT'
  }
  return false
}

// Helper function to handle Supabase errors consistently
export function handleSupabaseError(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Network connection error. Please check your internet connection and try again.'
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code
    if (code === '23505') {
      // Unique violation
      return 'This record already exists.'
    }

    if (code === '23503') {
      // Foreign key violation
      return 'Referenced record does not exist.'
    }
  }

  // Log unexpected errors for debugging
  console.error('Unexpected Supabase error:', error)
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred. Please try again.'
}
