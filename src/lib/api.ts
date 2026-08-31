import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { ShiftRequest, SwapRequest } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const api = {
  async saveShiftRequest(request: ShiftRequest): Promise<void> {
    const path = 'shiftRequests';
    try {
      const requestRef = doc(collection(db, path), request.id);
      await setDoc(requestRef, request);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getShiftRequestsByWeek(weekId: string): Promise<ShiftRequest[]> {
    const path = 'shiftRequests';
    try {
      const q = query(
        collection(db, path),
        where('weekId', '==', weekId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as ShiftRequest);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },
  
  async updateShiftRequestStatus(id: string, status: 'approved' | 'rejected', weekId: string): Promise<void> {
    const path = 'shiftRequests';
    try {
      const requestRef = doc(db, path, id);
      await updateDoc(requestRef, { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  async createSwapRequest(swap: SwapRequest): Promise<void> {
    const path = 'swapRequests';
    try {
      const ref = doc(collection(db, path), swap.id);
      await setDoc(ref, swap);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getSwapRequests(userId: string, weekId: string): Promise<SwapRequest[]> {
    const path = 'swapRequests';
    try {
      const qSender = query(collection(db, path), where('senderUserId', '==', userId), where('weekId', '==', weekId));
      const qReceiver = query(collection(db, path), where('receiverUserId', '==', userId), where('weekId', '==', weekId));
      
      const [sSnap, rSnap] = await Promise.all([getDocs(qSender), getDocs(qReceiver)]);
      
      const reqs: SwapRequest[] = [];
      sSnap.forEach(d => reqs.push(d.data() as SwapRequest));
      rSnap.forEach(d => {
        const data = d.data() as SwapRequest;
        if (!reqs.find(r => r.id === data.id)) reqs.push(data);
      });
      return reqs;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async respondToSwap(swap: SwapRequest, response: 'accepted' | 'rejected'): Promise<void> {
    const path = 'swapRequests';
    try {
      const swapRef = doc(db, path, swap.id);
      if (response === 'rejected') {
        await updateDoc(swapRef, { status: 'rejected' });
        return;
      }

      // If accepted, we must swap the shifts
      const sReqs = await this.getShiftRequestsByWeek(swap.weekId);
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
      
      await updateDoc(swapRef, { status: 'accepted' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${swap.id}`);
    }
  },

  async getLogo(): Promise<string | null> {
    try {
      const q = query(collection(db, 'settings'), where('id', '==', 'logo'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data().base64 || null;
      }
      return null;
    } catch (error) {
      console.error('Logo alınamadı', error);
      return null;
    }
  },

  async saveLogo(base64: string): Promise<void> {
    try {
      const logoRef = doc(db, 'settings', 'logo');
      await setDoc(logoRef, { id: 'logo', base64 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/logo');
    }
  }
};

