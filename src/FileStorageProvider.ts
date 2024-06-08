// Git based implementation of the file storage provider
import * as fs from "node:fs/promises";
import { exec } from "child_process";
import * as github from "@actions/github";


type FileBuffer = {
  content: Buffer;
  filename: string;
};
type IssueAttachments = {
  issueId: number;
  commentId?: number;
  attachments: FileBuffer[];
};

type savedFiles = {
  filename: string;
  url: string;
};

export default class FileStorageProvider {
  token: string;
  owner: string;
  repo: string;
  constructor(token:string) {
    this.token = token;
    this.owner = github.context.repo.owner,
    this.repo = github.context.repo.repo,
  } 

  public async saveFiles(
    issueAttachments: IssueAttachments,
  ): Promise<savedFiles[]> {
    const attachments = issueAttachments.attachments;
    for await (const attachment of attachments) {
      await this.saveFileOnCurrentAgent(attachment);
    }
    await this.commitAndPush(
      attachments.map((a) => a.filename),
      issueAttachments.issueId,
      issueAttachments.commentId,
    );
    const base = `https://github.com/${this.owner}/${this.repo}`;
    return issueAttachments.attachments.map((a) => ({
      filename: a.filename,
      url: encodeURIComponent(`${base}/blob/${issueAttachments.issueId}/${a.filename}?raw=true`),
    }));
  }
  private async saveFileOnCurrentAgent(files: FileBuffer): Promise<void> {
    await fs.writeFile(files.filename, files.content);
  }
  private async commitAndPush(
    filenames: string[],
    issueId: number,
    commentId?: number,
  ): Promise<void> {
    const issueFolder = `issue-attachments/${issueId}`;
    const branchName = !commentId
      ? `${issueFolder}`
      : `${issueFolder}/${commentId}`;

    const files = filenames.map((f) => `"${f}"`).join(" ");

    const commands = [
      `git checkout --orphan ${branchName};\n`,
      `git rm -rf .;\n`,
      `git add ${files};\n`,
      `git commit -m "${branchName.replace(/\//g, " ")}";\n`,
      `git push --set-upstream  origin ${branchName};\n`,
    ];

    const commandPromise = new Promise<void>((resolve, reject) =>
      exec(commands.join("\n"), (err, stdout) => {
        if (err) {
          reject(err);
        } else {
          console.log(stdout);
          resolve();
        }
      }),
    );

    await commandPromise;
  }
}
