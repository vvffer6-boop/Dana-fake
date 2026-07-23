const registrations = new Map();
const MAX_REGISTRATIONS = 500;

export function registerAccount(data) {
  if (registrations.size >= MAX_REGISTRATIONS) {
    const oldestKey = registrations.keys().next().value;
    if (oldestKey) {
      registrations.delete(oldestKey);
    }
  }

  const id = data.email || data.phone || `REG-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const entry = {
    id,
    businessName: data.businessName || null,
    email: data.email || null,
    phone: data.phone || null,
    businessType: data.businessType || null,
    address: data.address || null,
    city: data.city || null,
    province: data.province || null,
    postalCode: data.postalCode || null,
    status: data.status || 'PENDING',
    metadata: data.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  registrations.set(id, entry);
  return entry;
}

export function getRegistration(idOrEmail) {
  if (!idOrEmail) return null;
  return registrations.get(idOrEmail) || null;
}

export function getAllRegistrations(filters = {}) {
  let results = Array.from(registrations.values());

  if (filters.status) {
    results = results.filter(r => r.status === filters.status);
  }
  if (filters.email) {
    results = results.filter(r => r.email === filters.email);
  }
  if (filters.businessType) {
    results = results.filter(r => r.businessType === filters.businessType);
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return results;
}

export function updateRegistrationStatus(id, status, metadata = {}) {
  const existing = registrations.get(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    status,
    metadata: { ...existing.metadata, ...metadata },
    updatedAt: new Date().toISOString()
  };

  registrations.set(id, updated);
  return updated;
}

export function validateRegistration(data) {
  const errors = [];

  if (!data.businessName || typeof data.businessName !== 'string' || data.businessName.trim().length < 2) {
    errors.push('businessName must be a string with at least 2 characters');
  }

  if (!data.email || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('valid email is required');
  }

  if (!data.phone || typeof data.phone !== 'string') {
    errors.push('phone is required');
  }

  if (!data.businessType || typeof data.businessType !== 'string') {
    errors.push('businessType is required');
  }

  const validBusinessTypes = ['INDIVIDUAL', 'CORPORATION', 'FOUNDATION', 'COOPERATIVE', 'GOVERNMENT', 'OTHER'];
  if (data.businessType && !validBusinessTypes.includes(data.businessType.toUpperCase())) {
    errors.push(`businessType must be one of: ${validBusinessTypes.join(', ')}`);
  }

  if (data.address && typeof data.address === 'string' && data.address.trim().length < 5) {
    errors.push('address must be at least 5 characters if provided');
  }

  if (data.postalCode && typeof data.postalCode === 'string' && !/^\d{5}$/.test(data.postalCode)) {
    errors.push('postalCode must be exactly 5 digits if provided');
  }

  return {
    valid: errors.length === 0,
    errors,
    cleaned: {
      businessName: data.businessName ? String(data.businessName).trim() : null,
      email: data.email ? String(data.email).trim().toLowerCase() : null,
      phone: data.phone ? String(data.phone).trim() : null,
      businessType: data.businessType ? String(data.businessType).trim().toUpperCase() : null,
      address: data.address ? String(data.address).trim() : null,
      city: data.city ? String(data.city).trim() : null,
      province: data.province ? String(data.province).trim() : null,
      postalCode: data.postalCode ? String(data.postalCode).trim() : null
    }
  };
}

export default {
  registerAccount,
  getRegistration,
  getAllRegistrations,
  updateRegistrationStatus,
  validateRegistration
};