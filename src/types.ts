export type UserRole = 'manager' | 'senior' | 'fixed' | 'athletic' | 'health';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  title?: string;
}

export type ShiftType = '08:00-17:00' | '11:00-20:00' | '08:00-20:00' | 'off';

export interface DailyShift {
  date: string; // YYYY-MM-DD format
  shiftType: ShiftType;
  isExtraOvertime?: boolean; // True if '08:00-20:00'
}

export interface ShiftRequest {
  id: string;
  weekId: string; // e.g. "2026-W35"
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  shifts: DailyShift[];
  submittedAt: number;
}

export interface SwapRequest {
  id: string;
  weekId: string;
  date: string;
  senderUserId: string;
  receiverUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

