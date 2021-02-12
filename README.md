# Issue Bot

## About

Work on a distributed team? Try using Issue Bot as a Scrum [standup](https://en.wikipedia.org/wiki/Stand-up_meeting) process automation bot to keep track of what you're all working on. 🤖

Have repeated tasks you're setting reminders for elsewhere? Issue Bot's got your back there, too. 👏

Or just need an issue created on a certain condition? Issue Bot is there when your CI build breaks. 💔

Issue Bot is a flexible GitHub Action that will open a new issue based on `input` values issue template of your choice. You can make it close the most recent one of its type, you can pin it, and since it's open source, [pull requests](https://github.com/imjohnbo/issue-bot/compare) are welcome!

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

    - name: issue-bot
      uses: imjohnbo/issue-bot@v3
      with:
        # GitHub handles without the @
        assignees: "octocat, monalisa"
        labels: "standup"
        pinned: true
        close-previous: true
        title: Standup
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### To keep track of repeated tasks:

See more info: https://github.com/imjohnbo/extract-issue-template-fields.

```yml
name: Generate TPS reports from template
on:
  schedule:
  - cron: 0 0 1 * *  # First of every month – https://crontab.guru

jobs:
  tps_reports:
    name: TPS reports
    runs-on: ubuntu-latest
    steps:

    # Repo code checkout required if `template` is used
    - name: Checkout
      uses: actions/checkout@v2

    - uses: imjohnbo/extract-issue-template-fields@v0.0.1
      id: extract
      with:
        path: .github/ISSUE_TEMPLATE/tps.md
      env: 
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: issue-bot
      uses: imjohnbo/issue-bot@v3
      with:
        pinned: true
        close-previous: true
        assignees: ${{ steps.extract.outputs.assignees }}
        labels: ${{ steps.extract.outputs.labels }}
        title: ${{ steps.extract.outputs.title }}
        body: ${{ steps.extract.outputs.body }}
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Or just downstream of a failed CI step 💔:

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
        label: "ci"
        pinned: false
        close-previous: false
        body: "...yo {{ assignees }}, some error messages related to the broken test..."
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### In action:

![Issue Bot Image](https://user-images.githubusercontent.com/2993937/102264733-0870ae00-3ee4-11eb-8b2c-282664b6e0bb.png)

#### More examples:

[GitHub search](https://github.com/search?q=%22uses%3A+imjohnbo%2Fissue-bot%22&type=code)

## Inputs and outputs

See [action.yml](action.yml).

## Environment variables

- `GITHUB_TOKEN` (required): should be assigned the
  [automatically-generated GitHub token](https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables)
  that is scoped for the repository whose workflow calls the Action.

## Template variables

The issue body is treated as a [Handlebars](https://handlebarsjs.com) template, with support for template variables:

- `assignees`: The array of issue assignees.
- `previousIssueNumber`: The previous issue number in the series.

## Contributing

Feel free to open an issue, or better yet, a
[pull request](https://github.com/imjohnbo/issue-bot/compare)!

## License

[MIT](LICENSE)
