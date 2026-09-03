/** Google Docs/Drive import is not connected in this project. */
export function useGoogleConnection() {
  return { status: { connected: false } as { connected: boolean; email?: string }, loading: false };
}
