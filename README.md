# Weekly Radar

:star: Updated for [the latest version](https://github.blog/2019-08-08-github-actions-now-supports-ci-cd/) of [GitHub Actions](https://help.github.com/en/categories/automating-your-workflow-with-github-actions) :star: 

## Usage
Use this GitHub Action in your team's repository to stay in touch about your plans for the week. Weekly Radar will find the first open issue with `label`, close it, and link it to a newly created Weekly Radar template issue. If there is no open issue with `label`, it will create one. Finally, it will assign the new issue to `assignees`.

**Example workflow**:
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
        label: "my-custom-label"
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Miscellaneous

* `schedule(*,*,*,*,*)` is just [one option](https://help.github.com/en/articles/events-that-trigger-workflows#scheduled-events) based on POSIX cron syntax. Knock yourself out by instead responding to [events](https://help.github.com/en/articles/events-that-trigger-workflows)!

## Inputs
* `assignees` (optional) is a space delimited list of assignees for the Weekly Radar.
* `label` (optional) is the label to be attached to the Weekly Radar.

## Environment variables 
* GITHUB_TOKEN is assigned the [automatically-generated GitHub token](https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables) that is scoped for the repository whose workflow calls the Action.

## Contributing
Feel free to open an issue, or better yet, a [pull request](https://github.com/imjohnbo/weekly-radar/compare)!

## License
[MIT](https://choosealicense.com/licenses/mit/)

