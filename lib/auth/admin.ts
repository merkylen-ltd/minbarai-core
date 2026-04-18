/**
 * Admin Authentication Utilities
 * 
 * Provides functions to check if a user has admin privileges based on email whitelist.
 * Admin emails are configured via the ADMIN_EMAILS environment variable.
 */

/**
 * Get the list of admin emails from environment variables
 * @returns Array of admin email addresses
 */
export function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS || ''
  return adminEmails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0)
}

/**
 * Check if an email address belongs to an admin user
 * @param email - The email address to check (should be from Supabase Auth, which normalizes to lowercase)
 * @returns True if the email is in the admin whitelist, false otherwise
 */
export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) {
    return false
  }

  const adminEmails = getAdminEmails()

  if (adminEmails.length === 0) {
    console.warn('[Admin Auth] No admin emails configured in ADMIN_EMAILS environment variable')
    return false
  }

  // Email normalization: Supabase Auth always stores emails in lowercase,
  // and the ADMIN_EMAILS config is normalized to lowercase (line 16).
  // This ensures safe comparison regardless of how the email was originally provided.
  const normalizedEmail = email.trim().toLowerCase()
  return adminEmails.includes(normalizedEmail)
}

/**
 * Error thrown when a user tries to access admin resources without proper privileges
 */
export class AdminAccessDeniedError extends Error {
  constructor(message: string = 'Access denied: Admin privileges required') {
    super(message)
    this.name = 'AdminAccessDeniedError'
  }
}

/**
 * Verify that a user has admin privileges, throw error if not
 * @param email - The email address to verify
 * @throws AdminAccessDeniedError if the user is not an admin
 */
export function requireAdmin(email: string | null | undefined): void {
  if (!isAdminUser(email)) {
    throw new AdminAccessDeniedError(
      email 
        ? `Access denied: User ${email} does not have admin privileges`
        : 'Access denied: No user email provided'
    )
  }
}
