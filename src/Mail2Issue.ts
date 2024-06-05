import MailProvider, { FetchedEmail } from "./MailProvider";
import IssueProvider from "./IssueProvider";
import StateProvider from "./StateProvider";
import { Comment, Issue, MessageTypes, Meta } from "./types";

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
      createdAt: new Date(),
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
    const contacts = [...(meta?.from ?? []), ...(meta?.toReceivers ?? [])].map(
      (e) => e.address,
    );

    const replyTo = meta?.replyTo?.map((e) => e.address) ?? [];
    const uniqueContacts = [...new Set([...contacts, ...replyTo])];

    const toSendEmails = uniqueContacts.filter(
      (e) => e !== this.mailbox.emailAddress,
    ); //remove our own email address

    if (toSendEmails.length < 1)
      throw new Error("No email address found to send email");

    return toSendEmails;
  };

  private processInternalComment = async (comment: Comment) => {
    const commentCopy = structuredClone(comment);
    commentCopy.meta.type = MessageTypes.InternalNote;
    await this.issueProvider.createIssueComment(commentCopy);
  };

  private async processAgentAnswer(comment: Comment) {
    const issue = await this.issueProvider.getIssue(comment.issueId);

    const title = this.replyTitle(issue.title, comment.issueId);

    const mailBody = await this.renderEmailBody(comment, issue);

    this.mailbox.sendEmail({
      to: this.flattenToEmails(issue.meta),
      cc: issue.meta?.ccReceivers?.map((e) => e.address) ?? undefined,
      subject: title,
      text: mailBody,
    });
  }

  private async renderEmailBody(comment: Comment, issue: Issue) {
    const commentCopy = structuredClone(comment);
    commentCopy.meta.type = MessageTypes.AgentReply;
    this.issueProvider.createIssueComment(commentCopy);

    const olderComments = await this.issueProvider.getIssueComments(
      comment.issueId,
    );

    const userFacingComments = olderComments.filter(
      (c) => c.meta.type !== MessageTypes.InternalNote,
    );

    userFacingComments.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const commentsHistory = userFacingComments
      .map((e) => {
        const user = e.meta.from[0].name ?? e.meta.from[0].address;
        const date = e.createdAt;
        return `\n---\nFrom: ${user}\nDate:${date}\n${e.body}\n`;
      })
      .join("\n");

    const issueUser = issue.meta.from[0].name ?? issue.meta.from[0].address;
    const OriginalIssue = `\n---\nOriginal Issues:\nFrom: ${issueUser}\nDate: ${issue.createdAt}\nSubject: ${issue.title}\n\n${issue.body}\n`;

    const bodyForEmail = this.removeCommands(comment.body);
    const mailBody = bodyForEmail + commentsHistory + OriginalIssue;
    return mailBody;
  }

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
    incoming.sort((a, b) => a.uid - b.uid);
    await this.state.lastUidSynced.set(incoming.slice(-1)[0].uid.toString());

    const promise = incoming.map(this.handleIncoming);
    await Promise.all(promise);
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
}
