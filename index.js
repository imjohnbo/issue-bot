const core = require('@actions/core');
const github = require('@actions/github');
// This should be a token with access to your repository scoped in as a secret.
const githubToken = core.getInput('token'); 
const octokit = new github.GitHub(githubToken);
const repo = process.env.GITHUB_REPOSITORY;
const getCurrentRadarStr = `{
  resource(url: "${repo}") {
    ... on Repository {
      issues(first:1, labels:["radar"], states:[OPEN]) {
        nodes {
          number
        }
      }
    }
  }
}`;
const updateCurrentRadarStr = (next) => {
  return `Next: #${next}`;
};
const updateNewRadarStr = (prev) => {
  let str = `:wave: Hi there!

  ### What are you focusing on this week?`;

  str += prev ? `
  
  Previously: #${prev}` : ``;
  
  return str;
};

async function exec() {
  const today = new Date();
  const assigneesStr = core.getInput('assignees');
  const assignees = assigneesStr.split(' ');
  
  // grab the current radar
  const currentRadar = await octokit.graphql(getCurrentRadarStr);

  const currentRadarId = currentRadar.resource.issues.nodes[0].number;
  
  const dateString = today.getFullYear() + '-' + ('0' + (today.getMonth()+1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);

  const newRadar = await octokit.issues.create({
    ...github.context.repo,
    title: `Weekly Radar, week of ${dateString}`,
    body: updateNewRadarStr(currentRadarId),
    labels: ['radar'],
    assignees: assignees
  });
  
  const newRadarId = newRadar.data.number;

  // create comment on the old that points to the new
  const oldComment = await octokit.issues.createComment({
    ...github.context.repo,
    issue_number: currentRadarId,
    body: updateCurrentRadarStr(newRadarId)
  });

  // close out the old
  const closedRadar = await octokit.issues.update({
    ...github.context.repo,
    issue_number: currentRadarId,
    state: 'closed'
  });

}

exec();
