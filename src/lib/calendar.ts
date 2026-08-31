import { ShiftRequest } from '../types';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

// Global declaration for the Google Accounts API
declare global {
  interface Window {
    google: any;
  }
}

/**
 * Authenticates with Google Identity Services and returns an access token.
 */
export const authenticateGoogleCalendar = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      if (!window.google?.accounts?.oauth2) {
        return reject(new Error('Google Identity Services script not loaded.'));
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        return reject(new Error('Google Client ID is missing. Check your environment variables.'));
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error !== undefined) {
            reject(response);
          }
          resolve(response.access_token);
        },
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Pushes a batch of approved shifts to the user's primary calendar.
 */
export const syncShiftsToCalendar = async (
  token: string, 
  approvedRequests: ShiftRequest[],
  onProgress?: (current: number, total: number) => void
) => {
  // 1. Gather all events to be created
  const eventsToCreate: any[] = [];
  
  for (const req of approvedRequests) {
    for (const shift of req.shifts) {
      if (shift.shiftType === 'off') continue;
      
      let startTime = '';
      let endTime = '';

      if (shift.shiftType === '08:00-17:00') {
        startTime = '08:00:00';
        endTime = '17:00:00';
      } else if (shift.shiftType === '11:00-20:00') {
        startTime = '11:00:00';
        endTime = '20:00:00';
      } else if (shift.shiftType === '08:00-20:00') {
        startTime = '08:00:00';
        endTime = '20:00:00';
      }

      if (startTime && endTime) {
        eventsToCreate.push({
          summary: `[Vardiya] ${req.userName}`,
          description: `${req.userName} adlı personelin onaylı mesaisi.`,
          start: {
            dateTime: `${shift.date}T${startTime}`,
            timeZone: 'Europe/Istanbul',
          },
          end: {
            dateTime: `${shift.date}T${endTime}`,
            timeZone: 'Europe/Istanbul',
          },
          colorId: shift.shiftType === '11:00-20:00' ? '9' : (shift.shiftType === '08:00-20:00' ? '5' : '10'), // Different colors for shift types
        });
      }
    }
  }

  // 2. Insert events sequentially to avoid rate limiting
  let completed = 0;
  for (const event of eventsToCreate) {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      console.error('Failed to create event:', event.summary, await response.text());
      // Continue with the others even if one fails
    }
    
    completed++;
    if (onProgress) {
      onProgress(completed, eventsToCreate.length);
    }
  }
  
  return completed;
};
