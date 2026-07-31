import { S506_RISK_ITEMS } from '../data/operationalForms';

const hasText = (value) => String(value || '').trim().length > 0;

export const isS501Complete = (form) => Boolean(
  form
  && hasText(form.date)
  && hasText(form.vehicleMake)
  && hasText(form.registration)
  && hasText(form.odometer)
  && hasText(form.completedBy)
  && Array.isArray(form.checks)
  && form.checks.length > 0
  && form.checks.every((item) => ['OK', 'Damaged', 'Missing'].includes(item.status))
);

export const isS506Complete = (form) => Boolean(
  form
  && [
    form.date,
    form.vehicleRegistration,
    form.jobNumber,
    form.drivers,
    form.buddyContact,
    form.purpose,
    form.kilometresOneWay,
    form.destination,
    form.travellers,
    form.departureFrom,
    form.expectedDepartureTime,
    form.expectedArrivalTime,
  ].every(hasText)
  && S506_RISK_ITEMS.every((item) => ['Yes', 'No', 'N/A'].includes(form.risks?.[item]))
);
