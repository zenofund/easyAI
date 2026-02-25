let isOnline = navigator.onLine;
let sessionCheckInterval: NodeJS.Timeout | null = null;
let lastSuccessfulAuth: number = Date.now();

export interface SessionStatus {
  isValid: boolean;
  needsRefresh: boolean;
  error?: string;
}

export async function validateSession(): Promise<SessionStatus> {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return { isValid: false, needsRefresh: false };
    }

    // Basic JWT decoding to check expiration
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < now) {
        console.warn('Session expired');
        return { isValid: false, needsRefresh: true, error: 'Session expired' };
      }
      
      if (payload.exp && payload.exp - now < 300) {
        console.warn('Session expiring soon');
        return { isValid: true, needsRefresh: true };
      }

      lastSuccessfulAuth = Date.now();
      return { isValid: true, needsRefresh: false };
    } catch (e) {
      console.error('Error decoding token:', e);
      return { isValid: false, needsRefresh: true, error: 'Invalid token' };
    }
  } catch (error) {
    console.error('Session validation exception:', error);
    return {
      isValid: false,
      needsRefresh: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function refreshSession(): Promise<boolean> {
  // Since we use simple JWTs, "refresh" usually means logging in again 
  // or hitting a refresh endpoint if we implemented refresh tokens.
  // For now, we'll just return false to force re-login if expired.
  // Or if we had a refresh token flow, we'd implement it here.
  console.log('Session refresh not implemented for simple JWT auth yet');
  return false;
}

export async function recoverSession(): Promise<boolean> {
  console.log('Attempting session recovery...');

  if (!isOnline) {
    console.log('Offline - skipping session recovery');
    return false;
  }

  const status = await validateSession();

  if (!status.isValid) {
    console.log('Session invalid');
    return false;
  }

  return true;
}

export function startSessionMonitoring(onSessionLost?: () => void): void {
  if (sessionCheckInterval) {
    return;
  }

  console.log('Starting session monitoring...');

  sessionCheckInterval = setInterval(async () => {
    const status = await validateSession();
    
    if (!status.isValid && status.error === 'Session expired') {
      console.warn('Session lost during monitoring');
      if (onSessionLost) {
        onSessionLost();
      }
    }
  }, 60000); // Check every minute
}

export function stopSessionMonitoring(): void {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
    console.log('Stopped session monitoring');
  }
}

// Network status listeners
window.addEventListener('online', () => {
  console.log('Network status: Online');
  isOnline = true;
  recoverSession();
});

window.addEventListener('offline', () => {
  console.log('Network status: Offline');
  isOnline = false;
});

export function getNetworkStatus(): boolean {
  return isOnline;
}
