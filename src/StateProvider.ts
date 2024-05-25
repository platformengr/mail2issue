import * as github from "@actions/github";

export default class StateProvider {
  private readonly octokit;
  private readonly base;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.base = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    };
  }

  private async setVariables(name: string, value: string) {
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

  private async updateVariables(name: string, value: string) {
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

  private async deleteVariables(name: string) {
    return await this.octokit.request(
      "DELETE /repos/{owner}/{repo}/actions/variables/{name}",
      {
        ...this.base,
        name,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
  }

  private async setOrUpdateVariables(name: string, value: string) {
    try {
      await this.updateVariables(name, value);
    } catch (error: any) {
      if (error?.status === 400) await this.setVariables(name, value);
      else throw error;
    }
  }

  private async getVariables(name: string) {
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

  public lastSynced = {
    get: async () => await this.getVariables("lastSynced"),
    set: async (value: string) =>
      await this.setOrUpdateVariables("lastSynced", value),
  };
  public testDb = {
    get: async () => await this.getVariables("testDb"),
    set: async (value: string) =>
      await this.setOrUpdateVariables("testDb", value),
    delete: async () => await this.deleteVariables("testDb"),
  };
}
