import { auth } from '../firebase';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const BASE_URL = `${API_BASE_URL}/api/v1`;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = await auth.currentUser?.getIdToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    let message = `API error ${response.status}: ${text}`;
    try {
      const json = JSON.parse(text);
      if (typeof json.detail === 'string') message = json.detail;
    } catch {
      // keep raw message
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
