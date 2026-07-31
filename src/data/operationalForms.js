import { createDefaultS501Checks } from '../constants/s501ChecklistItems';

export const emptyS501 = () => ({
  date: '',
  vehicleMake: '',
  registration: '',
  odometer: '',
  completedBy: '',
  checks: createDefaultS501Checks(),
});

export const S506_RISK_ITEMS = [
  'Unfamiliar with route',
  'Unfamiliar with vehicle',
  'Vehicle service up to date',
  'Person travelling alone',
  'Health issues',
  'Poor weather conditions',
];

export const emptyS506 = () => ({
  date: '',
  vehicleRegistration: '',
  jobNumber: '',
  drivers: '',
  buddyContact: '',
  purpose: '',
  kilometresOneWay: '',
  destination: '',
  travellers: '',
  departureFrom: '',
  expectedDepartureTime: '',
  expectedArrivalTime: '',
  other: '',
  risks: Object.fromEntries(S506_RISK_ITEMS.map((item) => [item, 'Yes'])),
});
