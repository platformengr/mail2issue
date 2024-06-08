import * as github from "@actions/github";
import { CreateIssue, Meta, Comment, MessageTypes, Issue } from "./types";


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

  private formatMeta(meta: Meta) {
    if (!meta?.from?.[0])
      throw new Error("Meta is undefined");

    const senderHasName = !!meta.from[0].name;
    const sender = `[${senderHasName ? meta.from[0].name : meta.from[0].address}](${`mailto:${meta.from[0].address}`})`;
    const metaString = `<!--JSON${JSON.stringify(meta)}-->`;
    return { metaString, sender };
  }

  private extractMeta(body: string) {
    const metaString = body.match(/<!--JSON([\s\S]+?)-->/);
    if (!metaString) throw new Error("meta data is missing:" + body);
    if (!metaString[1]) throw new Error("meta data is empty" + body);

    const meta = JSON.parse(metaString[1]) as Meta;
    const cleanBody = body.replace(/<!--JSON([\s\S]+?)-->/, "");
    return { meta, cleanBody };
  }

  private bodyWithMetaFormat(body: string, meta: Meta): string {
    const { metaString, sender } = this.formatMeta(meta);
    const cleanBody = body.replace(/\*\*From:\*\*.*\n/, "");
    return `${metaString}\n\n**From:** ${sender}\n\n  --- \n\n${cleanBody}`;
  }

  private async updateAlreadyExistingGithubComment(
    id: number,
    metaString: string,
    sender: string,
    body: string,
  ) {
    const comment = await this.octokit.rest.issues.getComment({
      ...this.base,
      comment_id: id,
    });
    if (comment.data.body?.includes("<!--JSON"))
      throw new Error("Comment already has meta data");
    await this.octokit.rest.issues.updateComment({
      comment_id: id,
      body: `${metaString}\n\n**From:** ${sender}\n\n  --- \n\n${body}`,
      ...this.base,
    });
  }

  private async githubCommentToComment(c: IssueComment, issueId: number) {
    // github specific implementation for comments made by the user using ui
    // in this case we leave the meta data empty to
    let cleanBody = "";
    let meta = { from: [], type: MessageTypes.Unknown } as Meta;

    if (c.body?.includes("<!--JSON")) {
      // the one with meta
      const extract = this.extractMeta(c.body);
      meta = extract.meta;
      cleanBody = extract.cleanBody;
    } else {
      cleanBody = c.body ?? "";
    }

    //Github specific implementation for comments made by the user using ui
    if (!meta.from[0]) {
      const user = await this.octokit.rest.users.getByUsername({
        username: c.user?.login as string,
      });
      meta.from = [
        {
          address: user.data.email ?? "INTERNAL",
          name: user.data.name ?? (c.user?.login as string) ?? "AGENT",
        },
      ];
      if (!meta.type) meta.type = MessageTypes.Unknown;
    }
    return {
      id: c.id,
      issueId: issueId,
      body: cleanBody,
      createdAt: new Date(c.created_at),
      meta: meta,
    } as Comment;
  }

  /**
   * Creates a new issue with the specified title, body, and meta data.
   * @param {CreateIssue} options - The options for creating the issue.
   * @param {string} options.title - The title of the issue.
   * @param {string} options.body - The body of the issue.
   * @param {Meta} options.meta - The meta data associated with the issue.
   * @returns {Promise<number>} id- A promise that resolves to the newly created issue id.
   */
  public async createIssue({
    title,
    body,
    meta,
  }: CreateIssue): Promise<number> {
    const newIssue = await this.octokit.rest.issues.create({
      ...this.base,
      title,
      body: this.bodyWithMetaFormat(body, meta),
    });
    return newIssue.data.number;
  }

  /**
   * Updates an issue with the provided information.
   * @param {Issue} issue - The issue object containing the id, meta, and body.
   * @returns {Promise<void>} - A promise that resolves to the updated issue.
   */
  public async updateIssue({ id, meta, body }: Issue): Promise<void> {
    await this.octokit.rest.issues.update({
      ...this.base,
      issue_number: id,
      body: this.bodyWithMetaFormat(body, meta),
    });
  }

  /**
   * Retrieves an issue by its ID.
   * @param id - The ID of the issue to retrieve.
   * @returns An object containing the ID, title, body, and meta of the issue.
   * @throws Error if the issue body is empty.
   */
  public async getIssue(id: number): Promise<Issue> {
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
      createdAt: new Date(issue.data.created_at),
    };
  }

  /**
   * Adds a comment to an existing issue.
   * @param id - The ID of the issue.
   * @param body - The body of the comment.
   * @returns A promise that resolves to the newly created comment.
   */
  public createIssueComment = async ({ id, issueId, body, meta }: Comment) => {
    const { metaString, sender } = this.formatMeta(meta);

    //Github specific implementation for comments made by the user using ui first time
    if (id) {
      await this.updateAlreadyExistingGithubComment(
        id,
        metaString,
        sender,
        body,
      );
      return id;
    }
    const newComment = await this.octokit.rest.issues.createComment({
      ...this.base,
      issue_number: issueId,
      body: this.bodyWithMetaFormat(body, meta),
    });
    return newComment.data.id;
  };

  /**
   * Updates an issue comment.
   * @param {Comment} comment - The comment object containing the id, body, and meta information.
   * @returns {Promise<void>} - A promise that resolves to the updated comment.
   * @throws {Error} - If the comment id is missing.
   */
  public updateIssueComment = async ({
    id,
    body,
    meta,
  }: Comment): Promise<void> => {
    if (!id) throw new Error("Comment id is missing");

    await this.octokit.rest.issues.updateComment({
      ...this.base,
      comment_id: id,
      body: this.bodyWithMetaFormat(body, meta),
    });
  };

  /**
   * Retrieves all comments associated with an issue.
   * @param issueId - The ID of the issue.
   * @returns  An array of comments associated with the issue.
   */
  public async getIssueComments(issueId: number) {
    const githubComments = await this.octokit.rest.issues.listComments({
      ...this.base,
      issue_number: issueId,
    });

    const commentsPromise = githubComments.data.map(async (c) =>
      this.githubCommentToComment(c, issueId),
    );
    return Promise.all(commentsPromise);
  }

  public async getComment({
    id,
    issueId,
  }: {
    id: number;
    issueId: number;
  }): Promise<Comment> {
    const comment = await this.octokit.rest.issues.getComment({
      ...this.base,
      comment_id: id,
    });

    return this.githubCommentToComment(comment.data, issueId);
  }
}



import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { json } from "stream/consumers";

type IssueComment =
  RestEndpointMethodTypes["issues"]["getComment"]["response"]["data"];