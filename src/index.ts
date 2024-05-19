
import core from '@actions/core';
import github from '@actions/github';
import Imap from 'imap';


export interface MailBox {
    user: string;
    password: string;
    host: string;
    port: number;
    tls: boolean ;
}

export interface EmailContent {
    subject: string;
    body: string;
    date: Date;
    sender: string;
}


export function getNewEmails(mailbox:MailBox): EmailContent[] {

   const imap = new Imap({...mailbox});
   imap.once('ready', () => {
       imap.openBox('INBOX', false, (err, box) => {
           if (err) {
               console.error(err);
               return;
           }
           imap.search(['UNSEEN'], (err, results) => {
               if (err) {
                   console.error(err


}

try {
  // Get the inputs from the workflow file: 
  const emailAddress = core.getInput('email-address');
  const password = core.getInput('password');

  // The code for the action goes here.
  // You can use the Octokit REST API to interact with GitHub.
  const octokit = github.getOctokit(core.getInput('repo-token'));
  
  // Use the GitHub API
  // For example, to create an issue in the repository where the action is running:
  const newIssue = octokit.issues.create({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    title: 'New issue from action',
    body: 'This is a new issue created from a GitHub Action.'
  });

  // Set the output for the action:
core.setOutput("issue", newIssue.data.html_url);


const newEmails = getNewEmails({
    emailAddress,
    password
} as MailBox);
for (const email of newEmails) {
    createIsse(core, email);
}

} catch (error) {
  core.setFailed(error.message);
}






