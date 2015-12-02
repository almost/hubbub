var _ = require('underscore');

module.exports = Commenter;

// Responsible for creating a new branch on the commenting fork of a
// repository and creating a pull request for the page with the a
// comment added.
function Commenter(githubClient, site) {
  this._gh = githubClient;
  this._site = site;
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

  _editPost: function (sourcePath, commitMessage, editCallback) {
    var me = this;

    function addComment(branchName) {
      return me._gh.editFile(
        me._gh.user, me._site.repo, branchName, sourcePath, commitMessage,
        editCallback).then(_.constant(branchName));
    }

    function createPR (branchName) {
      // Now create a Pull Request
      return me._gh.createPullRequest(
        me._gh.user, me._site.repo, branchName,
        me._site.user, me._site.branch,
        "hubbub: New comments",
        "")
        .then(function (response) {
          return response.number;
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
      })
      .then(function (prNumber) {
        return {pullRequestNumber: prNumber};
      });
  },

  deleteComment: function(sourcePath, commentKey) {
    var me = this;
    return this._editPost(
      sourcePath,
      "hubbub: Delete comment " + commentKey,
      function (oldContent) {
        var lines = oldContent.toString('utf8').split('\n');
        var start, end;
        lines.forEach(function (line, i) {
          if (line.indexOf("START COMMENT " + commentKey) !== -1) {
            start = i;
          } else if (line.indexOf("END COMMENT " + commentKey) !== -1) {
            end = i;
          }
        });
        if (start == null || end == null) {
          throw new Error("Couldn't find comment markers");
        }
        var stringContent = lines.slice(0, start).join('\n') + '\n' + lines.slice(end+1).join('\n') + '\n';
        return new Buffer(stringContent, 'utf8');
      });
  },

  createComment: function(commentInserter, sourcePath, metadata, preprocessedComment, commentKey) {
    var me = this;
    return this._editPost(
      sourcePath,
      "hubbub: New comment from " + metadata.name + "\nkey: " + commentKey + "\n" + preprocessedComment,
      function (oldContent) {
        var stringContent = oldContent.toString('utf8');
        stringContent = commentInserter(stringContent, preprocessedComment);
        return new Buffer(stringContent, 'utf8');
      });
  }
};
