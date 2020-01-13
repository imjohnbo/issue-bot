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

async function run() {
  try {
    const assignees = core.getInput('assignees').split(' ');
    const label = core.getInput('label');
    const pinned = core.getInput('pinned') === 'true';
  
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

    let template = 
`:wave: Hi there!
    
### What are you focusing on this week?`;
  
template += currentRadarNumber

? `

Previously: #${currentRadarNumber}`

: ``;
  
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

    core.setOutput('issue_id', newRadarId);
  }
  catch(error) {
    core.error(`Error encountered: ${error}.`);
  }
  
}

run();
