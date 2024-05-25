import MailProvider, { FetchedEmail } from "./MailProvider";
import IssueProvider from "./IssueProvider";
import StateProvider from "./StateProvider";

const NUMBER_OF_EMAILS = 30;
const DAYS_BACK = 1;
export default class Mail2Issue {
  private readonly mailbox: MailProvider;
  private readonly github;
  private readonly state;


  constructor(mail: MailProvider, issue: IssueProvider, state: StateProvider) {
    this.mailbox = mail;
    this.github = issue;
    this.state = state;

  }

  private  getIncomingByUid= async(lastSynced: string) => {
    if (isNaN(parseInt(lastSynced)))
      throw new Error("Invalid lastSynced value");
    return await this.mailbox.fetchEmailsByUID(
      parseInt(lastSynced),
      "*",
      NUMBER_OF_EMAILS,
    );
  }

  private  getIncomingByDays = async (daysBack: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    return await this.mailbox.fetchEmailsByDate(date, NUMBER_OF_EMAILS);
  }

  private  handleNewTicket= async (mail: FetchedEmail) => {
    const title = mail.subject;
    const body = mail.body;
    return await this.github.createIssue({
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

  private  handleReplay = async (mail: FetchedEmail, regex: RegExp) => {
    const match = mail.subject?.match(regex);
    if (!match)
      throw new Error("could not find issue id in subject :" + mail.subject);
    const issueId = parseInt(match[0].slice(2, -1));
    const body = mail.body;
    await this.github.commentIssue(issueId, body);
  }

  private  handleIncoming= async (mail: FetchedEmail)  => {
    const regex = /\[:\d+\]/;
    const isReplay = regex.test(mail.subject);
    if (isReplay) await this.handleReplay(mail, regex);
    else await this.handleNewTicket(mail);
  }

  /**
   * Synchronizes incoming emails.
   * 
   * @returns A promise that resolves to void.
   */
  public  syncIncoming = async () => {

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
  }
}
