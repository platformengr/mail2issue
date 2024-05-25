import * as github from "@actions/github";

type MessageTypes = "original" | "reply";

interface createIssue {
  title: string;
  body: string;
  meta: {
    uid: number;
    type: MessageTypes;
    messageId?: string ;
    from: { address: string; name: string }[];
    toReceivers: { address: string; name: string }[];
    ccReceivers?: { address: string; name: string }[] ;
    replyTo?: string;
  };
}

export default class IssueProvider {
  private readonly octokit;
  private readonly base;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.base = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    };
  }

  /**
   * Creates a new issue with the specified title, body, and meta data.
   * @param {createIssue} options - The options for creating the issue.
   * @param {string} options.title - The title of the issue.
   * @param {string} options.body - The body of the issue.
   * @param {any} options.meta - The meta data associated with the issue.
   * @returns {Promise<any>} - A promise that resolves to the newly created issue.
   */
  async createIssue({ title, body, meta }: createIssue) {
    const newIssue = await this.octokit.rest.issues.create({
      ...this.base,
      title,
      body: "<!--" + JSON.stringify(meta) + "-->\n" + body,
    });
    return newIssue;
  }

  async getIssue(id: number) {
    const issue = await this.octokit.rest.issues.get({
      ...this.base,
      issue_number: id,
    });
    return issue;
  }

  async commentIssue(id: number, body: string) {
    const newComment = await this.octokit.rest.issues.createComment({
      ...this.base,
      issue_number: id,
      body: body,
    });
    return newComment;
  }
}
