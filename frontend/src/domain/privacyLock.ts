/**
 * Privacy lock domain logic: PIN hashing and verification
 */

const SALT = 'safety_v2_pin_salt_2026'

/**
 * Hash a PIN using a deterministic algorithm
 * Uses multiple rounds for sufficient entropy
 */
export function hashPin(pin: string): string {
  const input = SALT + pin
  let hash = 0
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to hex string with sufficient length
  const base = Math.abs(hash).toString(16).padStart(8, '0')
  
  // Add additional rounds for more entropy
  let extended = base
  for (let round = 0; round < 8; round++) {
    let roundHash = 0
    const roundInput = extended + round + input
    for (let i = 0; i < roundInput.length; i++) {
      const char = roundInput.charCodeAt(i)
      roundHash = ((roundHash << 5) - roundHash) + char
      roundHash = roundHash & roundHash
    }
    extended += Math.abs(roundHash).toString(16).padStart(8, '0')
  }
  
  return extended.slice(0, 64) // Return 64-character hex string
}

/**
 * Verify a PIN against a stored hash
 */
export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash
}
