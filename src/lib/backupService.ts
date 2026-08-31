import { db } from './firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { ShiftRequest } from '../types';

export const backupService = {
  /**
   * Checks if a week has passed since the last backup.
   * If so, fetches all data, verifies integrity, triggers a JSON download, and updates the timestamp.
   */
  async checkAndRunComplianceBackup(): Promise<boolean> {
    try {
      const docRef = doc(db, 'system', 'compliance');
      const docSnap = await getDoc(docRef);
      
      let lastCheck = 0;
      if (docSnap.exists()) {
        lastCheck = docSnap.data().lastBackupCheck || 0;
      }

      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();

      // For demonstration, we could trigger if more than a week has passed.
      // But let's also allow a manual trigger mechanism if lastCheck is missing
      if (now - lastCheck >= ONE_WEEK_MS || lastCheck === 0) {
        
        // 1. Fetch all historical shift requests
        const snapshot = await getDocs(collection(db, 'shiftRequests'));
        const allRequests = snapshot.docs.map(d => d.data() as ShiftRequest);
        
        // 2. Simple Integrity verification (Ensure no corrupt records exist)
        const isDataIntact = allRequests.every(req => 
          req.id && req.userId && req.weekId && req.status
        );

        if (!isDataIntact) {
          console.error("Compliance Check Failed: Data integrity issue detected in Firestore.");
          return false;
        }

        // 3. Generate cold-storage backup blob
        const backupData = JSON.stringify({
          exportedAt: new Date().toISOString(),
          recordCount: allRequests.length,
          data: allRequests
        }, null, 2);

        const blob = new Blob([backupData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 4. Trigger download for the Manager
        const a = document.createElement('a');
        a.href = url;
        a.download = `cirpici_compliance_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 5. Update the compliance tracker in Firestore
        await setDoc(docRef, { lastBackupCheck: now }, { merge: true });
        
        return true;
      }

      return false; // Less than a week has passed, no backup needed
    } catch (error) {
      console.error("Backup compliance check failed:", error);
      return false;
    }
  },

  /**
   * Allows the manager to manually trigger a compliance backup regardless of time.
   */
  async forceManualBackup(): Promise<boolean> {
    try {
      const docRef = doc(db, 'system', 'compliance');
      await setDoc(docRef, { lastBackupCheck: 0 }, { merge: true });
      return await this.checkAndRunComplianceBackup();
    } catch (error) {
      console.error("Manual backup failed:", error);
      return false;
    }
  }
};
