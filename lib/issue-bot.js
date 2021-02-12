const core = require('@actions/core');
const { context, getOctokit } = require('@actions/github');
const handlebars = require('handlebars');

const token = process.env.GITHUB_TOKEN;
const octokit = getOctokit(token);

const needPreviousIssue = (...conditions) => {
  return conditions.includes(true);
};

const issueExists = (previousIssueNumber) => {
  return previousIssueNumber >= 0;
};

const checkInputs = (inputs) => {
  core.debug(`Checking inputs: ${JSON.stringify(inputs)}`);

  let ok = true;

  ok = !!inputs.title;

  if (inputs.pinned) {
    ok = !!inputs.labels;
  }
  if (inputs.closePrevious) {
    ok = !!inputs.labels;
  }
  if (inputs.linkedComments) {
    ok = !!inputs.labels;
  }
  if (inputs.rotateAssignees) {
    ok = !!(inputs.labels && inputs.assignees);
  }

  return ok;
};

const getNextAssignee = (assignees, previousAssignee) => {
  core.debug(`Getting next assignee from ${JSON.stringify(assignees)} with previous assignee ${previousAssignee}}`);

  const index = (assignees.indexOf(previousAssignee) + 1) % assignees.length;

  core.debug(`Next assignee: ${assignees[index]}`);

  return [assignees[index]];
};

// Is issue with issueId already pinned to this repo?
const isPinned = async (issueId) => {
  core.debug(`Checking if issue ${issueId} is pinned.`);

  const query = `{
    resource(url: "${context.repo}") {
      ... on Repository {
        pinnedIssues(last: 3) {
          nodes {
            issue {
              id
            }
          }
        }
      }
    }
  }`;
  const data = await octokit.graphql({
    query,
    headers: {
      accept: 'application/vnd.github.elektra-preview+json'
    }
  });

  if (!data.resource) {
    return false;
  }
  
  const pinnedIssues = data.resource.pinnedIssues.nodes || [];
  return pinnedIssues.findIndex(pinnedIssue => pinnedIssue.issue.id === issueId) >= 0;
};

// Given a GraphQL issue id, unpin the issue
const unpin = async (issueId) => {
  if (!(await isPinned(issueId))) {
    return;
  }

  core.debug(`Unpinning ${issueId}...`);

  const mutation = `mutation {
    unpinIssue(input: {issueId: "${issueId}"}) {
      issue {
        body
      }
    }
  }`;

  return octokit.graphql({
    query: mutation,
    headers: {
      accept: 'application/vnd.github.elektra-preview+json'
    }
  });
};

// Given a GraphQL issue id, pin the issue
const pin = async (issueId) => {
  core.debug(`Pinning ${issueId}...`);

  const mutation = `mutation {
    pinIssue(input: {issueId: "${issueId}"}) {
        issue {
          body
        }
      }
    }`;
  return octokit.graphql({
    query: mutation,
    headers: {
      accept: 'application/vnd.github.elektra-preview+json'
    }
  });
};

const createNewIssue = async (options) => {
  core.debug(`Creating new issue with options: ${JSON.stringify(options)} and body: ${options.body}`);

  const { data: { number: newIssueNumber, id: newIssueId, node_id: newIssueNodeId } } = (await octokit.issues.create({
    ...context.repo,
    title: options.title,
    labels: options.labels,
    assignees: options.assignees,
    body: options.body
  })) || {};

  core.debug(`New issue number: ${newIssueNumber}`);
  core.debug(`New issue id: ${newIssueId}`);
  core.debug(`New issue node ID: ${newIssueNodeId}`);

  return {
    newIssueNumber: Number(newIssueNumber),
    newIssueId,
    newIssueNodeId
  };
};

const closeIssue = async (issueNumber) => {
  core.debug(`Closing issue number ${issueNumber}...`);

  return await octokit.issues.update({
    ...context.repo,
    issue_number: issueNumber,
    state: 'closed'
  });
};

const makeLinkedComments = async (newIssueNumber, previousIssueNumber) => {
  core.debug(`Making linked comments on new issue number ${newIssueNumber} and previous issue number ${previousIssueNumber}`);

  // Create comment on the new that points to the previous
  await octokit.issues.createComment({
    ...context.repo,
    issue_number: newIssueNumber,
    body: `Previous in series: #${previousIssueNumber}`
  });

  // Create comment on the previous that points to the new
  await octokit.issues.createComment({
    ...context.repo,
    issue_number: previousIssueNumber,
    body: `Next in series: #${newIssueNumber}`
  });
};

// Return previous issue matching both labels
// @input labels: ['label1', 'label2']
const getPreviousIssue = async (labels) => {
  core.debug(`Finding previous issue with labels: ${JSON.stringify(labels)}...`);

  const data = (await octokit.issues.listForRepo({
    ...context.repo,
    labels
  })).data[0];

  const previousIssueNumber = data.number;
  const previousIssueNodeId = data.node_id;
  const previousAssignees = data.assignees;

  core.debug(`Previous issue number: ${previousIssueNumber}`);

  return {
    previousIssueNumber: previousIssueNumber ? Number(previousIssueNumber) : undefined,
    previousIssueNodeId,
    previousAssignees
  };
};

const addIssueToProjectColumn = async (issueId, projectId, columnName) => {
  core.debug(`Adding issue id ${issueId} to project id ${projectId}, column name ${columnName}`);

  const { data: columns } = await octokit.projects.listColumns({
    project_id: projectId
  });

  const column = columns.find(column => column.name === columnName);

  if (!column) {
    throw new Error(`Column with name ${columnName} could not be found in repository project with id ${projectId}.`);
  }

  core.debug(`Column name ${columnName} maps to column id ${column.id}`);

  await octokit.projects.createCard({
    column_id: column.id,
    content_id: issueId,
    content_type: 'Issue'
  });
};

const addIssueToMilestone = async (issueNumber, milestoneNumber) => {
  await octokit.issues.update({
    ...context.repo,
    issue_number: issueNumber,
    milestone: milestoneNumber
  });
};

/**
 * Takes provided inputs, acts on them, and produces a single output.
 * See action.yml for input descriptions.
 * @param {object} inputs
 */
const run = async (inputs) => {
  try {
    core.debug(`Running with inputs: ${JSON.stringify(inputs)}`);

    let previousAssignee; let previousIssueNumber = -1; let previousIssueNodeId; let previousAssignees;

    if (needPreviousIssue(inputs.pinned, inputs.closePrevious, inputs.rotateAssignees, inputs.linkedComments)) {
      ({ previousIssueNumber, previousIssueNodeId, previousAssignees } = await getPreviousIssue(inputs.labels));
    }

    if (issueExists(previousIssueNumber)) {
      previousAssignee = previousAssignees.length ? previousAssignees[0].login : undefined;
    }

    // Rotate assignee to next in list
    if (inputs.rotateAssignees) {
      inputs.assignees = getNextAssignee(inputs.assignees, previousAssignee);
    }

    inputs.body = handlebars.compile(inputs.body)({ previousIssueNumber, assignees: inputs.assignees });
    const { newIssueNumber, newIssueId, newIssueNodeId } = await createNewIssue(inputs);

    if (inputs.project && inputs.column) {
      await addIssueToProjectColumn(newIssueId, inputs.project, inputs.column);
    }

    if (inputs.milestone) {
      await addIssueToMilestone(newIssueNumber, inputs.milestone);
    }

    // Write comments linking the current and previous issue
    if (issueExists(previousIssueNumber) && inputs.linkedComments) {
      await makeLinkedComments(newIssueNumber, previousIssueNumber);
    }

    // If there is a previous issue, close it out and point to the new
    if (issueExists(previousIssueNumber) && inputs.closePrevious) {
      await closeIssue(previousIssueNumber);

      // If the pinned input is true, pin the current, unpin the previous
      if (inputs.pinned) {
        await unpin(previousIssueNodeId);
        await pin(newIssueNodeId);
      }
    }

    if (newIssueNumber) {
      core.debug(`New issue number: ${newIssueNumber}`);
      core.setOutput('issue-number', String(newIssueNumber));
    }
  } catch (error) {
    core.setFailed(`Error encountered: ${error}.`);
  }
};

exports.needPreviousIssue = needPreviousIssue;
exports.issueExists = issueExists;
exports.checkInputs = checkInputs;
exports.getNextAssignee = getNextAssignee;
exports.isPinned = isPinned;
exports.unpin = unpin;
exports.pin = pin;
exports.createNewIssue = createNewIssue;
exports.closeIssue = closeIssue;
exports.makeLinkedComments = makeLinkedComments;
exports.getPreviousIssue = getPreviousIssue;
exports.addIssueToProjectColumn = addIssueToProjectColumn;
exports.addIssueToMilestone = addIssueToMilestone;
exports.run = run;
