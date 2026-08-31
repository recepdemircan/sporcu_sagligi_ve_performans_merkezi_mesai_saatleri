export type UserRole = 'manager' | 'old_team' | 'new_team';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type ShiftType = '08:00-17:00' | '11:00-20:00' | '08:00-20:00' | 'off';

export interface DailyShift {
  date: string; // YYYY-MM-DD format
  shiftType: ShiftType;
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

