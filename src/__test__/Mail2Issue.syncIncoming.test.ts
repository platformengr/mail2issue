import fixture from "./fixtures/incomingMail.json";
import createIssuesFixture from "./fixtures/createIssueCall.json";
import Mail2Issue from "../Mail2Issue";
import MailProvider, { FetchedEmail } from "../MailProvider";
import IssueProvider from "../IssueProvider";
import StateProvider from "../StateProvider";

jest.mock(
  "../MailProvider",
  jest.fn().mockImplementation(() => ({
    __esModule: true, //When module has multiple exports
    default: jest.fn().mockImplementation(() => ({
      sendEmail: jest.fn(() => Promise.resolve()),
      fetchEmailsByUID: jest.fn(() => Promise.resolve(fixture)),
      fetchEmailsByDate: jest.fn(() => Promise.resolve(fixture)),
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

describe("Mail2Issue sync incoming", () => {
  beforeEach(() => {
    // Mock the current date
    const currentDate = new Date("2022-01-01T00:00:00Z");
    jest.spyOn(global, "Date").mockImplementation(() => currentDate);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("should get create 3 issues", async () => {
    const mailProvider = new MailProvider({
      emailAddress: "abc@efg.com",
      password: "1234",
      host: "mail.server.com",
    });
    const issueProvider = new IssueProvider("token");
    const stateProvider = new StateProvider("token");
    const mail2Issue = new Mail2Issue(
      mailProvider,
      issueProvider,
      stateProvider,
    );
    await mail2Issue.syncIncoming();
    expect(mailProvider.fetchEmailsByUID).toHaveBeenCalledTimes(1);
    expect(issueProvider.createIssue).toHaveBeenCalledTimes(fixture.length);
    expect(stateProvider.lastUidSynced.get).toHaveBeenCalledTimes(1);
    expect(stateProvider.lastUidSynced.set).toHaveBeenCalledTimes(1);

    expect(issueProvider.createIssue).toHaveBeenCalledWith(
      createIssuesFixture[0],
    );
    expect(issueProvider.createIssue).toHaveBeenCalledWith(
      createIssuesFixture[1],
    );
    expect(issueProvider.createIssue).toHaveBeenCalledWith(
      createIssuesFixture[2],
    );
    expect(stateProvider.lastUidSynced.set).toHaveBeenCalledWith("20003");
  });

  it("should getByDate when no Last uid", async () => {
    // change the value of  mocked lastUidSynced.get to return null
    const stateProvider = new StateProvider("token");
    stateProvider.lastUidSynced.get = jest.fn(() => Promise.resolve(null));

    const mailProvider = new MailProvider({
      emailAddress: "abc@efg.com",
      password: "1234",
      host: "mail.server.com",
    });
    const issueProvider = new IssueProvider("token");
    const mail2Issue = new Mail2Issue(
      mailProvider,
      issueProvider,
      stateProvider,
    );
    await mail2Issue.syncIncoming();

    expect(mailProvider.fetchEmailsByDate).toHaveBeenCalledTimes(1);
    expect(mailProvider.fetchEmailsByUID).toHaveBeenCalledTimes(0);
  });

  it("should handel replays to  comments ", async () => {
    // change the value of  mocked fetchEmailsByUID to return null
    const mailProvider = new MailProvider({
      emailAddress: "abc@efg.com",
      password: "1234",
      host: "mail.server.com",
    });
    const newFixture = {
      ...fixture[0],
      subject: "Re:[:10001]abc",
    } as unknown as FetchedEmail;
    jest
      .spyOn(mailProvider, "fetchEmailsByUID")
      .mockImplementation(() => Promise.resolve([newFixture]));

    const issueProvider = new IssueProvider("token");
    const stateProvider = new StateProvider("token");
    const mail2Issue = new Mail2Issue(
      mailProvider,
      issueProvider,
      stateProvider,
    );
    await mail2Issue.syncIncoming();

    expect(issueProvider.createIssueComment).toHaveBeenCalledTimes(1);
    expect(issueProvider.createIssueComment).toHaveBeenCalledWith({
      issueId: 10001,
      body: newFixture.VisibleText,
      createdAt: new Date("2022-01-01T00:00:00Z"),
      meta: {
        type: "user-reply",
        from: [{ address: "sender1@example.com", name: "Sender One" }],
        ccReceivers: undefined,
        messageId: "message1",
        replyTo: "replyto1@example.com",
        toReceivers: [
          {
            address: "receiver1@example.com",
            name: "Receiver One",
          },
        ],
        uid: 20001,
      },
    });
    expect(issueProvider.createIssue).toHaveBeenCalledTimes(0);
  });
});
