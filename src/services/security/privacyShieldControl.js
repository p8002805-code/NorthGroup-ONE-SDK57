let suspensionCount = 0;
const listeners = new Set();

const notify = () => {
  const suspended = suspensionCount > 0;
  listeners.forEach((listener) => listener(suspended));
};

export const isPrivacyShieldSuspended = () => suspensionCount > 0;

export const subscribeToPrivacyShieldSuspension = (listener) => {
  listeners.add(listener);
  listener(isPrivacyShieldSuspended());
  return () => listeners.delete(listener);
};

export const suspendPrivacyShield = () => {
  suspensionCount += 1;
  notify();
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    suspensionCount = Math.max(0, suspensionCount - 1);
    notify();
  };
};
