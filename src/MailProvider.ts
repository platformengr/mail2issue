import Imap from "imap";
import { simpleParser, Headers } from "mailparser";
import nodemailer from "nodemailer";

export interface MailProviderOptions {
  emailAddress: string;
  password: string;
  host: string;
  imap?: { port?: number; tls?: boolean };
  smtp?: {
    host?: string;
    port?: number;
    auth?: { user?: string; pass?: string };
  };
}

export default class MailProvider {
  private readonly emailAddress: string;
  private readonly password: string;
  private readonly host: string;
  private readonly imap: Imap;
  private readonly transporter: nodemailer.Transporter;

  constructor(config: MailProviderOptions) {
    this.emailAddress = config.emailAddress;
    this.password = config.password;
    this.host = config.host;

    this.imap = new Imap({
      user: this.emailAddress,
      password: this.password,
      host: config.host,

      port: config.imap?.port ?? 993,
      tls: config.imap?.tls ?? true,
    });

    this.transporter = nodemailer.createTransport({
      host: config.smtp?.host ?? config.host,
      port: config.smtp?.port ?? 587,
      secure: config.smtp?.port === 465 ? true : false, // https://nodemailer.com/about/
      auth: {
        user: config.smtp?.auth?.user ?? config.emailAddress,
        pass: config.smtp?.auth?.pass ?? config.password,
      },
    });
  }

  /**
   * Sends an email using the provided parameters.
   *
   * @param to - The email address of the recipient.
   * @param subject - The subject of the email.
   * @param text - The content of the email.
   * @returns A Promise that resolves when the email is sent successfully, or rejects with an error if sending fails.
   */
  public sendEmail = async (
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

  /**
   * Fetches emails by UID range.
   *
   * @param start - The starting UID of the range.
   * @param end - The ending UID of the range. Use '*' to indicate the last UID.
   * @param limit - The maximum number of emails to fetch (optional).
   * @returns A promise that resolves to the fetched emails.
   */
  public fetchEmailsByUID = async (
    start: number,
    end: number | "*",
    limit: number | undefined = undefined,
  ) => this.fetchEmails([["UID", `${start}:${end}`]], limit);

  public fetchEmailsByDate = async (
    start: Date,
    limit: number | undefined = undefined,
  ) => this.fetchEmails([["SINCE", start.toISOString()]], limit);

  /**
   * Fetches emails from the INBOX using the specified criteria and limit.
   * @param criteria - An array of search criteria to filter the emails. Defaults to ["ALL"].
   * @param limit - The maximum number of emails to fetch. Defaults to 10.
   * @returns A promise that resolves to an array of fetched emails.
   */
  public fetchEmails = async (
    criteria: any[] = ["ALL"],
    limit = 10,
  ): Promise<FetchedEmail[]> => {
    return new Promise((resolve, reject) => {
      this.imap.once("ready", () => {
        this.imap.openBox("INBOX", true, (err) => {
          if (err) reject(err);

          this.imap.search(criteria, (err, results) => {
            if (err) reject(err);

            const selected = results.slice(-limit);

            const fetchResults = this.imap.fetch(selected, {
              bodies: "",
              struct: true,
            });
            const emailDataPromises: Promise<{
              buffer: string;
              uid: number;
            }>[] = [];

            fetchResults.on("message", (msg, seq) => {
              const uidPromise = new Promise((resolve) => {
                msg.on("attributes", (attrs) => {
                  resolve(attrs.uid); // Resolve promise when uid is available
                });
              });

              let buffer = "";
              msg.on("body", (stream) => {
                stream.on("data", (chunk) => {
                  buffer += chunk.toString("utf8");
                });

                stream.once("end", async () => {
                  emailDataPromises.push(
                    new Promise(async (resolve) => {
                      const uid = (await uidPromise) as number;
                      resolve({ buffer, uid });
                    }),
                  );
                });
              });
            });

            fetchResults.once("error", (err) => {
              this.imap.end();
              reject(err);
            });

            fetchResults.once("end", async () => {
              this.imap.end();
              const emailsData = await Promise.all(emailDataPromises);

              const promises = emailsData.map(async ({ buffer, uid }) => ({
                parsed: await simpleParser(buffer),
                uid,
              }));
              const parsedEmails = await Promise.all(promises);
              const fetchEmails = parsedEmails.map(
                ({ parsed: email, uid }) => ({
                  uid,
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
                  body: email.html ?? email.text ?? "",
                  attachments: email.attachments,
                }),
              );
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
  uid: number;
  headers: Headers;
  body: string;
  date: Date;
  attachments: any[];
}

export interface FetchedEmail {
  uid: number;
  senders: { address: string; name: string }[];
  messageId?: string;
  toReivers: { address: string; name: string }[];
  ccReivers?: { address: string; name: string }[];
  subject: string;
  body: string;
  date: Date;
  replyTo?: string;
  attachments?: any[];
}
