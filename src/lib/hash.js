// SHA-256 hash via SubtleCrypto so we never store plaintext passwords in localStorage.
// When migrating to Supabase, replace with supabase.auth.
export async function sha256(input) {
  const data = new TextEncoder().encode(String(input));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
