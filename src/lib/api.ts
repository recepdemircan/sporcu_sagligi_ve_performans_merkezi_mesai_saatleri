import { ShiftRequest, SwapRequest } from '../types';

export const api = {
  async saveShiftRequest(request: ShiftRequest): Promise<void> {
    const res = await fetch("/api/shift-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error("Failed to save shift request");
  },

  async getShiftRequests(weekId: string): Promise<ShiftRequest[]> {
    const res = await fetch(`/api/shift-requests?weekId=${encodeURIComponent(weekId)}`);
    if (!res.ok) throw new Error("Failed to get shift requests");
    return res.json();
  },
  
  async updateShiftRequestStatus(id: string, status: 'approved' | 'rejected', weekId: string): Promise<void> {
    const res = await fetch(`/api/shift-requests/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error("Failed to update shift request status");
  },

  async clearWeekRequests(weekId: string): Promise<void> {
    const res = await fetch(`/api/shift-requests/week/${encodeURIComponent(weekId)}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to clear week requests");
  },

  async createSwapRequest(swap: SwapRequest): Promise<void> {
    const res = await fetch("/api/swap-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swap)
    });
    if (!res.ok) throw new Error("Failed to create swap request");
  },

  async getSwapRequests(userId: string, weekId: string): Promise<SwapRequest[]> {
    const res = await fetch(`/api/swap-requests?weekId=${encodeURIComponent(weekId)}`);
    if (!res.ok) throw new Error("Failed to get swap requests");
    const reqs: SwapRequest[] = await res.json();
    return reqs.filter(r => r.senderUserId === userId || r.receiverUserId === userId);
  },

  async respondToSwap(swap: SwapRequest, response: 'accepted' | 'rejected'): Promise<void> {
    if (response === 'rejected') {
      const res = await fetch(`/api/swap-requests/${swap.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (!res.ok) throw new Error("Failed to reject swap");
      return;
    }

    // If accepted, we must swap the shifts
    const sReqs = await this.getShiftRequests(swap.weekId);
    const senderReq = sReqs.find(r => r.userId === swap.senderUserId);
    const receiverReq = sReqs.find(r => r.userId === swap.receiverUserId);

    if (!senderReq || !receiverReq) throw new Error('İlgili haftaya ait onaylanmış talep bulunamadı.');

    const senderShiftIdx = senderReq.shifts.findIndex(s => s.date === swap.date);
    const receiverShiftIdx = receiverReq.shifts.findIndex(s => s.date === swap.date);

    const senderShiftType = senderShiftIdx >= 0 ? senderReq.shifts[senderShiftIdx].shiftType : 'off';
    const receiverShiftType = receiverShiftIdx >= 0 ? receiverReq.shifts[receiverShiftIdx].shiftType : 'off';

    if (senderShiftIdx >= 0) senderReq.shifts[senderShiftIdx].shiftType = receiverShiftType;
    else senderReq.shifts.push({ date: swap.date, shiftType: receiverShiftType });

    if (receiverShiftIdx >= 0) receiverReq.shifts[receiverShiftIdx].shiftType = senderShiftType;
    else receiverReq.shifts.push({ date: swap.date, shiftType: senderShiftType });

    await this.saveShiftRequest(senderReq);
    await this.saveShiftRequest(receiverReq);
    
    const res = await fetch(`/api/swap-requests/${swap.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: 'accepted' })
    });
    if (!res.ok) throw new Error("Failed to accept swap");
  },

  async getLogo(): Promise<string | null> {
    return null;
  },

  async saveLogo(base64: string): Promise<void> {
    // Legacy support, now we don't save logo dynamically
  }
};

