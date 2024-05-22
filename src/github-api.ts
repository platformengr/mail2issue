import * as github from "@actions/github";

export default class GithubApi {
  private readonly octokit;
  private readonly base;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.base = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    };
  }

  async createIssue(title: string, body: string) {
    const newIssue = await this.octokit.rest.issues.create({
      ...this.base,
      title: title,
      body: body,
    });
    return newIssue;
  }

  async getIssues(id: number) {
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

  async setVariables(name: string, value: string) {
    return await this.octokit.request(
      "POST /repos/{owner}/{repo}/actions/variables",
      {
        ...this.base,
        name,
        value,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  }

  async updateVariables(name: string, value: string) {
    return await this.octokit.request(
      "PATCH /repos/{owner}/{repo}/actions/variables/{name}",
      {
        ...this.base,
        name,
        value,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  }

  async setOrUpdateVariables(name: string, value: string) {
    try {
      await this.updateVariables(name, value);
    } catch (error: any) {
      if (error?.status === 400) await this.setVariables(name, value);
      else throw error;
    }
  }

  async getVariables(name: string) {
    try {
      return (
        await this.octokit.request(
          "GET /repos/{owner}/{repo}/actions/variables/{name}",
          {
            ...this.base,
            name,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
          },
        )
      ).data.value;
    } catch (error: any) {
      if (error?.status === 404) return null;
      throw error;
    }
  }
}
