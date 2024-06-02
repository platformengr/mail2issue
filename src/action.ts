import * as core from "@actions/core";
import * as github from "@actions/github";
import StateProvider from "./StateProvider";
import IssueProvider from "./IssueProvider";
import MailProvider, { MailProviderOptions } from "./MailProvider";
import Mail2Issue from "./Mail2Issue";
import { MessageTypes } from "./types";

/**
 * Runs the main logic of the action.
 * Retrieves the task and token inputs, initializes the necessary providers,
 * and performs the corresponding action based on the task.
 * @throws {Error} If the task or token inputs are missing, or if the task is invalid.
 */
async function run() {
  const task = core.getInput("task");
  if (!task) throw new Error("Task is required");
  const token = core.getInput("token");
  if (!token) throw new Error("GITHUB_TOKEN is required");

  core.info("task is " + task);

  const mailConfig = JSON.parse(
    core.getInput("mail-config"),
  ) as MailProviderOptions;

  const issueProvider = new IssueProvider(token);
  const stateProvider = new StateProvider(token);
  const mailProvider = new MailProvider(mailConfig);
  const mail2Issue = new Mail2Issue(mailProvider, issueProvider, stateProvider);

  if (task === "sync") await mail2Issue.syncIncoming();
  else if (task === "issueAction") await handleIssueAction(mail2Issue);
  else if (task === "test")
    await testMailConnection(mailProvider, mailConfig.emailAddress);
  else
    throw new Error(
      "Invalid task input, must be 'sync', 'issueAction', or 'test'",
    );
}

if (process.env.NODE_ENV !== "test") {
  void run();
}

/**
 * Tests the mail connection by sending a test email and verifying its receipt.
 * @param mailProvider - The mail provider object used to send and fetch emails.
 * @param emailAddress - The email address to send the test email to.
 * @throws {Error} If no emails are found after sending the test email.
 */
async function testMailConnection(
  mailProvider: MailProvider,
  emailAddress: string,
) {
  core.info("EMAIL CONNECTION TEST:");
  core.info("Sending test email");
  await mailProvider.sendEmail({
    to: [emailAddress],
    subject: "Test Email",
    text: "This is a test email from the mail2issue action",
  });
  core.info("Test email sent successfully");
  //wait for 5 seconds to allow the email to be sent
  core.info("Waiting for 5 seconds");
  await new Promise((resolve) => setTimeout(resolve, 5000));
  core.info("getting test email ");
  const emails = await mailProvider.fetchEmailsByDate(getYesterday(), 20);
  if (emails.length === 0) throw new Error("No emails found");
  core.info("Test email received successfully");
}
function getYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}
async function handleIssueAction(mail2Issue: Mail2Issue) {
  const payload = github.context.payload;
  const isComment = payload.comment?.id;
  if (isComment) {
    core.info("Comment event detected");
    await mail2Issue.handleCommentEvent({
      issueId: payload.issue!.number,
      id: payload.comment!.id,
      body: payload.comment!.body,
      createdAt: payload.comment!.created_at ?? new Date().toISOString(),
      meta: {
        type: MessageTypes.AgentReply,
        from: [
          {
            name: payload.comment!.user.login,
            address: payload.comment!.user.email,
          },
        ],
      },
    });
  }
}
