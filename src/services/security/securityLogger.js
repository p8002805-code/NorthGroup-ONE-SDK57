const cleanContext = (value) => String(value || 'Unexpected application error')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 160);

const nonSensitiveMetadata = (error) => {
  const metadata = {};
  if (String(error?.name || '').trim()) metadata.name = String(error.name).slice(0, 60);
  if (String(error?.code || '').trim()) metadata.code = String(error.code).slice(0, 80);
  if (Number.isFinite(Number(error?.status))) metadata.status = Number(error.status);
  return metadata;
};

export const reportDevelopmentError = (context, error) => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.warn(`[NorthGroup] ${cleanContext(context)}`, nonSensitiveMetadata(error));
};
