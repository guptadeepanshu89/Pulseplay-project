const MOCK_NETWORK_DELAY_MS = 400;

export function simulateNetworkDelay(ms: number = MOCK_NETWORK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
