import { isTextJobFile } from './jobFilePreview';

export const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** index);
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
};

export const formatModified = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const FILE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'folders', label: 'Folders' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'image', label: 'Images' },
  { key: 'documents', label: 'Documents' },
];

export const getFileKind = (item) => {
  if (item?.folder) return 'folder';
  const name = String(item?.name || '').toLowerCase();
  const mime = String(item?.file?.mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(name)) return 'office';
  if (/\.dxf$/i.test(name)) return 'dxf';
  if (/\.dwg$/i.test(name)) return 'dwg';
  if (isTextJobFile(item)) return 'text';
  return 'external';
};

export const getFileIcon = (item) => {
  const kind = getFileKind(item);
  if (kind === 'pdf') return 'document-text-outline';
  if (kind === 'image') return 'image-outline';
  if (kind === 'office') return 'reader-outline';
  if (kind === 'dxf' || kind === 'dwg') return 'construct-outline';
  if (kind === 'text') return 'document-text-outline';
  return 'document-outline';
};

export const sortDisplayItems = (items = [], sortMode = 'name') => [...items].sort((a, b) => {
  if (Boolean(a.folder) !== Boolean(b.folder)) return a.folder ? -1 : 1;
  if (sortMode === 'recent') {
    const dateDifference = new Date(b.lastModifiedDateTime || 0) - new Date(a.lastModifiedDateTime || 0);
    if (dateDifference) return dateDifference;
  }
  return String(a.name || '').localeCompare(String(b.name || ''), 'en-AU', { numeric: true });
});
