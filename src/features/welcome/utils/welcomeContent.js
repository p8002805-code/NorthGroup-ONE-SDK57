export const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const formatWelcomeDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

export const DEFAULT_WELCOME_DATA = {
  firstName: 'Patrick',
  currentJob: {
    number: '205672',
    name: 'Bruce Highway Upgrade',
  },
  weather: {
    temperature: '18°',
    condition: 'Chance of showers after 3pm',
    wind: '12 km/h',
    icon: '☂',
    code: 61,
    isWet: true,
  },
};
