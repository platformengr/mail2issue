import Imap from "imap";
import { simpleParser, Headers } from "mailparser";
import nodemailer from "nodemailer";

export default class MailBox {
  emailAddress: string;
  password: string;
  imap: Imap;
  transporter: nodemailer.Transporter;

  constructor(
    emailAddress: string,
    password: string,
    imap: { host: string; port: number | undefined; tls: boolean | undefined },
    smtp: {
      host: string | undefined;
      port: number | undefined;
      secure: boolean | undefined;
      auth: { user: string | undefined; pass: string | undefined } | undefined;
    },
  ) {
    this.emailAddress = emailAddress;
    this.password = password;

    this.imap = new Imap({
      user: this.emailAddress,
      password: this.password,
      host: imap.host,
      port: imap.port ?? 993,
      tls: imap.tls ?? true,
    });

    this.transporter = nodemailer.createTransport({
      host: smtp.host ?? imap.host,
      port: smtp.port ?? smtp.secure ? 465 : 21,
      secure: smtp.secure ?? true,
      auth: {
        user: smtp.auth?.user ?? emailAddress,
        pass: smtp.auth?.pass ?? password,
      },
    });
  }

  sendEmail = async (
    to: string,
    subject: string,
    text: string,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      this.transporter.sendMail(
        {
          from: this.emailAddress,
          to,
          subject,
          text,
        },
        (err) => {
          if (err) reject(err);
          resolve();
        },
      );
    });
  };
  fetchEmails = async (
    criteria = ["ALL"],
    limit = 10,
  ): Promise<FetchedEmail[]> => {
    return new Promise((resolve, reject) => {
      this.imap.once("ready", () => {
        this.imap.openBox("INBOX", true, (err) => {
          if (err) reject(err);

          this.imap.search(criteria, (err, results) => {
            if (err) reject(err);

            const fetchResults = this.imap.fetch(results.slice(0, limit), {
              bodies: "",
              struct: true,
            });
            const emails: EmailData[] = [];

            fetchResults.on("message", (msg) => {
              const parts: Buffer[] = [];

              msg.on("body", (stream) => {
                stream.on("data", (chunk) => {
                  parts.push(chunk);
                });

                stream.once("end", () => {
                  const buffer = Buffer.concat(parts);
                  simpleParser(buffer, (err, parsed) => {
                    if (err) reject(err);

                    emails.push({
                      headers: parsed.headers,
                      body: parsed.text ?? "",
                      date: parsed.date ?? new Date(),
                      attachments: [],
                    });
                  });
                });
              });
            });

            fetchResults.once("error", (err) => {
              this.imap.end();
              reject(err);
            });

            fetchResults.once("end", () => {
              this.imap.end();
              const fetchEmails = emails.map((email) => ({
                senders: (email.headers.get("from") as any).value as {
                  address: string;
                  name: string;
                }[],
                messageId: email.headers.get("message-id")?.toString(),
                references: email.headers.get("references"),
                toReivers: (email.headers.get("from") as any).value as {
                  address: string;
                  name: string;
                }[],
                ccReivers: (email.headers.get("cc") as any)?.value as
                  | { address: string; name: string }[]
                  | undefined,
                replyTo: email.headers.get("reply-to"),
                subject: email.headers.get("subject"),
                date: email.headers.get("date"),
                body: email.body,
                attachments: email.attachments,
              }));
              resolve(fetchEmails as FetchedEmail[]);
            });
          });
        });
      });

      this.imap.once("error", reject);
      this.imap.connect();
    });
  };
}

interface EmailData {
  headers: Headers;
  body: string;
  date: Date;
  attachments: any[];
}

export interface FetchedEmail {
  senders: { address: string; name: string }[];
  messageId: string | undefined;
  toReivers: { address: string; name: string }[];
  ccReivers: { address: string; name: string }[] | undefined;
  subject: string;
  body: string;
  date: Date;
  attachments: any[];
}
