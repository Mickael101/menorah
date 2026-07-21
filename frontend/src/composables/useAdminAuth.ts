const STORAGE_KEY = 'menorah_admin_token';

export function getAdminToken(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setAdminToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token.trim());
}

export function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { 'x-admin-token': token } : {};
}

// fetch wrapper for admin-only endpoints: injects the token and, on 401,
// prompts once for the admin code then retries.
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const withToken = (): RequestInit => ({
    ...options,
    headers: { ...(options.headers as Record<string, string> | undefined), ...adminHeaders() }
  });

  let response = await fetch(url, withToken());

  if (response.status === 401) {
    const entered = window.prompt('Code admin requis / Admin code required:');
    if (entered && entered.trim()) {
      setAdminToken(entered);
      response = await fetch(url, withToken());
    }
  }

  return response;
}
