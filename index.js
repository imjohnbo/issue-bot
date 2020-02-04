const core = require('@actions/core');
const github = require('@actions/github');

const token = process.env.GITHUB_TOKEN;
const octokit = new github.GitHub(token);
const repo = process.env.GITHUB_REPOSITORY;

// Given a GraphQL issue id, unpin the issue
const unpin = issueId => {
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
      accept: `application/vnd.github.elektra-preview+json`,
    },
  });
};

// Given a GraphQL issue id, pin the issue
const pin = issueId => {
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
      accept: `application/vnd.github.elektra-preview+json`,
    },
  });
};

const getTemplate = async (currentRadarNumber, templateFile) => {
  let defaultTemplate = 
`:wave: Hi there!
    
### What are you focusing on this week?`;
  
defaultTemplate += currentRadarNumber

? `

Previously: #${currentRadarNumber}`

: ``;
  let templateFromFile = '';

  if (templateFile) {
    const path = `.github/ISSUE_TEMPLATE/${templateFile}`;
  
    try {
      templateFromFile = (await octokit.repos.getContents({
        ...github.context.repo,
        path,
        mediaType: {
          format: "raw"
        }
      })).data;
    }
    catch(error) {
      core.error('Error encountered retrieving issue template: error');
      core.warning('Proceeding with creating default template...');

      return defaultTemplate;
    }
  
    // remove unnecessary YAML metadata found at the top of issue templates (https://help.github.com/en/github/building-a-strong-community/about-issue-and-pull-request-templates#issue-templates)
    const hasYamlFrontMatter = templateFromFile.slice(0,3) === '---';

    if (hasYamlFrontMatter) {
      templateFromFile = templateFromFile.split('---')[2].trim();
    }
  }

  return templateFromFile ? templateFromFile : defaultTemplate;
};

async function run() {
  try {
    const assignees = core.getInput('assignees').split(' '); // 'user1 user2' --> ['user1', 'user2']
    const label = core.getInput('label');
    const pinned = core.getInput('pinned') === 'true';
    const templateFile = core.getInput('template');
  
    // Form date long to short, ex. 2019-10-21
    const today =
      (new Date()).getFullYear() +
      '-' +
      ('0' + ((new Date()).getMonth() + 1)).slice(-2) +
      '-' +
      ('0' + (new Date()).getDate()).slice(-2);
  
    // GraphQL query to get latest open weekly radar issue if it exists
    const latestRadarQuery = `{
      resource(url: "${repo}") {
        ... on Repository {
          issues(first:1, labels:["${label}"], states:[OPEN]) {
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
      number: currentRadarNumber,
      id: currentRadarId,
    } = (await octokit.graphql(latestRadarQuery)).resource.issues.nodes[0] || {};
  
    core.debug(`Current radar issue number: ${currentRadarNumber}`);

    core.debug(`Getting template from ${templateFile}`);

    const template = await getTemplate(currentRadarNumber, templateFile);

    core.debug(`template: ${template}`);
  
    // Create a new radar
    const { data: { number: newRadarNumber } } = await octokit.issues.create({
      ...github.context.repo,
      title: `Weekly Radar, week of ${today}`,
      body: template,
      labels: [label],
      assignees: assignees,
    }) || {};

    core.debug(`New radar issue number: ${newRadarNumber}`);

    const repositoryByNumberQuery = `{
      resource(url: "${repo}") {
        ... on Repository {
          issue(number: ${newRadarNumber}){
            id
          }
        }
      }
    }`;
  
    // Query to get the GraphQL id (ex. MDX6SXMzbWU0ODAxNzI0NDA=) of the new issue that we have the number of
    const { id: newRadarId } = (await octokit.graphql(
      repositoryByNumberQuery,
    )).resource.issue || {};
  
    // If there is a current weekly radar, close it out and point to the new
    if (currentRadarNumber) {
      // Create comment on the current that points to the new
      await octokit.issues.createComment({
        ...github.context.repo,
        issue_number: currentRadarNumber,
        body: `Next: #${newRadarNumber}`,
      });
  
      // Close out the current
      await octokit.issues.update({
        ...github.context.repo,
        issue_number: currentRadarNumber,
        state: 'closed',
      });
  
      // If the pinned input is true, unpin the current
      if (pinned) {
        try {
          core.debug(`Unpinning ${currentRadarId}...`);
          await unpin(currentRadarId);
        }
        catch(error) {
          core.debug(`Pinning ${newRadarId}...`);
          await pin(newRadarId);
        }
      }
    }
  
    // If the pinned input is true, pin the new
    if (pinned) {
      core.debug(`newRadarId: ${newRadarId}`);
      await pin(newRadarId);
    }

    core.setOutput('issue_number', newRadarNumber);
  }
  catch(error) {
    core.error(`Error encountered: ${error}.`);
  }
  
}

run();
