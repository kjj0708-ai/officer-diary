export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

export async function fetchCalendarEventsRange(accessToken: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  try {
    const calendarListResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ).catch(err => {
      console.error('Fetch calendarList network error:', err);
      throw new Error('NETWORK_ERROR');
    });

    if (!calendarListResponse.ok) {
      const errorText = await calendarListResponse.text();
      console.error('Calendar List Response Error:', calendarListResponse.status, errorText);
      if (calendarListResponse.status === 401) throw new Error('UNAUTHORIZED');
      throw new Error(`Failed to fetch calendar list: ${calendarListResponse.status}`);
    }

    const calendarListData = await calendarListResponse.json();
    const calendars = calendarListData.items || [];

    const eventPromises = calendars.map(async (cal: any) => {
      try {
        const eventsResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!eventsResponse.ok) return [];
        const eventsData = await eventsResponse.json();
        return eventsData.items || [];
      } catch (e) {
        console.error(`Error fetching events for calendar ${cal.id}:`, e);
        return [];
      }
    });

    const results = await Promise.all(eventPromises);
    const allEvents = results.flat();

    const uniqueEvents = allEvents.filter((event, index, self) =>
      index === self.findIndex((t) => t.id === event.id)
    );

    return uniqueEvents;
  } catch (error: any) {
    if (error?.message !== 'UNAUTHORIZED') {
      console.error('Calendar API Error:', error);
    }
    throw error;
  }
}

export async function fetchCalendarEvents(accessToken: string, date: Date): Promise<CalendarEvent[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return fetchCalendarEventsRange(accessToken, startOfDay, endOfDay);
}
