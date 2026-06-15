import type { Timestamp } from "firebase/firestore";

export interface LogDocument {
  id: string;
  displayName: string;
  body: string;
  at: Timestamp;
}