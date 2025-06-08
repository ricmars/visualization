export function fetchWithBaseUrl(input: string, init?: RequestInit) {
  const baseUrl = process.env.API_BASE_URL;
  let url = input;
  if (baseUrl && input.startsWith("/")) {
    url = baseUrl.replace(/\/$/, "") + input;
  }
  return fetch(url, init);
}
