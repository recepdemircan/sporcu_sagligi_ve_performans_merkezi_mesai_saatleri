export const backupService = {
  async checkAndRunComplianceBackup(): Promise<boolean> {
    // Legacy support, manual only for now
    return false;
  },

  async forceManualBackup(): Promise<boolean> {
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Failed to fetch backup data");
      
      const data = await res.json();
      const backupData = JSON.stringify(data, null, 2);
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `cirpici_compliance_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error("Manual backup failed:", error);
      return false;
    }
  }
};
