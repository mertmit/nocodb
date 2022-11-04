export interface AirtableSyncConfig {
  id: string;
  baseURL: string;
  authToken: string;
  projectName?: string;
  projectId?: string;
  apiKey: string;
  shareId: string;
  options: {
    syncViews: boolean;
    syncData: boolean;
    syncRollup: boolean;
    syncLookup: boolean;
    syncFormula: boolean;
    syncAttachment: boolean;
  };
}
