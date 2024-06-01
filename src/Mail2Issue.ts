import MailProvider, { FetchedEmail } from "./MailProvider";
import IssueProvider from "./IssueProvider";
import StateProvider from "./StateProvider";
import { Comment, MessageTypes, Meta } from "./types";

const NUMBER_OF_EMAILS = 10; //Not To Blast GitHub
const DAYS_BACK = 1;
export default class Mail2Issue {
  private readonly mailbox: MailProvider;
  private readonly issueProvider;
  private readonly state;

  constructor(
    mail: MailProvider,
    issueProvider: IssueProvider,
    state: StateProvider,
  ) {
    this.mailbox = mail;
    this.issueProvider = issueProvider;
    this.state = state;
  }

  private getIncomingByUid = async (lastSynced: string) => {
    if (isNaN(parseInt(lastSynced)))
      throw new Error("Invalid lastSynced value");
    return await this.mailbox.fetchEmailsByUID(
      parseInt(lastSynced),
      "*",
      NUMBER_OF_EMAILS,
    );
  };

  private getIncomingByDays = async (daysBack: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return await this.mailbox.fetchEmailsByDate(date, NUMBER_OF_EMAILS);
  };

  private handleNewTicket = async (mail: FetchedEmail) => {
    const title = mail.subject ?? "No Subject";
    const body = mail.VisibleText;
    return await this.issueProvider.createIssue({
      title,
      body,
      meta: {
        from: mail.senders,
        toReceivers: mail.toReivers,
        ccReceivers: mail.ccReivers,
        replyTo: mail.replyTo,
        uid: mail.uid,
        messageId: mail.messageId,
        type: MessageTypes.Original,
      },
    });
  };

  private handleReplay = async (mail: FetchedEmail, regex: RegExp) => {
    const match = mail.subject?.match(regex); //example: [:123] my issue title
    if (!match)
      throw new Error("could not find issue id in subject :" + mail.subject);
    const issueId = parseInt(match[0].slice(2, -1));
    const body = mail.VisibleText as string;
    await this.issueProvider.createIssueComment({
      issueId,
      body,
      meta: {
        from: mail.senders,
        toReceivers: mail.toReivers,
        ccReceivers: mail.ccReivers,
        replyTo: mail.replyTo,
        uid: mail.uid,
        messageId: mail.messageId,
        type: MessageTypes.UserReply,
      },
    });
  };

  private handleIncoming = async (mail: FetchedEmail) => {
    const regex = /\[:\d+\]/;
    const isReplay = regex.test(mail.subject);
    if (isReplay) await this.handleReplay(mail, regex);
    else await this.handleNewTicket(mail);
  };

  /**
   * Synchronizes incoming emails.
   *
   * @returns A promise that resolves to void.
   */
  public syncIncoming = async () => {
    const lastUid = await this.state.lastUidSynced.get();
    const incoming = lastUid
      ? await this.getIncomingByUid(lastUid)
      : await this.getIncomingByDays(DAYS_BACK);

    if (incoming.length === 0) return;

    await this.state.lastSynced.set(new Date().toISOString());
    const sorted = incoming.sort((a, b) => a.uid - b.uid);
    await this.state.lastUidSynced.set(sorted.slice(-1)[0].uid.toString());

    const promise = sorted.map(this.handleIncoming);
    await Promise.all(promise);
  };

  private replyTitle = (title: string, issueId: number) =>
    `Re: [:${issueId}] ${title}`; //example: `Re: [:123] Problem with the app`
  private findCommands = (body: string) => {
    // commands starts with / and ends with space or new line or end of string
    const comments: { key: string; value?: string }[] = [];

    const regexInternal = /\/internal+(?=\s|\n|$)/g;
    if (regexInternal.test(body)) comments.push({ key: "internal" });
    return comments;
  };
  private removeCommands = (body: string) => {
    const regex = /\/\w+/g;
    const newBody = body.replace(regex, "");
    return newBody;
  };

  private flattenToEmails = (meta: Meta) => {
    if (!(meta?.from && meta.ccReceivers && meta.ccReceivers.length > 0))
      throw new Error("Meta or From or toReceivers is missing");
    const contacts = [...(meta.from ?? []), ...(meta.toReceivers ?? [])].map(
      (e) => e.address,
    );
    const replyTo = meta.replyTo?.map((e) => e.address) ?? [];
    contacts.push(...replyTo);
    const uniqueContacts = [...new Set(contacts)];

    return uniqueContacts.filter((e) => e !== this.mailbox.emailAddress); //remove our own email address
  };

  private processInternalComment = async (comment: Comment) => {
    const commentCopy = structuredClone(comment);
    commentCopy.meta.type = MessageTypes.InternalNote;
    await this.issueProvider.createIssueComment(commentCopy);
  };
  /**
   * Handles the comment event.
   *
   * @param comment - The comment object.
   */
  public handleCommentEvent = async (comment: Comment) => {
    const commands = this.findCommands(comment.body);
    if (commands.find((c) => c.key === "internal"))
      await this.processInternalComment(comment);
    else await this.processAgentAnswer(comment);
  };

  private async processAgentAnswer(comment: Comment) {
    {
      const issue = await this.issueProvider.getIssue(comment.issueId);
      const commentCopy = structuredClone(comment);
      commentCopy.meta.type = MessageTypes.AgentReply;
      this.issueProvider.createIssueComment(commentCopy);

      const title = this.replyTitle(issue.title, comment.issueId);
      const bodyForEmail = this.removeCommands(comment.body);
      this.mailbox.sendEmail({
        to: this.flattenToEmails(issue.meta),
        cc: issue.meta?.ccReceivers?.map((e) => e.address) ?? undefined,
        subject: title,
        text: bodyForEmail,
      });
    }
  }
}
