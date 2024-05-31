type MessageTypes = "original" | "user-reply" | "agent-reply" | "internal-note";
interface MailContact {
  address: string;
  name?: string;
}
export interface Meta {
  from: MailContact[];
  type: MessageTypes;
  uid?: number;
  messageId?: string;
  toReceivers?: MailContact[];
  ccReceivers?: MailContact[];
  replyTo?: MailContact[];
}
export interface CreateIssue {
  title: string;
  body: string;
  meta: Meta;
}
interface Issue extends CreateIssue {
  id: number;
}
export interface Comment {
  id: number;
  issueId: number;
  body: string;
  from: MailContact[];
}
