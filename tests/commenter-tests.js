var Commenter = require('../lib/commenter');

var MockRSVP = require('./mock-rsvp');
var _ = require('underscore');
var chai = require("chai");
var sinon = require("sinon");
var expect = chai.expect;

describe('Commenter', function () {
  var commenter, github, inserter, site;
  beforeEach(function () {
    github = {
      user: 'gh-user'
    };
    _.each(['createBranch', 'updateFork', 'editFile', 'createPullRequest', 'listPullRequests'], function (meth) {
      github[meth] = sinon.stub();
      github[meth].promise = new MockRSVP(meth);
      github[meth].onCall(0).returns(github[meth].promise);
    });

    inserter = sinon.spy();
    site = {
      user: 'site-user',
      repo: 'the-repo',
      branch: 'some-branch'
    };
    commenter = new Commenter(github, site);
  });

  describe('_createCommentBranch', function () {
    describe('using fork', function () {
      var result;
      beforeEach(function () {
        result = commenter._createCommentBranch();
      });

      it('should update the fork', function () {
        expect(github.updateFork.firstCall.args).to.eql(['site-user', 'gh-user', 'the-repo', 'some-branch']);
      });

      it('should continue as normal if update fork fails', function () {
        github.updateFork.promise.reject(new Error("What's wrong with your face?"));
        expect(github.createBranch.called).to.be.ok();
      });

      it('should create a branch', function () {
        github.updateFork.promise.resolve();
        expect(github.createBranch.calledWith('gh-user','the-repo', 'some-branch')).to.be.ok();
      });

      it('should return the branch name on success', function () {
        github.updateFork.promise.resolve();
        github.createBranch.promise.resolve();
        expect(result.state).to.equal('resolved');
        expect(result.value).to.match(/^comment-[^\-]+$/);
      });

      it('should retry branch if the branch name it tries already exists', function () {
        var secondCreateBranchResult = new MockRSVP('createBranch(2)');
        github.updateFork.promise.resolve();

        github.createBranch.onCall(1).returns(secondCreateBranchResult);
        github.createBranch.promise.reject({statusCode: 422});
        secondCreateBranchResult.resolve();

        expect(result.state).to.equal('resolved');
        expect(result.value).to.match(/^comment-[^\-]+-2$/);
      });
    });

    it("should not update the fork if we're not using a fork (creating the branch in the origin repo)", function () {
      site.user = "gh-user";
      var result = commenter._createCommentBranch();
      expect(github.updateFork.called).not.to.be.ok();
      github.createBranch.promise.resolve();
      expect(result.state).to.equal('resolved');
    });
  });

  describe('createComment', function () {
    var createBranchResult, result;
    beforeEach(function () {
      createBranchResult = new MockRSVP("createCommentBranch");
      sinon.stub(commenter, '_createCommentBranch');
      commenter._createCommentBranch.returns(createBranchResult);
      result = commenter.createComment(inserter, '/test/somewhere/file.ext', {name: "Me"}, "Hello world!", "password");
    });

    it('should create the branch with _createCommentBranch', function () {
      github.listPullRequests.promise.resolve([]);
      expect(commenter._createCommentBranch.called).to.be.ok();
    });

    it('should edit the file on the branch returned by _createCommentBranch', function () {
      github.listPullRequests.promise.resolve([]);
      createBranchResult.resolve('comment-branch');
      // Ignoring final arugment (commit message)
      expect(github.editFile.calledWith('gh-user', 'the-repo', 'comment-branch', '/test/somewhere/file.ext')).to.be.ok();
    });

    it('should create a pull request back to the origin site', function () {
      github.listPullRequests.promise.resolve([]);
      createBranchResult.resolve('comment-branch');
      github.editFile.promise.resolve({});
      expect(github.createPullRequest.firstCall.args).to.eql(['gh-user', 'the-repo', 'comment-branch', 'site-user', 'some-branch', "hubbub: New comments", ""]);
    });

    it('should return success after the pull request is created', function () {
      createBranchResult.resolve('comment-branch');
      github.editFile.promise.resolve({});
      github.createPullRequest.promise.resolve({});
      github.listPullRequests.promise.resolve([]);
      expect(result.state).to.equal('resolved');
    });
  });

});
