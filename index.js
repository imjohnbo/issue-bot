const date = require('datejs');
const core = require('@actions/core');
const github = require('@actions/github');
const yaml = require('js-yaml');

const token = process.env.GITHUB_TOKEN;
const octokit = new github.GitHub(token);
const repo = process.env.GITHUB_REPOSITORY;

// Is issue with issueId already pinned to this repo?
const isPinned = async issueId => {
  const query = `{
    resource(url: "${repo}") {
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
  const pinnedIssues = data.resource.pinnedIssues.nodes || [];
  return pinnedIssues.findIndex(pinnedIssue => pinnedIssue.issue.id === issueId) >= 0;
};

// Given a GraphQL issue id, unpin the issue
const unpin = async issueId => {
  core.debug(`Check if ${issueId} is already pinned...`);

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
const pin = issueId => {
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

// Return issue body, plus the metadata header if from a standard issue template
const getTemplateFromFile = async (templateFilePath) => {
  if (!templateFilePath) {
    return;
  }

  let template = '';
  let metadata = {};

  core.debug(`Getting contents of: ${templateFilePath}`);

  // Get contents of template file
  try {
    template = (await octokit.repos.getContents({
      ...github.context.repo,
      path: templateFilePath,
      mediaType: {
        format: 'raw'
      }
    })).data;
  } catch (error) {
    core.error(`Error encountered retrieving issue template: ${error}`);
  }

  core.debug(`template: ${template}`);

  // Does this issue template have a YAML header at the top
  const hasHeader = template.slice(0, 3) === '---';

  if (hasHeader) {
    // Get header, which is formatted as YAML key/values
    const header = yaml.safeLoad(template.split('---')[1].trim());

    core.debug(`header: ${header}`);

    metadata = {
      assignees: header.assignees || '',
      labels: header.labels || '',
      title: header.title || ''
    };
    // remove unnecessary YAML metadata found at the top of issue templates (https://help.github.com/en/github/building-a-strong-community/about-issue-and-pull-request-templates#issue-templates)
    template = template.split('---')[2].trim();
  }

  return {
    template: template || '',
    metadata: metadata || {}
  };
};

async function run () {
  try {
    const assignees = core.getInput('assignees');
    const title = `Notes ${Date.today().toString('M/dd/yy')}`;
    let body = core.getInput('body');
    const labels = Date.today().toString('M/yy');
    const pinned = core.getInput('pinned') === 'true';
    const closePrevious = core.getInput('close-previous') === 'true';
    const templateFile = core.getInput('template');
    const linkedComments = core.getInput('linked-comments') === 'true';
    let template = '';
    let metadata = {};

    if (templateFile) {
      ({ template, metadata } = await getTemplateFromFile(templateFile));
    }

    // Give precedence to assignees, labels, and title inputs; fall back to values from template file
    metadata.assignees = assignees || metadata.assignees || '';
    metadata.labels = labels || metadata.labels || '';
    metadata.title = title || metadata.title || '';
    body = body || template;

    core.debug(`metadata: ${JSON.stringify(metadata)}`);

    // Title is a required field, either from an input or a template
    if (!metadata.title) {
      throw Error('Title must be supplied in issue template or as an input.');
    }

    // Lables is a required field, either from an input or a template
    if (!metadata.labels) {
      throw Error('Labels must be supplied in issue template or as an input.');
    }

    // Format data for API call
    metadata.assignees = metadata.assignees.split(',').map(s => s.trim()); // 'user1, user2' --> ['user1', 'user2']
    metadata.labels = metadata.labels.split(',').map(s => s.trim()); // 'label1, label2' --> ['label1', 'label2']

    // GraphQL query to get latest matching open issue if it exists
    const latestIssueQuery = `{
      resource(url: "${repo}") {
        ... on Repository {
          issues(last:1, labels:${JSON.stringify(metadata.labels)}, states:[OPEN]) {
            nodes {
              number
              id
            }
          }
        }
      }
    }`;

    // Run the query, save the number (ex. 79) and GraphQL id (ex. MDU6SXMzbWU0ODAxNzI0NDA=)
    const {
      number: previousIssueNumber,
      id: previousIssueId
    } = (await octokit.graphql(latestIssueQuery)).resource.issues.nodes[0] || {};

    core.debug(`Previous issue number: ${previousIssueNumber}`);

    // Create a new issue
    const { data: { number: newIssueNumber } } = await octokit.issues.create({
      ...github.context.repo,
      title: metadata.title,
      labels: metadata.labels,
      assignees: metadata.assignees,
      body
    }) || {};

    core.debug(`New issue number: ${newIssueNumber}`);

    // Write comments linking the current and previous issue
    if (+previousIssueNumber >= 0 && linkedComments) {
      // Create comment on the new that points to the previous
      await octokit.issues.createComment({
        ...github.context.repo,
        issue_number: newIssueNumber,
        body: `Previously: #${previousIssueNumber}`
      });

      // Create comment on the previous that points to the new
      await octokit.issues.createComment({
        ...github.context.repo,
        issue_number: previousIssueNumber,
        body: `Next: #${newIssueNumber}`
      });
    }

    const repositoryByNumberQuery = `{
      resource(url: "${repo}") {
        ... on Repository {
          issue(number: ${newIssueNumber}){
            id
          }
        }
      }
    }`;

    // Query to get the GraphQL id (ex. MDX6SXMzbWU0ODAxNzI0NDA=) of the new issue that we have the number of
    const { id: newRadarId } = (await octokit.graphql(
      repositoryByNumberQuery
    )).resource.issue || {};

    // If there is a previous issue, close it out and point to the new
    if (+previousIssueNumber >= 0 && closePrevious) {
      core.debug(`Closing issue number ${previousIssueNumber}...`);

      // Close out the previous
      await octokit.issues.update({
        ...github.context.repo,
        issue_number: previousIssueNumber,
        state: 'closed'
      });

      // If the pinned input is true, pin the current, unpin the previous
      if (pinned) {
        await unpin(previousIssueId);
        await pin(newRadarId);
      }
    }

    if (newIssueNumber) {
      core.setOutput('issue-number', String(newIssueNumber));
    }
  } catch (error) {
    core.setFailed(`Error encountered: ${error}.`);
  }
}

run();
