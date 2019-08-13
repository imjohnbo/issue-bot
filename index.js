const core = require('@actions/core');
const github = require('@actions/github');
const assigneesStr = core.getInput('assignees');
const labelStr = core.getInput('label');
// This should be a token with access to your repository scoped in as a secret.
const githubToken = process.env.GITHUB_TOKEN;
const octokit = new github.GitHub(githubToken);
const repo = process.env.GITHUB_REPOSITORY;
const getCurrentRadarStr = `{
  resource(url: "${repo}") {
    ... on Repository {
      issues(first:1, labels:["${labelStr}"], states:[OPEN]) {
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
const createNewRadarStr = (prev) => {
  let str = `:wave: Hi there!

  ### What are you focusing on this week?`;

  str += !!prev ? `
  
  Previously: #${prev}` : ``;
  
  return str;
};

async function exec() {
  const today = new Date();
  const assignees = assigneesStr.split(' ');
  const currentRadar = (await octokit.graphql(getCurrentRadarStr)).resource.issues.nodes[0];
  const currentRadarId = !!currentRadar ? currentRadar.number : undefined;
  const dateString = today.getFullYear() + '-' + ('0' + (today.getMonth()+1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);

  // create new radar
  const newRadar = await octokit.issues.create({
    ...github.context.repo,
    title: `Weekly Radar, week of ${dateString}`,
    body: createNewRadarStr(currentRadarId),
    labels: [labelStr],
    assignees: assignees
  });
  
  const newRadarId = newRadar.data.number;

  if (!!currentRadarId) {
    // create comment on the old that points to the new
    await octokit.issues.createComment({
      ...github.context.repo,
      issue_number: currentRadarId,
      body: updateCurrentRadarStr(newRadarId)
    });
  
    // close out the old
    await octokit.issues.update({
      ...github.context.repo,
      issue_number: currentRadarId,
      state: 'closed'
    });
  }

}

exec();
