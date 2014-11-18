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
      // TODO: Should we check for an create the fork if it isn't there?
      
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
          // TODO: Log failure to update fork
          console.error('Failed to update fork');
          // Continue on...
        })
        .then(function () {
          // Then create a new branch from it
          return tryCreateBranch(1);
        });
    }
  },

  createComment: function(sourcePath, metadata, preprocessedComment) {
    var me = this;
    var branchName;
    return this._createCommentBranch()
      .then(function (_branchName) {
        branchName = _branchName;
        return me._gh.editFile(
          me._gh.user, me._site.repo, branchName, sourcePath, "hubbub: Add a comment",
          function (oldContent) {
            var stringContent = oldContent.toString('utf8');
            stringContent = me._commentInserter(stringContent, preprocessedComment);
            return new Buffer(stringContent);
          });
      })
      .then(function () {
        // Now create a Pull Request
        return me._gh.createPullRequest(
          me._gh.user, me._site.repo, branchName,
          me._site.user, me._site.branch,
          "hubbub: New comment from " + metadata.name,
          preprocessedComment);
      })
      .then(function (response) {
        return {pullRequestNumber: response.number};
      });
            
  }
};
