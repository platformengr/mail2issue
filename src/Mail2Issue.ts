import MailProvider, { FetchedEmail } from "./MailProvider";
import IssueProvider from "./IssueProvider";
import StateProvider from "./StateProvider";

const NUMBER_OF_EMAILS = 30;
const DAYS_BACK = 1;
export default class Mail2Issue {
  private mailbox: MailProvider;
  private github;
  private state;

  constructor(mail: MailProvider, issue: IssueProvider, state: StateProvider) {
    this.mailbox = mail;
    this.github = issue;
    this.state = state;
  }

  private async getIncomingByUid(lastSynced: string) {
    if (isNaN(parseInt(lastSynced)))
      throw new Error("Invalid lastSynced value");
    return await this.mailbox.fetchEmailsByUID(
      parseInt(lastSynced),
      "*",
      NUMBER_OF_EMAILS,
    );
  }

  private async getIncomingByDays(daysBack: number) {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return await this.mailbox.fetchEmailsByDate(date, NUMBER_OF_EMAILS);
  }

  private handleNewTicket(mail: FetchedEmail) {
    const title = mail.subject;
    const body = mail.body;
    this.github.createIssue({
      title,
      body,
      meta: {
        from: mail.senders,
        toReceivers: mail.toReivers,
        ccReceivers: mail.ccReivers,
        replyTo: mail.replyTo,
        uid: mail.uid,
        messageId: mail.messageId,
        type: "original",
      },
    });
  }

  private handleReplay(mail: FetchedEmail, regex: RegExp) {
    const match = mail.subject?.match(regex);
    if (!match)
      throw new Error("could not find issue id in subject :" + mail.subject);
    const issueId = parseInt(match[0].slice(2, -1));
    const body = mail.body;
    this.github.commentIssue(issueId, body);
  }

  private handleIncoming(mail: FetchedEmail): void {
    const regex = /\[:\d+\]/;
    const isReplay = regex.test(mail.subject);
    if (isReplay) this.handleReplay(mail, regex);
    else this.handleNewTicket(mail);
  }

  /**
   * Synchronizes incoming emails.
   * 
   * @returns A promise that resolves to void.
   */
  public async syncIncoming(): Promise<void> {
    const lastSynced = await this.state.lastSynced.get();
    const incoming = lastSynced
      ? await this.getIncomingByUid(lastSynced)
      : await this.getIncomingByDays(DAYS_BACK);

    incoming.sort((a, b) => a.uid - b.uid).forEach(this.handleIncoming);
  }
}
