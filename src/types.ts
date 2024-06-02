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
export type Meta = {
  from: MailContact[];
  type: MessageTypes;
  uid?: number;
  messageId?: string;
  toReceivers?: MailContact[];
  ccReceivers?: MailContact[];
  replyTo?: MailContact[];
};
export type CreateIssue = {
  title: string;
  body: string;
  meta: Meta;
};
export type Issue = CreateIssue & {
  id: number;
  createdAt: Date;
};
export type Comment = {
  id?: number;
  issueId: number;
  body: string;
  meta: Meta;
  createdAt: Date;
};
