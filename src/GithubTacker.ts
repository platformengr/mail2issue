import MailBox, { FetchedEmail } from "./MailsBox";
import GithubApi from "./github-api";

const NUMBER_OF_EMAILS = 30;
const DAYS_BACK = 1;
class GithubTacker {
  private mailbox: MailBox;
  private github;

  constructor(mailbox: MailBox, gitHub: GithubApi) {
    this.mailbox = mailbox;
    this.github = gitHub;
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
    this.github.createIssue(title, body);
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

  public async syncIncoming(): Promise<void> {
    const lastSynced = await this.github.getVariables("lastSynced");
    let incoming;
    if (!lastSynced) incoming = await this.getIncomingByDays(DAYS_BACK);
    else incoming = await this.getIncomingByUid(lastSynced);
    incoming.forEach(this.handleIncoming);
  }
}
