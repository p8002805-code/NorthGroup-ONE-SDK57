const validCoordinate = (value, minimum, maximum) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
};

export const buildKmlPinMapLinks = (pin) => {
  const latitude = validCoordinate(pin?.latitude, -90, 90);
  const longitude = validCoordinate(pin?.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;

  const destination = encodeURIComponent(`${latitude},${longitude}`);
  const label = encodeURIComponent(String(pin?.name || 'KML pin').trim() || 'KML pin');
  return {
    label: String(pin?.name || 'KML pin').trim() || 'KML pin',
    apple: `https://maps.apple.com/?daddr=${destination}&dirflg=d&q=${label}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&dir_action=navigate`,
  };
};
