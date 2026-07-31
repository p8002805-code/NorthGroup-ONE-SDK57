export const S501_CHECKLIST_ITEMS = [
  'All lights, hazard lights, flashing lights and indicators operate correctly',
  'Reverse alarm operates correctly, if applicable',
  'Tyres, spare tyre, inflation and wheel nuts are in serviceable condition',
  'Front wheel hub operates correctly and is not locked in 2WD, if applicable',
  'Vehicle jack and wheel brace are in place',
  'Engine oil level is correct and no oil leaks are evident',
  'Radiator coolant, drive belts and tension are serviceable when checked cold',
  'Battery, electrolyte, clamps and security are serviceable',
  'Windscreen washer water is topped up',
  'Fuel level is adequate for the journey',
  'All brakes, including the hand brake, operate and show no fluid loss',
  'Horn operates correctly',
  'Seat belts, latches, recoil and window winders operate correctly',
  'Windows and mirrors are clean and not cracked',
  'Windscreen wipers operate correctly',
  'Fire extinguisher is secure and inspection is current, if applicable',
  'Mine site flag is fitted and secure before site entry, if applicable',
  'Mine site flashing beacon operates correctly, if applicable',
  'Driver compartment is free of rubbish and loose equipment',
  'First aid kit is in place',
  'Vehicle body has been checked and existing damage recorded',
];

export const createDefaultS501Checks = () =>
  S501_CHECKLIST_ITEMS.map((label, index) => ({
    id: `check-${index + 1}`,
    label,
    status: 'OK',
    remarks: '',
  }));
