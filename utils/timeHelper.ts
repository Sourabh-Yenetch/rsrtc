
export const formatTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':');
  const date = new Date();
  date.setHours(parseInt(hours, 10));
  date.setMinutes(parseInt(minutes, 10));
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const getDepartureDate = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const departureDate = new Date();
    departureDate.setHours(hours, minutes, 0, 0);

    // If the departure time on the current day has already passed, set it for the next day.
    if (departureDate < now) {
        departureDate.setDate(departureDate.getDate() + 1);
    }
    return departureDate;
}
