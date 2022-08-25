import { run, checkInputs } from './issue-bot';
const core = require('@actions/core');

// 'string,  string2, string3' => ['string1', 'string2', 'string3']
const listToArray = (list, delimiter = ',') => {
  return list.split(delimiter).map(a => a.trim());
};

try {
  const inputs = {
    token: core.getInput('token'),
    title: core.getInput('title'),
    body: core.getInput('body'),
    labels: core.getInput('labels'),
    assignees: core.getInput('assignees'),
    projectType: core.getInput('project-type'),
    project: core.getInput('project'),
    projectV2: core.getInput('project-v2-path'),
    column: core.getInput('column'),
    milestone: core.getInput('milestone'),
    pinned: core.getInput('pinned') === 'true',
    closePrevious: core.getInput('close-previous') === 'true',
    rotateAssignees: core.getInput('rotate-assignees') === 'true',
    linkedComments: core.getInput('linked-comments') === 'true',
    linkedCommentsNewIssueText: core.getInput('linked-comments-new-issue-text'),
    linkedCommentsPreviousIssueText: core.getInput('linked-comments-previous-issue-text')
  };

  const inputsValid = checkInputs(inputs);

  if (!inputsValid) {
    throw new Error('Invalid inputs');
  }

  if (inputs.labels) {
    inputs.labels = listToArray(inputs.labels);
  }

  if (inputs.assignees) {
    inputs.assignees = listToArray(inputs.assignees);
  }

  // default type of project board is repository board
  // https://docs.github.com/en/github/managing-your-work-on-github/about-project-boards
  if (!inputs.projectType) {
    inputs.projectType = 'repository';
  }

  run(inputs);
} catch (error) {
  core.setFailed(error);
}
