export type UserRole = 'owner' | 'principal' | 'accountant' | 'teacher' | 'parent' | 'driver' | 'super_admin';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  schoolId?: string;
  schoolName?: string; // New: For dynamic branding
  deviceId?: string;
  status: 'active' | 'blocked' | 'pending';
  createdAt: number;
  password?: string;
}

export interface School {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

export interface BusLocation {
  id: string;
  driverId: string;
  driverName: string;
  schoolId: string;
  lat: number;
  lng: number;
  isOnDuty: boolean;
  timestamp: number;
}

// ... (Other interfaces like Student, Attendance, Fee, etc. are also included here)
