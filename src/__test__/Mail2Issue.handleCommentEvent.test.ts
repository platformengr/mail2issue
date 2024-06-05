import Mail2Issue from "../Mail2Issue";
import MailProvider from "../MailProvider";
import IssueProvider from "../IssueProvider";
import StateProvider from "../StateProvider";
import { MessageTypes, Comment } from "../types";
import issuesCommentsFixture from "./fixtures/comments.json";
import fs from "fs";

const IssueFixture = {
  id: 10001,
  title: "Issue Title",
  body: "This is an issue",
  createdAt: "2021-01-01T12:00:00Z",
  comments: [],
  meta: {
    from: [
      {
        name: "use1",
        address: "email1",
      },
    ],
    toReceivers: [
      {
        name: "Use2",
        address: "email2",
      },
    ],
    ccReceivers: [
      {
        name: "Use3",
        address: "email3",
      },
    ],
    replyTo: [
      {
        name: "Use4",
        address: "email4",
      },
    ],
    type: MessageTypes.Original,
  },
};

jest.mock(
  "../MailProvider",
  jest.fn().mockImplementation(() => ({
    __esModule: true, //When module has multiple exports
    default: jest.fn().mockImplementation(() => ({
      sendEmail: jest.fn(() => Promise.resolve()),
      emailAddress: "mailserver@mm.com",
    })),
  })),
);

jest.mock(
  "../IssueProvider",
  jest.fn().mockImplementation(() => ({
    __esModule: true, //When module has multiple exports
    default: jest.fn().mockImplementation(() => ({
      createIssue: jest.fn(() => Promise.resolve()),
      commentIssue: jest.fn(() => Promise.resolve()),
      createIssueComment: jest.fn((c) => Promise.resolve()),
      getIssue: jest.fn(() => Promise.resolve(IssueFixture)),
      getIssueComments: jest.fn(() => Promise.resolve(issuesCommentsFixture)),
    })),
  })),
);

jest.mock(
  "../StateProvider",
  jest.fn().mockImplementation(() => ({
    __esModule: true, //When module has multiple exports
    default: jest.fn().mockImplementation(() => ({
      lastUidSynced: {
        get: jest.fn(() => Promise.resolve("10000")),
        set: jest.fn(() => Promise.resolve()),
      },
      lastSynced: {
        get: jest.fn(() =>
          Promise.resolve(new Date("2022-02-21").toISOString()),
        ),
        set: jest.fn(() => Promise.resolve()),
      },
    })),
  })),
);

const commentFixture: Comment = {
  issueId: 10001,
  body: "This is a comment",
  createdAt: new Date("2021-01-01T12:00:00Z"),
  meta: {
    from: [
      {
        name: "John Doe",
        address: "email@address.com",
      },
    ],
    type: MessageTypes.Unknown,
  },
};

const createMail2IssueInstance = () => {
  const mailProvider = new MailProvider({
    emailAddress: "abc@efg.com",
    password: "1234",
    imap: "mail.server.com",
  });

  const issueProvider = new IssueProvider("token");
  const stateProvider = new StateProvider("token");
  const mail2Issue = new Mail2Issue(mailProvider, issueProvider, stateProvider);
  return { mail2Issue, mailProvider, issueProvider, stateProvider };
};

describe("Mail2Issue handleCommentEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should create new internal comment with meta for internal messages", async () => {
    const { mail2Issue, issueProvider, mailProvider } =
      createMail2IssueInstance();
    const comment = {
      ...commentFixture,
      body: "/internal \n This is a comment",
    };

    const expected = {
      ...comment,
      meta: { ...comment.meta, type: MessageTypes.InternalNote },
    };
    await mail2Issue.handleCommentEvent(comment);
    expect(issueProvider.createIssueComment).toHaveBeenCalledTimes(1);
    expect(issueProvider.createIssueComment).toHaveBeenCalledWith(expected);
    expect(mailProvider.sendEmail).not.toHaveBeenCalled();
  });

  it("should create new agent answer comment with meta", async () => {
    const { mail2Issue, issueProvider, mailProvider } =
      createMail2IssueInstance();
    const comment = {
      ...commentFixture,
      body: "This is a comment",
    };
    const expected = {
      ...comment,
      meta: { ...comment.meta, type: MessageTypes.AgentReply },
    };

    await mail2Issue.handleCommentEvent(comment);
    expect(issueProvider.createIssueComment).toHaveBeenCalledTimes(1);
    expect(issueProvider.createIssueComment).toHaveBeenCalledWith(expected);
    expect(mailProvider.sendEmail).toHaveBeenCalledTimes(1);
    const sampleReply = fs.readFileSync(
      "src/__test__/fixtures/sampleReply.txt",
      "utf-8",
    );
    expect(mailProvider.sendEmail).toHaveBeenCalledWith({
      to: ["email1", "email2", "email4"],
      cc: ["email3"],
      subject: "Re: [:10001] Issue Title",
      text: sampleReply,
    });
  });
  it("internal comments should not be included int the agent answer email", async () => {
    const { mail2Issue, issueProvider, mailProvider } =
      createMail2IssueInstance();
    const commentCopy = structuredClone(issuesCommentsFixture);
    commentCopy[0].meta.type = MessageTypes.InternalNote;
    commentCopy[1].meta.type = MessageTypes.InternalNote;
    commentCopy[2].meta.type = MessageTypes.InternalNote;
    jest
      .spyOn(issueProvider, "getIssueComments")
      .mockImplementation(() =>
        Promise.resolve(commentCopy as unknown as Comment[]),
      );
    const comment = {
      ...commentFixture,
      body: " This is a comment",
    };

    await mail2Issue.handleCommentEvent(comment);
    expect(mailProvider.sendEmail).toHaveBeenCalledWith({
      to: ["email1", "email2", "email4"],
      cc: ["email3"],
      subject: "Re: [:10001] Issue Title",
      text:
        " This is a comment\n" +
        "---\n" +
        "Original Issues:\n" +
        "From: use1\n" +
        "Date: 2021-01-01T12:00:00Z\n" +
        "Subject: Issue Title\n" +
        "\n" +
        "This is an issue\n",
    });
  });
});
