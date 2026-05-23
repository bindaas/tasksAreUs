const BASE_URL = '/api/v1';

export interface User {
  id: string;
  device_uuid: string;
  created_at: string;
}

export async function registerUser(deviceUuid: string): Promise<User> {
  const response = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_uuid: deviceUuid }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to register user: ${text}`);
  }

  return response.json();
}
