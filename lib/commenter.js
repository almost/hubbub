var _ = require('underscore');

module.exports = Commenter;

// Responsible for creating a new branch on the commenting fork of a
// repository and creating a pull request for the page with the a
// comment added.
function Commenter(githubClient, site, commentInserter) {
  this._gh = githubClient;
  this._site = site;
  // Expected to be: function (existingPostString, commentString) -> newPostString (can be a promise)
  this._commentInserter = commentInserter;
}


Commenter.prototype = {
  // Create a new branch and return a promise for the branch name
  _createCommentBranch: function() {
    var me = this;
    function tryCreateBranch(tryNumber) {
      var branchName = 'comment-' + (+new Date());
      if (tryNumber > 1) {
        branchName = branchName + '-' + tryNumber;
      }
      // TODO: Should we check for an create the fork if it isn't there? (see issue #14)

      return me._gh.createBranch(me._gh.user, me._site.repo, me._site.branch, branchName)
        .then(function (response) {
          return branchName;
        })
        .catch(function (error) {
          // 422 is raised when branch already exists, try again
          if (error.statusCode === 422 && tryNumber < 5) {
            return tryCreateBranch(tryNumber+1);
          }
          throw error;
        });
    }

    if (me._site.user === me._gh.user) {
      return tryCreateBranch(1);
    } else {
      // Working from a fork, update it!
      return me._gh.updateFork(me._site.user, me._gh.user, me._site.repo, me._site.branch)
        .catch(function (err) {
          if (err.statusCode === 404) {
            // Fork does not exist!
            throw new Error("Fork does not exist yet (it is probably still being created");
          } else {
            // TODO: Log failure to update fork (see #20)
            // console.log(JSON.stringify(err.body))
            console.error('Failed to update fork (this is normal)');
            // Continue on...
          }
        })
        .then(function () {
          // Then create a new branch from it
          return tryCreateBranch(1);
        });
    }
  },

  createComment: function(sourcePath, metadata, preprocessedComment) {
    var me = this;

    function addComment(branchName) {
      return me._gh.editFile(
        me._gh.user, me._site.repo, branchName, sourcePath, "hubbub: New comment from " + metadata.name + "\n" + preprocessedComment,
        function (oldContent) {
          var stringContent = oldContent.toString('utf8');
          stringContent = me._commentInserter(stringContent, preprocessedComment);
          return new Buffer(stringContent, 'utf8');
        }).then(_.constant(branchName));
    }

    function createPR (branchName) {
      // Now create a Pull Request
      return me._gh.createPullRequest(
        me._gh.user, me._site.repo, branchName,
        me._site.user, me._site.branch,
        "hubbub: New comments",
        "")
        .then(function (response) {
          return {pullRequestNumber: response.number};
        });
    }

    return this._gh.listPullRequests(me._site.user, me._site.repo, me._site.branch, 'open')
      .then(function (pullRequests) {
        // Are any of the existing PRs suitable to be reused?
        var latest = _.first(_.filter(pullRequests, function (pr) {
          return /^hubbub[:] /.exec(pr.title) && pr.head.label.split(':')[0] === me._gh.user;
        }))
        if (latest == null) {
          return me._createCommentBranch().then(addComment).then(createPR);
        } else {
          return addComment(latest.head.ref).then(_.constant(latest.number));
        }
      });
  }
};
