import * as SecureStore from 'expo-secure-store';
export async function clearStoredToken() {
  await Promise.all(['fitty.google_token', 'fitty.google_id_token'].map(key => SecureStore.deleteItemAsync(key)));
}
