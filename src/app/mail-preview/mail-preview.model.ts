import { Timestamp } from "@angular/fire/firestore";

export interface InvitationMailPreviewBody {
    bodyText: string;
    inviteLink?: string | null;
  }

  export interface InvitationMailRecord {
    id: string;
    from: string;
    to: string[];
    subject: string;
    replyTo?: string;
    bodyText?: string;
    inviteLink?: string;
    opened?: boolean;
    tid?: string;
    createdAt: Timestamp;
  }