import Mail2Issue from "../Mail2Issue";
import MailProvider, { FetchedEmail } from "../MailProvider";
import IssueProvider from "../IssueProvider";
import StateProvider from "../StateProvider";
import { MessageTypes, Comment } from "../types";

jest.mock(
  "../MailProvider",
  jest.fn().mockImplementation(() => ({
    __esModule: true, //When module has multiple exports
    default: jest.fn().mockImplementation(() => ({
      sendEmail: jest.fn(() => Promise.resolve()),
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
      createIssueComment: jest.fn(() => Promise.resolve()),
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
  meta: {
    from: [
      {
        name: "John Doe",
        address: "email@address.com",
      },
    ],
    type: MessageTypes.AgentReply,
  },
};

const createMail2IssueInstance = () => {
  const mailProvider = new MailProvider({
    emailAddress: "abc@efg.com",
    password: "1234",
    host: "mail.server.com",
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
  it("should create new internal comment with meta", async () => {
    const { mail2Issue, issueProvider, mailProvider } =
      createMail2IssueInstance();
    const comment = {
      ...commentFixture,
      body: "/internal \n This is a comment",
    };
    await mail2Issue.handleCommentEvent(comment);
    expect(issueProvider.createIssueComment).toHaveBeenCalledTimes(1);
    expect(issueProvider.createIssueComment).toHaveBeenCalledWith({
      ...comment,
    });
    expect(mailProvider.sendEmail).not.toHaveBeenCalled();
  });
});
