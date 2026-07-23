const MEMORY_WARNING_THRESHOLD = 150 * 1024 * 1024;
const MEMORY_CRITICAL_THRESHOLD = 200 * 1024 * 1024;

export function checkMemoryPressure() {
  const usage = process.memoryUsage ? process.memoryUsage() : null;
  if (!usage) {
    return { level: 'unknown', rss: 0, heapUsed: 0, heapTotal: 0 };
  }

  const rss = usage.rss || 0;
  const heapUsed = usage.heapUsed || 0;
  const heapTotal = usage.heapTotal || 0;

  if (rss >= MEMORY_CRITICAL_THRESHOLD || heapUsed >= MEMORY_CRITICAL_THRESHOLD) {
    return { level: 'critical', rss, heapUsed, heapTotal };
  }

  if (rss >= MEMORY_WARNING_THRESHOLD || heapUsed >= MEMORY_WARNING_THRESHOLD) {
    return { level: 'warning', rss, heapUsed, heapTotal };
  }

  return { level: 'normal', rss, heapUsed, heapTotal };
}

export function getMemoryInfo() {
  const usage = process.memoryUsage ? process.memoryUsage() : null;
  if (!usage) {
    return null;
  }

  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers
  };
}

export { MEMORY_WARNING_THRESHOLD, MEMORY_CRITICAL_THRESHOLD };