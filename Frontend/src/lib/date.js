const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatReadableDateTime = (value, options = {}) => {
  const {
    fallback = "-",
    includeTime = true,
  } = options;
  const date = toDate(value);
  if (!date) return fallback;

  if (!includeTime) {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatReadableDate = (value, fallback = "-") =>
  formatReadableDateTime(value, { fallback, includeTime: false });

export const formatTimeAgo = (value, fallback = "Just now") => {
  const date = toDate(value);
  if (!date) return fallback;

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return formatReadableDate(value, fallback);
};
