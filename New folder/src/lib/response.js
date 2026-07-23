export function success(data, status = 200) {
  return { status, data };
}

export function error(message, status = 400, details = null) {
  return { status, error: { message, status: status.toString(), ...(details ? { details } : {}) } };
}