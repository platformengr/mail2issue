import * as github from "@actions/github";
import { CreateIssue, Meta } from "./types";

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
   * @param {CreateIssue} options - The options for creating the issue.
   * @param {string} options.title - The title of the issue.
   * @param {string} options.body - The body of the issue.
   * @param {any} options.meta - The meta data associated with the issue.
   * @returns {Promise<any>} - A promise that resolves to the newly created issue.
   */
  public async createIssue({ title, body, meta }: CreateIssue): Promise<any> {
    const { metaString, sender } = this.formatMeta(meta);

    const newIssue = await this.octokit.rest.issues.create({
      ...this.base,
      title,
      body: `${metaString}\n\n**From:** ${sender}\n\n  --- \n\n${body}`,
    });
    return newIssue;
  }

  private formatMeta(meta: Meta) {
    if (!meta || !meta.from || !meta.from[0])
      throw new Error("Meta is undefined");

    const senderHasName = !!meta.from[0].name;
    const sender = `[${senderHasName ? meta.from[0].name : meta.from[0].address}](${`mailto:${meta.from[0].address}`})`;
    const metaString = `<!--JSON${JSON.stringify(meta)}-->`;
    return { metaString, sender };
  }

  private extractMeta(body: string) {
    const metaString = body.match(/<!--JSON([\s\S]+?)-->/);
    if (!metaString) throw new Error("Issue meta data is missing:" + body);
    if (!metaString[1]) throw new Error("Issue meta data is empty" + body);

    const meta = JSON.parse(metaString[1]) as Meta;
    const cleanBody = body.replace(/<!--JSON([\s\S]+?)-->/, "");
    return { meta, cleanBody };
  }

  /**
   * Retrieves an issue by its ID.
   * @param id - The ID of the issue to retrieve.
   * @returns An object containing the ID, title, body, and meta of the issue.
   * @throws Error if the issue body is empty.
   */
  public async getIssue(id: number) {
    const issue = await this.octokit.rest.issues.get({
      ...this.base,
      issue_number: id,
    });

    const bodyWithMeta = issue?.data?.body;
    if (!bodyWithMeta) throw new Error("Issue body is empty, Issue id: " + id);
    const { meta, cleanBody } = this.extractMeta(bodyWithMeta);

    return {
      id: issue.data.id,
      title: issue.data.title,
      body: cleanBody,
      meta: meta,
    };
  }

  /**
   * Adds a comment to an existing issue.
   * @param id - The ID of the issue.
   * @param body - The body of the comment.
   * @returns A promise that resolves to the newly created comment.
   */
  public setIssueComment = async ({
    id,
    body,
    meta,
  }: {
    id: number;
    body: string;
    meta: Meta;
  }) => {
    const { metaString, sender } = this.formatMeta(meta);

    await this.octokit.rest.issues.createComment({
      ...this.base,
      issue_number: id,
      body: `${metaString}\n\n**From:** ${sender}\n\n  --- \n\n${body}`,
    });
  };

  /**
   * Retrieves all comments associated with an issue.
   * @param issueId - The ID of the issue.
   * @returns An array of comments associated with the issue.
   */
  public async getIssueComment(issueId: number) {
    const comments = await this.octokit.rest.issues.listComments({
      ...this.base,
      issue_number: issueId,
    });

    return comments.data.map((c) => {
      if (!c.body) return;
      const { cleanBody, meta } = this.extractMeta(c.body);
      return { body: cleanBody, meta: meta };
    });
  }

  public addMeta = async ({
    comment,
    meta,
  }: {
    comment: { id: number; body: string };
    meta: Meta;
  }) => {
    const { metaString } = this.formatMeta(meta);
    const newBody = `${metaString}\n\n --- \n\n${comment}`;
    await this.octokit.rest.issues.updateComment({
      comment_id: comment.id,
      body: newBody,
      ...this.base,
    });
  };
}
