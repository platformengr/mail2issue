import MailBox from "./MailsBox";

class GithubTacker {
  private mailbox: MailBox;


  constructor(mailbox: MailBox, octokit: any) {
    this.mailbox = mailbox;

  }

  async syncIncoming(): Promise<void> {
    const newEmails = this.mailbox.getNewEmails();
    for (const email of newEmails) {
     // this.createIssue(email);
     // set current time
    }
  }

}