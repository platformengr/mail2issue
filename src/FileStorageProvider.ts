// Git based implementation of the file storage provider
import * as fs from "node:fs/promises";
import { exec } from "child_process";

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
  constructor() {} // should not need token as it runs commands on the runner.

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

    return issueAttachments.attachments.map((a) => ({
      filename: a.filename,
      url: `/blob/${issueAttachments.issueId}/${a.filename}?raw=true`,
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
      `git config user.name github-actions[bot];\n`,
      `git config user.email 41898282+github-actions[bot]@users.noreply.github.com;\n`,
      `git checkout —orphan ${branchName};\n`,
      `git rm -rf .;\n`,
      `git add ${files};\n`,
      `git commit -m "${branchName.replace(/\//g, " ")}";\n`,
      `git push origin ${branchName};\n`,
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
