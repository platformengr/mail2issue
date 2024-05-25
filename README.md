# Mail2Issues

This is a GitHub action that creates issues from emails.

## Usage

To use this action in your GitHub workflow, you can add a step in your workflow file that uses this action:

```yaml
steps:
  - name: Run Mail2Issues
    uses: platformengr/mail2issue
    with:
      mail-config: '{
        "emailAddress": "your-email@example.com",
        "password": "${{ secrets.MAIL_PASSWORD }}",
        "imap": {"host": "imap.example.com"}
        }'
      task: "sync"
```

## Inputs

- `token`: The GitHub token used to authenticate with the GitHub API.

## Development

### Building

To build this project, run the following command:

```sh
npm run build
```

### Testing

To run the tests for this project, use the following command:

```sh
npm run test
```

## Contributing

If you want to contribute to this project, please open an issue or a pull request.

## License

This project is licensed under the ISC license.

```

Please replace the placeholders with the actual details of your project.
```
