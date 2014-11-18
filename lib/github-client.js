var request = require('request');
var template = require('url-template');
var RSVP = require('rsvp');

module.exports = GithubClient;

// Responsible for interacting with Github. This isn't a complete
// Github client right now, it just does a set of things needed for
// the Hubbub project.
function GithubClient (user, auth) {
  this.user = user;
  this.auth = auth;
}

function getBody(ressponse) {
  return response.body;
}

GithubClient.prototype = {

  // The request library's main function promisified, easy to overide
  // for tests
  _request: function (options) {
    var me = this;
    return new RSVP.Promise(function (resolve, reject) {
      request(options, function (err, response, body) {
        if (err) {
          reject(err);
        } else {
          response.body = body;
          resolve(response);
        }
      });
    });
  },
  
  request: function (method, url, params, body) {
    var me = this;
    url = template.parse("https://api.github.com" + url).expand(params);
    // console.log('------------');
    // console.log(body);
    // console.log('requests', url);
    var options = {
      method: method,
      url: url,
      json: true,
      body: body,
      auth: me.auth,
      headers: {
        'User-Agent': 'hubbub'
      }
    };
    
    return this._request(options)
      .then(function (response) {
        // Turn all responses with status codes 400 and above into
        // errors on the promise
        if (response.statusCode >= 400) {
          throw (response);
        } else {
          return response;
        }
      });
  },
  
  get: function (url, params) {
    return this.request('GET', url, params, null);
  },
  
  post: function (url, params, body) {
    return this.request('POST', url, params, body);
  },
  
  put: function (url, params, body) {
    return this.request('PUT', url, params, body);
  },
  
  "delete": function (url, params) {
    return this.request('DELETE', url, params, null);
  },
  
  // Create a new fork of a repo (on the authenticated user's
  // account). Forks are created asynchronously.
  createFork: function (user, repo) {
    return this.post('/repos/{user}/{repo}/forks', {user: user, repo: repo})
      .then(function (response) {
        if (response.statusCode !== 202) {
          throw new Error("Got unexpected status code when creating fork: " + response.statusCode);
        }
        return response;
      });
  },

  // Update origin-fork
  
  // Massive hack but the only way I could find to update a fork
  // through the API was to create a Pull Request then merge it. Fails
  // if there's already a pull request.
  updateFork: function (originUser, forkUser, repo, branch) {
    var me = this;
    return this.post(
      "/repos/{user}/{repo}/pulls",
      {user: forkUser, repo: repo},
      {
        title: "Update from origin",
        head: originUser + ":" + branch,
        base: branch,
        body: "Update from origin"
      })
      .then(function (response) {
        return me.put(
          "/repos/{user}/{repo}/pulls/{number}/merge",
          {user: forkUser, repo: repo, number: response.body.number},
          {
            commit_message: "Merge from upstream"
          });
      });
  },

  createBranch: function (user, repo, baseBranch, newBranch) {
    var me = this;
    return this.get(
      "/repos/{user}/{repo}/git/refs/heads/{branch}",
      {user: user, repo: repo, branch: baseBranch})
      .then(function (response) {
        var sha = response.body.object.sha;
        return me.post(
          "/repos/{user}/{repo}/git/refs", 
          {user: user, repo: repo},
          {
            ref: "refs/heads/" + newBranch,
            sha: sha
          });
      });
  },

  editFile: function (user, repo, branch, path, commitMessage, editCallback) {
    var me = this;
    var sha;

    if (path[0] === '/') {
      path = path.slice(1);
    }
    
    return this.get(
      "/repos/{user}/{repo}/contents/{+path}",
      {user: user, repo: repo, branch: branch, path: path})
      .then(function (response) {
        var oldContent = new Buffer(response.body.content, 'base64');
        sha = response.body.sha;
        return editCallback(oldContent);
      })
      .then(function (newContent) {
        return me.put(
          "/repos/{user}/{repo}/contents/{+path}",
          {user: user, repo: repo, branch: branch, path: path},
          {
            path: path,
            message: commitMessage || "no commit message",
            content: newContent.toString('base64'),
            sha: sha,
            branch: branch
          });
        // TODO: Handle the case where the file changed between
        // getting it and saving it and retry (see issue #21)
      });
  },

  createPullRequest: function (sourceUser, repo, sourceBranch, targetUser, targetBranch, title, body) {
    return this.post(
      "/repos/{user}/{repo}/pulls",
      {user: targetUser, repo: repo},
      {
        head: sourceUser + ":" + sourceBranch,
        base: targetBranch,
        title: title,
        body: body
      })
      .then(function (response) {
        return response.body;
      });
  },

  getPullRequest: function (user, repo, pullRequestNumber) {
    return this.get(
      "/repos/{user}/{repo}/pulls/{pr}",
      {user: user, repo: repo, pr: pullRequestNumber})
    .then(function (response) {
      if (response.statusCode !== 200) {
          throw new Error("Got unexpected status code when getting pull request data: " + response.statusCode);
      }
      return response.body;
    });
  },
  
  getRepo: function (user, repo) {
    return this.get(
      "/repos/{user}/{repo}",
      {user: user, repo: repo})
    .then(function (response) {
      if (response.statusCode !== 200) {
          throw new Error("Got unexpected status code when getting repository: " + response.statusCode);
      }
      return response.body;
    });
  }
};
