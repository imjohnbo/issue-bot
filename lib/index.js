import { run, checkInputs } from './issue-bot';
const core = require('@actions/core');

// 'string,  string2, string3' => ['string1', 'string2', 'string3']
const listToArray = (list, delimiter = ',') => {
  return list.split(delimiter).map(a => a.trim());
};

try {
  const inputs = {
    title: core.getInput('title'),
    body: core.getInput('body'),
    labels: core.getInput('labels'),
    assignees: core.getInput('assignees'),
    project: core.getInput('project'),
    column: core.getInput('column'),
    milestone: core.getInput('milestone'),
    pinned: core.getInput('pinned') === 'true',
    closePrevious: core.getInput('close-previous') === 'true',
    rotateAssignees: core.getInput('rotate-assignees') === 'true',
    linkedComments: core.getInput('linked-comments') === 'true'
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

  run(inputs);

} catch (error) {
  core.setFailed(error);
}
