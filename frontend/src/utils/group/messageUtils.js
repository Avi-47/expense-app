/**
 * Formats a message timestamp into a human-readable string
 * Returns: "Today HH:mm", "Yesterday HH:mm", or "DD/MM/YYYY HH:mm"
 */
export const formatMessageDate = (timestamp) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  if (msgDate.getTime() === today.getTime()) {
    return `Today ${time}`;
  } else if (msgDate.getTime() === yesterday.getTime()) {
    return `Yesterday ${time}`;
  } else {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year} ${time}`;
  }
};

/**
 * Gets a date key for grouping messages
 * Returns: "today", "yesterday", or "YYYY-MM-DD"
 */
export const getDateKey = (timestamp) => {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (msgDate.getTime() === today.getTime()) return 'today';
  if (msgDate.getTime() === yesterday.getTime()) return 'yesterday';
  return date.toISOString().split('T')[0];
};
