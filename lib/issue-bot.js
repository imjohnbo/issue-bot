const core = require('@actions/core');
const { context, getOctokit } = require('@actions/github');
const handlebars = require('handlebars');
let octokit;

// {key1: '', key2: 'some string', key3: undefined} => {key2: 'some string'}
const removeEmptyProps = (obj) => {
  for (const key in obj) {
    if (obj[key] === '' || typeof obj[key] === 'undefined') {
      delete obj[key];
    }
  }
  return obj;
};

const needPreviousIssue = (...conditions) => {
  return conditions.includes(true);
};

const issueExists = (previousIssueNumber) => {
  return previousIssueNumber >= 0;
};

const checkInputs = (inputs) => {
  core.info(`Checking inputs: ${JSON.stringify(inputs)}`);

  let ok = true;

  ok = !!inputs.title;

  if (inputs.projectType) {
    ok = ok && (inputs.projectType === 'user' ||
      inputs.projectType === 'organization' ||
      inputs.projectType === 'repository');
  }
  if (inputs.pinned) {
    ok = ok && !!inputs.labels;
  }
  if (inputs.closePrevious) {
    ok = ok && !!inputs.labels;
  }
  if (inputs.linkedComments) {
    ok = ok && !!inputs.labels;
  }
  if (inputs.rotateAssignees) {
    ok = ok && !!(inputs.labels && inputs.assignees);
  }

  return ok;
};

const getNextAssignee = (assignees, previousAssignee) => {
  core.info(`Getting next assignee from ${JSON.stringify(assignees)} with previous assignee ${previousAssignee}}`);

  const index = (assignees.indexOf(previousAssignee) + 1) % assignees.length;

  core.info(`Next assignee: ${assignees[index]}`);

  return [assignees[index]];
};

// Is issue with issueId already pinned to this repo?
const isPinned = async (issueId) => {
  core.info(`Checking if issue ${issueId} is pinned.`);

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

  core.debug(`isPinned data: ${JSON.stringify(data)}`);

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

  core.info(`Unpinning ${issueId}...`);

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
  core.info(`Pinning ${issueId}...`);

  const mutation = `mutation {
    pinIssue(input: {issueId: "${issueId}"}) {
        issue {
          body
        }
      }
    }`;
  // TODO check if 3 issues are already pinned
  return octokit.graphql({
    query: mutation,
    headers: {
      accept: 'application/vnd.github.elektra-preview+json'
    }
  });
};

const createNewIssue = async (options) => {
  // Remove empty props in order to make valid API calls
  options = removeEmptyProps(Object.assign({}, options));

  core.info(`Creating new issue with options: ${JSON.stringify(options)} and body: ${options.body}`);

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
  core.info(`Closing issue number ${issueNumber}...`);

  return await octokit.issues.update({
    ...context.repo,
    issue_number: issueNumber,
    state: 'closed'
  });
};

const makeLinkedComments = async (newIssueNumber, previousIssueNumber) => {
  core.info(`Making linked comments on new issue number ${newIssueNumber} and previous issue number ${previousIssueNumber}`);

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
  core.info(`Finding previous issue with labels: ${JSON.stringify(labels)}...`);

  let previousIssueNumber; let previousIssueNodeId; let previousAssignees = '';

  const data = (await octokit.issues.listForRepo({
    ...context.repo,
    labels
  })).data[0];

  if (data) {
    previousIssueNumber = data.number;
    previousIssueNodeId = data.node_id;
    previousAssignees = data.assignees;
  } else {
    throw new Error(`Couldn't find previous issue with labels: ${JSON.stringify(labels)}.`);
  }

  core.debug(`Previous issue number: ${previousIssueNumber}`);
  core.debug(`Previous issue node id: ${previousIssueNodeId}`);
  core.debug(`Previous issue assignees: ${previousAssignees}`);

  return {
    previousIssueNumber: previousIssueNumber ? Number(previousIssueNumber) : undefined,
    previousIssueNodeId,
    previousAssignees
  };
};

const addIssueToProjectColumn = async (options) => {
  core.info(`Adding issue id ${options.issueId} to project type ${options.projectType}, project number ${options.projectNumber}, column name ${options.columnName}`);
  const projects = [];

  if (options.projectType === 'user') {
    for await (const response of octokit.paginate.iterator(
      octokit.projects.listForUser,
      {
        username: context.repo.owner
      }
    )) {
      projects.push(...response.data);
    }
  } else if (options.projectType === 'organization') {
    for await (const response of octokit.paginate.iterator(
      octokit.projects.listForOrg,
      {
        org: context.repo.owner
      }
    )) {
      projects.push(...response.data);
    }
  } else if (options.projectType === 'repository') {
    for await (const response of octokit.paginate.iterator(
      octokit.projects.listForRepo,
      {
        ...context.repo
      }
    )) {
      projects.push(...response.data);
    }
  }

  core.debug(`Found projects: ${JSON.stringify(projects)}`);

  const project = projects.find(project => project.number === Number(options.projectNumber));

  if (!project) {
    throw new Error(`Project with type ${options.projectType}, number ${options.projectNumber} could not be found.`);
  }

  const { data: columns } = await octokit.projects.listColumns({
    project_id: project.id
  });

  core.debug(`Found columns for project id ${project.id}: ${JSON.stringify(columns)}`);

  const column = columns.find(column => column.name === options.columnName);

  core.debug(`Found column matching column name ${options.columnName}: ${JSON.stringify(column)}`);

  if (!column) {
    throw new Error(`Column with name ${options.columnName} could not be found in project with type ${options.projectType}, id ${options.projectNumber}.`);
  }

  core.debug(`Column name ${options.columnName} maps to column id ${column.id}`);

  await octokit.projects.createCard({
    column_id: column.id,
    content_id: options.issueId,
    content_type: 'Issue'
  });
};

const addIssueToMilestone = async (issueNumber, milestoneNumber) => {
  core.info(`Adding issue number ${issueNumber} to milestone number ${milestoneNumber}`);

  const { data: issue } = await octokit.issues.update({
    ...context.repo,
    issue_number: issueNumber,
    milestone: milestoneNumber
  });

  if (!issue) {
    throw new Error(`Couldn't add issue ${issueNumber} to milestone ${milestoneNumber}.`);
  }
};

/**
 * Takes provided inputs, acts on them, and produces a single output.
 * See action.yml for input descriptions.
 * @param {object} inputs
 */
const run = async (inputs) => {
  try {
    octokit = getOctokit(inputs.token);
    delete inputs.token;

    core.info(`Running with inputs: ${JSON.stringify(inputs)}`);

    let previousAssignee; let previousIssueNumber = -1; let previousIssueNodeId; let previousAssignees;

    if (needPreviousIssue(inputs.pinned, inputs.closePrevious, inputs.rotateAssignees, inputs.linkedComments)) {
      ({ previousIssueNumber, previousIssueNodeId, previousAssignees } = await getPreviousIssue(inputs.labels));
    }

    // Rotate assignee to next in list
    if (issueExists(previousIssueNumber) && inputs.rotateAssignees) {
      previousAssignee = previousAssignees.length ? previousAssignees[0].login : undefined;
      inputs.assignees = getNextAssignee(inputs.assignees, previousAssignee);
    }

    inputs.body = handlebars.compile(inputs.body)({ previousIssueNumber, assignees: inputs.assignees });
    const { newIssueNumber, newIssueId, newIssueNodeId } = await createNewIssue(inputs);

    if (inputs.project && inputs.column) {
      await addIssueToProjectColumn({
        issueId: newIssueId,
        projectType: inputs.projectType,
        projectNumber: inputs.project,
        columnName: inputs.column
      });
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
      core.info(`New issue number: ${newIssueNumber}`);
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
