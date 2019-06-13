const { Toolkit } = require('actions-toolkit');
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

Toolkit.run(async tools => {
  const today = new Date();
  const assignees = process.env.ASSIGNEES.split(' ');
  
  // grab the current radar
  const currentRadar = await tools.github.graphql(getCurrentRadarStr);

  const currentRadarId = currentRadar.resource.issues.nodes[0].number;
  
  const dateString = today.getFullYear() + '-' + ('0' + (today.getMonth()+1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);

  const newRadar = await tools.github.issues.create({
    ...tools.context.repo,
    title: `Weekly Radar, week of ${dateString}`,
    body: updateNewRadarStr(currentRadarId),
    labels: ['radar'],
    assignees: assignees
  });
  
  const newRadarId = newRadar.data.number;

  // create comment on the old that points to the new
  const oldComment = await tools.github.issues.createComment({
    ...tools.context.repo,
    number: currentRadarId,
    body: updateCurrentRadarStr(newRadarId)
  });

  // close out the old
  const closedRadar = await tools.github.issues.update({
    ...tools.context.repo,
    number: currentRadarId,
    state: 'closed'
  });

});
