import Imap from "imap";
import { simpleParser, Headers } from "mailparser";
import nodemailer from "nodemailer";


export default class MailProvider {
  private readonly emailAddress: string;
  private readonly password: string;
  private readonly imap: Imap;
  private readonly transporter: nodemailer.Transporter;

  constructor(
    emailAddress: string,
    password: string,
    imap: { host: string; port: number | undefined; tls: boolean | undefined },
    smtp:
      | {
          host: string | undefined;
          port: number | undefined;
          inSecure: boolean | undefined;
          auth:
            | { user: string | undefined; pass: string | undefined }
            | undefined;
        }
      | undefined,
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
      host: smtp?.host ?? imap.host,
      port: smtp?.port ?? smtp?.inSecure ? 21 : 465,
      secure: smtp?.inSecure ?? true,
      auth: {
        user: smtp?.auth?.user ?? emailAddress,
        pass: smtp?.auth?.pass ?? password,
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
            console.log("results", selected);

            const fetchResults = this.imap.fetch(selected, {
              bodies: "",
              struct: true,
            });
            const emails: EmailData[] = [];

            fetchResults.on("message", (msg, seq) => {
              const uidPromise = new Promise((resolve) => {
                msg.on("attributes", (attrs) => {
                  resolve(attrs.uid); // Resolve promise when uid is available
                });
              });

              const parts: Buffer[] = [];
              msg.on("body", (stream) => {
                stream.on("data", (chunk) => {
                  parts.push(chunk);
                });

                stream.once("end", async () => {
                  const uid = (await uidPromise) as number;
                  const buffer = Buffer.concat(parts);
                  simpleParser(buffer, (err, parsed) => {
                    if (err) reject(err);
                    emails.push({
                      uid,
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
                uid: email.uid,
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
  uid: number;
  headers: Headers;
  body: string;
  date: Date;
  attachments: any[];
}

export interface FetchedEmail {
  uid: number;
  senders: { address: string; name: string }[];
  messageId: string | undefined;
  toReivers: { address: string; name: string }[];
  ccReivers: { address: string; name: string }[] | undefined;
  subject: string;
  body: string;
  date: Date;
  replyTo: string | undefined;
  attachments: any[];
}
