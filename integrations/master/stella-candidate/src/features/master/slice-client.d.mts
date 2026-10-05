export interface Fence { sessionId: string; revision: number; screen: string }
export interface PhotoUpload { captureId: string; expectedRevision: number; appearance: 'male'|'female'; consent: { accepted: true; version: 'poster-v1' }; imageBase64: string }
export interface Option { id: string; label: string; metadata?: string[]; command?: { kind: string; questionId?: string; answerId?: string } }
export interface MasterState extends Fence { protocol: string; phase: string; questionIndex?: number; answers?: { questionId: string; answerId: string; label: string; metadata: string[] }[];
  photo?: { choice: string | null; status: string; referenceAssetId: string | null };
  contentPlan?: { status: string; packageId: string | null; resultPath: string | null } | null }
export interface Snapshot {
  health?: { instanceKey: string };
  online: boolean; fresh: boolean; busy: boolean; pending: unknown; error: string | null; notice: string; storageError: string | null;
  canStart: boolean; canAct: boolean; canPause: boolean; canResume: boolean; canCancel: boolean; canRetry: boolean;
  station: { sessionId: string | null } | null;
  session: { state: MasterState | null; view?: { screen: string; title: string; description?: string; notice?: string; presentationCopy?: Record<string,string>; discoveryVisual?: 'activation'|'generation'; discoveryDurationMs?: number; questionId?: string; options: Option[]; actions?: { id: string; label: string; command: { kind: string } }[] } } | null;
}
export interface SliceClient {
  getSnapshot(): Snapshot; refresh(): Promise<Snapshot>; start(): Promise<Snapshot>;
  answer(fence: Fence, questionId: string, answerId: string): Promise<Snapshot>;
  choosePhoto(fence: Fence, answerId: string): Promise<Snapshot>;
  uploadPhoto(fence: Fence, payload: PhotoUpload): Promise<Snapshot>;
  complete(fence: Fence): Promise<Snapshot>; control(kind: string): Promise<Snapshot>; retry(): Promise<Snapshot>; dispose(): void;
}
export const SLICE_STORAGE_PREFIX: string;
export function createSliceClient(options: { fetch: typeof fetch; storage: Pick<Storage, 'getItem' | 'setItem'>; uuid: () => string; onChange?: (state: Snapshot) => void; apiBase?: string }): SliceClient;
