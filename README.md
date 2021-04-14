# Issue Bot
> GitHub Actions powered Issue Bot 🦾

<p align="center">
  <img src="https://github.com/imjohnbo/issue-bot/actions/workflows/ci.yml/badge.svg" />
</p>

## About

Work on a distributed team? Try using Issue Bot as a Scrum [standup](https://en.wikipedia.org/wiki/Stand-up_meeting) process automation bot to keep track of what you're all working on. 🤖

Have repeated tasks you're setting reminders for elsewhere? Issue Bot's got your back there, too. 👏

Or just need an issue created on a certain condition? Issue Bot is there when your CI build breaks. 💔

Issue Bot is a flexible GitHub action that takes care of a few issue related tasks:
- Opens new issue with `title`, `body`, `labels`, and `assignees`
- Uses [Mustache templating syntax](https://github.com/janl/mustache.js) in `body`, along with a couple of handy template variables: `assignees` and `previousIssueNumber`
- Closes most recent previous issue with all `labels` if `close-previous` is true
- Adds new issue to `project` (user, organization, or repository project based on value of `project-type`), `column`, and `milestone`
- Pins new issue and unpins previous issue if `pinned` is true
- Makes issue comments linking new and previous issues if `linked-comments` is true
- Assigns new issue only to the _next_ assignee in the list if `rotate-assignees` is true. Useful for duty rotation like first responder.
- Pairs well with [imjohnbo/extract-issue-template-fields](https://github.com/imjohnbo/extract-issue-template-fields) if you'd prefer to open issues based on [issue templates](https://docs.github.com/en/github/building-a-strong-community/about-issue-and-pull-request-templates#issue-templates)

## v3 Migration
⚠️ If you're a `v2` user, please note that these breaking changes were introduced in `v3`: ⚠️
- `template` functionality has been moved to a separate action: https://github.com/imjohnbo/extract-issue-template-fields.
- `labels` now checks if **all** labels match. Before, it checked if **any** labels matched.

and these features were added 🎉:
- `project` and `column` for adding an issue to a [repository project board](https://docs.github.com/en/github/managing-your-work-on-github/about-project-boards).
- `milestone` for adding an issue to a [milestone](https://docs.github.com/en/github/managing-your-work-on-github/tracking-the-progress-of-your-work-with-milestones).

As always, your feedback and [contributions](#contributing) are welcome.

## Usage

Simple example:
```yml
# ...
- name: Create new issue
  uses: imjohnbo/issue-bot@v3
  with:
    assignees: "octocat, monalisa"
    title: Hello, world
    body: |-
      :wave: Hi, {{#each assignees}}@{{this}}{{#unless @last}}, {{/unless}}{{/each}}!
    pinned: true
# ...
```

For more examples, see a [GitHub-wide search](https://github.com/search?q=%22uses%3A+imjohnbo%2Fissue-bot%22&type=code) or [./docs/example-workflows](docs/example-workflows/):
- [Daily standup bot](docs/example-workflows/standup.yml)
- [Repeated tasks](docs/example-workflows/scheduled-task.yml)
- [Duty rotation](docs/example-workflows/first-responder.yml)
- [Ad hoc after broken CI build](docs/example-workflows/broken-build.yml)

## Inputs and outputs

See [action.yml](action.yml)

## Template variables

The issue body is treated as a [Handlebars](https://handlebarsjs.com) template, with support for template variables:

- `assignees`: The array of issue assignees.
- `previousIssueNumber`: The previous issue number in the series.

## Contributing

Feel free to open an issue, or better yet, a
[pull request](https://github.com/imjohnbo/issue-bot/compare)!

## License

[MIT](LICENSE)
