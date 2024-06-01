export enum MessageTypes {
  Original = "original",
  UserReply = "user-reply",
  AgentReply = "agent-reply",
  InternalNote = "internal-note",
  Unknown = "unknown",
}

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
export type Comment = {
  id?: number;
  issueId: number;
  body: string;
  meta: Meta;
};
