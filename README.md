# Weekly Radar

:star: Updated for [the latest version](https://github.blog/2019-08-08-github-actions-now-supports-ci-cd/) of [GitHub Actions](https://help.github.com/en/categories/automating-your-workflow-with-github-actions) :star: 

## Usage
This GitHub Action will find the first open issue with a `radar` label, close it, and link it to a newly created Weekly Radar template issue. If there is no open issue with a `radar` label, it will create one. Finally, it will assign the new issue to `assignees`.

```
name: Weekly Radar
on:
  schedule:
  - cron: 0 12 * * 1

jobs:
  weekly_radar:
    name: Close Old and Open New Weekly Radar
    runs-on: ubuntu-latest
    steps:

    - name: weekly-radar
      uses: imjohnbo/weekly-radar@master
      with:
        assignees: "some space delimited list of assignees"
        token: ${{ secrets.github_token }}
```

## Miscellaneous

* `schedule(*,*,*,*,*)` is just [one option](https://help.github.com/en/articles/events-that-trigger-workflows#scheduled-events) based on POSIX cron syntax. Knock yourself out by instead responding to [events](https://help.github.com/en/articles/events-that-trigger-workflows)!

## Inputs
* `assignees` is a space delimited list of assignees for the new issue.
* `token` is the automatically-generated GitHub token that is scoped for the repository whose workflow calls the action.

## Contributing
Feel free to open an issue, or better yet, a [pull request](https://github.com/imjohnbo/weekly-radar/compare)!

## License
[MIT](https://choosealicense.com/licenses/mit/)

