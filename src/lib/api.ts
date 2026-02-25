const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

export const fetchWithAuth = async (url: string, options: FetchOptions = {}) => {
  const token = localStorage.getItem('token');
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };

  if (token) {
    // @ts-ignore
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is FormData, don't set Content-Type (browser sets it with boundary)
  if (options.body instanceof FormData) {
    // @ts-ignore
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Handle unauthorized - maybe redirect to login
    // For now just throw
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || 'API request failed');
  }

  return response.json();
};
