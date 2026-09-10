export async function clearStoredToken() {
  if (typeof localStorage !== 'undefined') { localStorage.removeItem('fitty.google_token'); localStorage.removeItem('fitty.google_id_token'); }
}
