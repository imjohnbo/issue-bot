# Issue Bot

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

#### As a daily standup bot:

```yml
name: Daily Standup
on:
  schedule:
  # Every day at noon
  - cron: 0 12 * * * 

jobs:
  daily_standup:
    name: Daily Standup
    runs-on: ubuntu-latest
    steps:

    - name: Today's date
      run: echo "TODAY=$(date '+%Y-%m-%d')" >> $GITHUB_ENV

    # Generates and pins new standup issue, closes previous, writes linking comments, and assigns to all assignees in list
    - name: New standup issue
      uses: imjohnbo/issue-bot@v3
      with:
        assignees: "octocat, monalisa"
        labels: "standup"
        title: Standup
        body: |-
          :wave: Hi, {{#each assignees}}@{{this}}{{#unless @last}}, {{/unless}}{{/each}}!

          ## Standup for ${{ env.TODAY }}

          1. What did you work on yesterday?
          2. What are you working on today?
          3. What issues are blocking you?
        pinned: true
        close-previous: true
        linked-comments: true
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### To keep track of repeated tasks:

See more info: https://github.com/imjohnbo/extract-issue-template-fields.

```yml
name: Generate TPS reports from template
on:
  schedule:
  # First of every month – https://crontab.guru
  - cron: 0 0 1 * *

jobs:
  tps_reports:
    name: TPS reports
    runs-on: ubuntu-latest
    steps:

    - uses: imjohnbo/extract-issue-template-fields@v0.0.1
      id: extract
      with:
        path: .github/ISSUE_TEMPLATE/tps.md # assignees, labels, and title defined in issue template header
      env: 
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    # Generates new TPS report issue, assigns to all assignees in list, adds to repository project number 5, column name "Reports", milestone number 1
    - name: New TPS report
      uses: imjohnbo/issue-bot@v3
      with:
        assignees: ${{ steps.extract.outputs.assignees }}
        labels: ${{ steps.extract.outputs.labels }}
        title: ${{ steps.extract.outputs.title }}
        body: ${{ steps.extract.outputs.body }}
        project: 5  # The project-number from repository project https://github.com/owner/repo/projects/project-number
        column: Reports
        milestone: 1 # The milestone-number from https://github.com/owner/repo/milestone/milestone-number
        pinned: false
        close-previous: false
        linked-comments: false
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Rotate team duty:

```yml
name: First Responder
on:
  schedule:
  # First of every month – https://crontab.guru
  - cron: 0 0 1 * *

jobs:
  first_responder:
    name: New responder duty
    runs-on: ubuntu-latest
    steps:

    - new: Get template
      uses: imjohnbo/extract-issue-template-fields@v0.0.1
      id: extract
      with:
        path: .github/ISSUE_TEMPLATE/first_responder.md # assignees, labels, and title defined in issue template header
      env: 
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    # Generates and pins new first responder issue, closes previous, writes linking comments, assigns to next person in line, adds to organization project number 550, column name "Duties", milestone number 10
    - name: New first responder issue
      uses: imjohnbo/issue-bot@v3
      with:
        assignees: ${{ steps.extract.outputs.assignees }}
        labels: ${{ steps.extract.outputs.labels }}
        title: ${{ steps.extract.outputs.title }}
        body: ${{ steps.extract.outputs.body }}
        project-type: organization
        project: 550  # The project-number from organization project https://github.com/orgs/org/projects/project-number
        column: Duties
        milestone: 10 # The milestone-number from https://github.com/owner/repo/milestone/milestone-number
        pinned: true
        close-previous: true
        linked-comments: true
        rotate-assignees: true # Picks next assignee in list
      env:
        GITHUB_TOKEN: ${{ secrets.PAT }} # Built in GITHUB_TOKEN permissions are too restrictive, so a personal access token is used here
```

#### Downstream of a failed CI step 💔:

```yml
name: Continuous Integration
on:
  [push, pull_request]

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:

    - name: Test
      id: test
      run: |
        echo "...these are some test steps..."

    - name: issue-bot
      if: failure()
      uses: imjohnbo/issue-bot@v3
      with:
        assignees: "handles, of, my, teammates"    # GitHub handles without the @
        labels: ci
        pinned: false
        close-previous: false
        title: Test failure
        body: "...yo {{ assignees }}, some error messages related to the broken test..."
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### In action:

![Issue Bot Image](https://user-images.githubusercontent.com/2993937/102264733-0870ae00-3ee4-11eb-8b2c-282664b6e0bb.png)

#### More examples:

[GitHub search](https://github.com/search?q=%22uses%3A+imjohnbo%2Fissue-bot%22&type=code)

## Inputs and outputs

See [action.yml](action.yml)

## Environment variables

- `GITHUB_TOKEN` (required): the automatically generated [`${{ secrets.GITHUB_TOKEN }}`](https://docs.github.com/en/actions/reference/authentication-in-a-workflow) should be enough. However, because of the [limited permissions](https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token) of this token, if you need to add an issue to a _user_ or _organization_ project, you'll need a more permissive token like a [personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).

## Template variables

The issue body is treated as a [Handlebars](https://handlebarsjs.com) template, with support for template variables:

- `assignees`: The array of issue assignees.
- `previousIssueNumber`: The previous issue number in the series.

## Contributing

Feel free to open an issue, or better yet, a
[pull request](https://github.com/imjohnbo/issue-bot/compare)!

## License

[MIT](LICENSE)
