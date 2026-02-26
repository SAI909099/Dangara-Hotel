export const PAGE_PERMISSION_OPTIONS = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'rooms', label: 'Rooms', path: '/rooms' },
  { key: 'guests', label: 'Guests', path: '/guests' },
  { key: 'bookings', label: 'Booking', path: '/bookings' },
  { key: 'calendar', label: 'Calendar', path: '/calendar' },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'users', label: 'Users', path: '/users' },
];

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: PAGE_PERMISSION_OPTIONS.map((p) => p.key),
  receptionist: ['dashboard', 'rooms', 'guests', 'bookings', 'calendar'],
  accountant: ['dashboard', 'reports'],
};

export const normalizePermissions = (permissions, role) => {
  const allowed = new Set(PAGE_PERMISSION_OPTIONS.map((p) => p.key));
  const base = Array.isArray(permissions) && permissions.length
    ? permissions
    : (ROLE_DEFAULT_PERMISSIONS[role] || ['dashboard']);

  const unique = [];
  const seen = new Set();
  base.forEach((p) => {
    const key = String(p || '').trim().toLowerCase();
    if (!allowed.has(key) || seen.has(key)) return;
    seen.add(key);
    unique.push(key);
  });

  if (!seen.has('dashboard')) unique.unshift('dashboard');
  return unique;
};

export const userHasPermission = (user, permissionKey) => {
  if (!user || !permissionKey) return false;
  if (user.role === 'admin') return true;
  const perms = normalizePermissions(user.permissions, user.role);
  return perms.includes(permissionKey);
};

export const firstAllowedPath = (user) => {
  const perms = normalizePermissions(user?.permissions, user?.role);
  const first = PAGE_PERMISSION_OPTIONS.find((p) => perms.includes(p.key));
  return first?.path || '/';
};
