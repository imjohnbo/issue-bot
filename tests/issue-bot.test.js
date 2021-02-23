const issueBot = require('../lib/issue-bot');
const nock = require('nock');
const core = require('@actions/core');
const { getOctokit, context } = require('@actions/github');
const handlebars = require('handlebars');

// jest.mock('handlebars', () => ({
//     compile: () => {
//         return () => {}
//     }
// }));
// jest.mock('@actions/core');

core.debug = jest.fn(console.log);
core.setFailed = jest.fn(console.log);

describe('issueBot', () => {

    test('checkInputs: pass if only title', () => {
        const ok = issueBot.checkInputs({
            title: 'Title'
        })
        expect(ok).toBe(true);
    });

    test('checkInputs: fail if no title', () => {
        const ok = issueBot.checkInputs({
            title: ''
        })
        expect(ok).toBe(false);
    });

    test('checkInputs: pass if pinned and labels', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            pinned: true,
            labels: 'label1, label2'
        })
        expect(ok).toBe(true);
    });

    test('checkInputs: fail if pinned and no labels', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            pinned: true
        })
        expect(ok).toBe(false);
    });

    test('checkInputs: pass if closePrevious and labels', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            closePrevious: true,
            labels: 'label1, label2'
        })
        expect(ok).toBe(true);
    });

    test('checkInputs: fail if closePrevious and no labels', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            closePrevious: true
        })
        expect(ok).toBe(false);
    });

    test('checkInputs: pass if linkedComments and labels', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            linkedComments: true,
            labels: 'label1, label2'
        })
        expect(ok).toBe(true);
    });

    test('checkInputs: fail if linkedComments and no labels', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            linkedComments: true
        })
        expect(ok).toBe(false);
    });

    test('checkInputs: pass if rotateAssignees, labels, and assignees', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            rotateAssignees: true,
            assignees: 'person1, person2',
            labels: 'label1, label2'
        })
        expect(ok).toBe(true);
    });

    test('checkInputs: fail if rotateAssignees and no labels', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            rotateAssignees: true,
            assignees: 'person1, person2'
        })
        expect(ok).toBe(false);
    });

    test('checkInputs: fail if rotateAssignees and no assignees', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            rotateAssignees: true,
            labels: 'label1, label2'
        })
        expect(ok).toBe(false);
    });

    test('checkInputs: fail if projectType doesnt match user, organization, or repository', () => {
        const ok = issueBot.checkInputs({
            title: 'Title',
            projectType: 'nonsense'
        })
        expect(ok).toBe(false);
    });

    test('getNextAssignee: defaults to empty assignee', () => {
        const next = issueBot.getNextAssignee([''], '')
        expect(next).toEqual(['']);
    });

    test('getNextAssignee: works with one assignee', () => {
        const next = issueBot.getNextAssignee(['person1'], 'person1')
        expect(next).toEqual(['person1']);
    });

    test('getNextAssignee: works with two assignees', () => {
        const next = issueBot.getNextAssignee(['person1', 'person2'], 'person1')
        expect(next).toEqual(['person2']);
    });

    test('getNextAssignee: works "around the corner"', () => {
        const next = issueBot.getNextAssignee(['person1', 'person2', 'person3'], 'person3')
        expect(next).toEqual(['person1']);
    });

    // test('isPinned: something', async () => {
    //     const pin = nock('https://api.github.com')
    //         .post('/graphql', () => true)
    //         .reply(200, { data: {
    //                 resource: {
    //                     pinnedIssues: {
    //                         nodes: [{
    //                             issue: {
    //                                 id: 0
    //                             }
    //                         }]
    //                     }
    //                 }
    //             } 
    //         })

    //     const pinned = await issueBot.isPinned(1);
    //     expect(1).toEqual(1);
    // });

        // test('run: minimum', async () => {
    //     await issueBot.run({
    //         title: 'Title'
    //     });

    //     expect(getOctokit().issues.create).toHaveBeenCalled();
    // });
});
