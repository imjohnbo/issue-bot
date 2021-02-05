import { run, checkInputs } from './issue-bot';
const core = require('@actions/core');

const listToArray = (list, delimiter = ',') => {
  return list.split(delimiter).map(a => a.trim());
};

if (require.main === module) {
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

    if (inputsValid) {
      inputs.labels = listToArray(inputs.labels);
      inputs.assignees = listToArray(inputs.assignees);
      run(inputs);
    } else {
      throw new Error('Invalid inputs');
    }
  } catch (error) {
    core.setFailed(error);
  }
}
