var GithubClient = require('../lib/github-client');

var MockRSVP = require('./mock-rsvp');
var _ = require('underscore');
var chai = require("chai");
var expect = chai.expect;



describe('GithubClient', function () {
  var github, requests;
  beforeEach(function () {
    github = new GithubClient('testuser', {user: 'testuser', password: 'password'});
    requests = [];
    github._request = function (options) {
      var request = {options: options, response: new MockRSVP("request (" + options.url + ")")};
      requests.push(request);
      return request.response;
    };
  });

  describe('createFork', function () {
    var result;
    beforeEach(function () {
      result = github.createFork("bob", "my-blog");
    });
    
    it('should post to the forks resource for the repo', function () {
      expect(requests[0].options.method).to.equal("POST");
      expect(requests[0].options.url).to.equal('https://api.github.com/repos/bob/my-blog/forks');
    });
    
    it('should report ok if statusCode is 202', function () {
      requests[0].response.resolve({statusCode: 202});
      expect(result.state).to.equal('resolved');
    });
    
    it('should fail if statusCode is not 202', function () {
      requests[0].response.resolve({statusCode: 200});
      expect(result.state).to.equal('rejected');
    });
  });

  describe('updateFork', function () {
    var result;
    beforeEach(function () {
      result = github.updateFork("bob", "bill", "super-repo", "my-branch");
    });

    it('should post to the pulls resource to create a pull', function () {
      expect(requests[0].options.method).to.equal("POST");
      expect(requests[0].options.url).to.equal("https://api.github.com/repos/bill/super-repo/pulls");
    });

    it('should post the origin and target branches', function () {
      expect(requests[0].options.body.head).to.equal("bob:my-branch");
      expect(requests[0].options.body.base).to.equal("my-branch");
    });

    it('should request a merge on the newly created pull request', function () {
      requests[0].response.resolve({body: {number: 99}});
      expect(requests[1].options.url).to.equal("https://api.github.com/repos/bill/super-repo/pulls/99/merge");
      expect(requests[1].options.method).to.equal("PUT");
    });

    it('should complete succesfully after both requests', function () {
      requests[0].response.resolve({body: {number: 99}});
      requests[1].response.resolve({});
      expect(result.state).to.equal('resolved');
    });
  });

  describe('createBranch', function () {
    var result;
    beforeEach(function () {
      result = github.createBranch("bob", "mega-repo", "the-base", "new-branch");
    });

    it('should request information on the base branch', function () {
      expect(requests[0].options.method).to.equal("GET");
      expect(requests[0].options.url).to.equal("https://api.github.com/repos/bob/mega-repo/git/refs/heads/the-base");
    });

    it('should create a new branch based on the head of the base branch', function () {
      requests[0].response.resolve({body: {object: {sha: 'THE SHA'}}});
      expect(requests[1].options.method).to.equal('POST');
      expect(requests[1].options.url).to.equal("https://api.github.com/repos/bob/mega-repo/git/refs");
      expect(requests[1].options.body.ref).to.equal("refs/heads/new-branch");
      expect(requests[1].options.body.sha).to.equal("THE SHA");
    });

    it('should complete succesfully after both requests', function () {
      requests[0].response.resolve({body: {object: {sha: 'THE SHA'}}});
      requests[1].response.resolve({});
      expect(result.state).to.equal('resolved');
    });
  });

  describe('editFile', function () {
    var result, originalContent;
    beforeEach(function () {
      originalContent = null;
      result = github.editFile("bob", "the-repo", "a-branch", "/path/to/the/file.ext", "I CHANGED A FILE!!!", function (content) {
        originalContent = content;
        return new Buffer("EDITED CONTENT");
      });
    });

    it('should request current file data', function () {
      expect(requests[0].options.method).to.equal("GET");
      expect(requests[0].options.url).to.equal("https://api.github.com/repos/bob/the-repo/contents/path/to/the/file.ext");
    });

    it('should base64 decode the content and pass it to the edit function', function () {
      requests[0].response.resolve({body: {content: "SGVsbG8gd29ybGQ="}});
      expect(originalContent.toString('utf8')).to.equal('Hello world');
    });

    it('should put back the newly edited content', function () {
      requests[0].response.resolve({body: {content: "SGVsbG8gd29ybGQ=", sha: 'the sha'}});
      expect(requests[1].options.method).to.equal('PUT');
      expect(requests[1].options.url).to.equal(requests[0].options.url);
      expect(requests[1].options.body.path).to.equal('path/to/the/file.ext');
      expect(requests[1].options.body.sha).to.equal('the sha');
      expect(requests[1].options.body.content.toString()).to.equal(new Buffer('EDITED CONTENT').toString('base64'));
      expect(requests[1].options.body.message).to.equal('I CHANGED A FILE!!!');
      expect(requests[1].options.body.branch).to.equal('a-branch');
    });

    it('should complete succesfully after both requests', function () {
      requests[0].response.resolve({body: {content: "SGVsbG8gd29ybGQ=", sha: 'the sha'}});
      requests[1].response.resolve({});
      expect(result.state).to.equal('resolved');
    });
  });

  describe('createPullRequest', function () {
    var result;
    beforeEach(function () {
      result = github.createPullRequest("sourceBob", "my-repo", "source-branch", "targetBill", "target-branch", "I MAKE PR", "HELLO");
    });

    it('should post to the pulls resource to create a pull', function () {
      expect(requests[0].options.method).to.equal("POST");
      expect(requests[0].options.url).to.equal("https://api.github.com/repos/targetBill/my-repo/pulls");
    });
    
    it('should post the origin and target branches', function () {
      expect(requests[0].options.body.head).to.equal("sourceBob:source-branch");
      expect(requests[0].options.body.base).to.equal("target-branch");
    });
    
    it('should include title and body in PR', function () {
      expect(requests[0].options.body.title).to.equal("I MAKE PR");
      expect(requests[0].options.body.body).to.equal("HELLO");
    });

    it('should complete succesfully after the requests', function () {
      requests[0].response.resolve({body: {number: 99}});
      expect(result.state).to.equal('resolved');
    });
  });
});
