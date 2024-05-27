import * as github from "@actions/github";
import { createIssue, meta } from "./types";

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
  public async createIssue({ title, body, meta }: createIssue): Promise<any> {
    const newIssue = await this.octokit.rest.issues.create({
      ...this.base,
      title,
      body: "<!--" + JSON.stringify(meta) + "-->\n" + body,
    });
    return newIssue;
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
    const meta = this.extractMeta(bodyWithMeta, id);
    const body = bodyWithMeta.replace(/<!--([\s\S]+?)-->/, "");

    return {
      id: issue.data.id,
      title: issue.data.title,
      body: body,
      meta: meta,
    };
  }

  private extractMeta(body: string, id: number) {
    const metaString = body.match(/<!--([\s\S]+?)-->/);
    if (!metaString)
      throw new Error("Issue meta data is missing, Issue id: " + id);
    if (!metaString[0])
      throw new Error("Issue meta data is empty, Issue id: " + id);

    const meta = JSON.parse(metaString[0]) as meta;
    return meta;
  }

  /**
   * Adds a comment to an existing issue.
   * @param id - The ID of the issue.
   * @param body - The body of the comment.
   * @returns A promise that resolves to the newly created comment.
   */
  public async commentIssue(id: number, body: string) {
    const newComment = await this.octokit.rest.issues.createComment({
      ...this.base,
      issue_number: id,
      body: body,
    });
    return newComment;
  }
}
