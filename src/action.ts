import * as core from "@actions/core";

import StateProvider from "./StateProvider";
import IssueProvider from "./IssueProvider";
import MailProvider, { MailProviderOptions } from "./MailProvider";
import Mail2Issue from "./Mail2Issue";
import { info } from "console";

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
  else if (task === "test")
    await testMailConnection(mailProvider, mailConfig.emailAddress);
  else throw new Error("Invalid task");
}

if (process.env.NODE_ENV !== "test") {
  void run();
}

async function testMailConnection(
  mailProvider: MailProvider,
  emailAddress: string,
) {
  core.info("EMAIL CONNECTION TEST:");
  core.info("Sending test email");
  await mailProvider.sendEmail(
    emailAddress,
    "Test Email",
    "This is a test email from the mail2issue action",
  );
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
