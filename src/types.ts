type MessageTypes = "original" | "reply";
interface mailContact {
  address: string;
  name?: string;
}
export interface meta {
  uid: number;
  type: MessageTypes;
  messageId?: string;
  from: mailContact[];
  toReceivers: mailContact[];
  ccReceivers?: mailContact[];
  replyTo?: mailContact[];
}
export interface createIssue {
  title: string;
  body: string;
  meta: meta;
}
interface Issue extends createIssue {
  id: number;
}
export interface Comment {
  id: number;
  issueId: number;
  body: string;
}
