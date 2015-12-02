var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    bodyParser = require('body-parser'),
    marked = require('marked'),
    moment = require('moment-timezone'),
    cors = require('cors'),
    uuid = require('uuid'),
    sha1 = require('sha1'),
    _ = require('underscore'),
    config = require('config'),
    GithubClient = require('./lib/github-client'),
    Commenter = require('./lib/commenter'),
    makeCommentInserter = require('./lib/comment-inserter'),

    app = express(),
    port = process.env.PORT || 44444;

marked.setOptions({
  smartypants: true,
  breaks: true
});

app.use(bodyParser.json());

app.use(cors());

var commentTemplate = _.template(config.get('commentTemplate'));
// Here we're talking about a code comment not a blog comment
var markdownCommentSyntax = _.template(config.get('markdownCommentSyntax'), {variable: 'data'});
var sites = config.get('sites');
var github = new GithubClient(config.get('commentUser.user'), config.get('commentUser.auth'));

function ensureForksExist() {
  _.each(sites, function (site) {
    if (site.user === config.get('commentUser.user')) {
      // No fork needed for sites owned by the comment user
      return;
    }
    console.log('Check that Comment user has a fork of ' + site.repo);
    github.getRepo(config.get('commentUser.user'), site.repo)
      .catch(function (errorResponse) {
        if (errorResponse.statusCode === 404) {
          console.log('Comment user does not have a fork for ' + site.repo + '. Creating one now');
          github.createFork(site.user, site.repo)
            .then(function () {
              console.log('Forking of ' + site.repo + ' in progress (it could be a few minutes before it is ready');
            });
        } else {
          console.log('Unexpected error while checking if comment user has a fork of ' + site.repo + '(status code ' + errorResponse.statusCode + ')');
        }
      });
  });
}


// Convert a post url path to a source file path within git
function urlPathToSourceFile(urlPath, urlMatchRegexp, prefix, suffix) {
  // Takes the last 4 segments of the url and joins them with dashes
  // instead of slashes and adds prefix and suffic from the config. So
  // http://example.com/myblog/meta/2012/03/15/guest-blogs/ becomes
  // _posts/2012-03-15-guest-blogs.markdown

  var match = new RegExp(urlMatchRegexp).exec(urlPath);

  if (!match) {
    throw new Error("Can't figure out file path for post. URL does not match our regular expression");
  }
  var fileName = (match[1] || match[0]).replace(/\//g, '-');

  if (fileName.indexOf('..') !== -1) {
    throw new Error("URL can't contain ..");
  }

  return prefix + fileName + suffix;
}

app.get('/hubbub.js', function (req, res) {
  res.sendFile('./client/hubub.js',
              {
                root: __dirname,
                headers: {
                  'content-type': 'application/javascript'
                }
              });
});

app.param('site', function (req, res, next, siteId) {
  if (_.has(sites, siteId)) {
    req.site = sites[siteId];
    next();
  } else {
    next(new Error("Site not found"));
  }
});

// Post a new comment
app.post('/api/:site/comments', function (req, res) {
  var commentInserter = makeCommentInserter(req.site.commentsEndMarker);
  var commenter = new Commenter(github, req.site);

  var postPath = req.body.post;
  var comment = req.body.comment;
  var metadata = req.body.metadata;

  if (!_.isString(comment)) {
    res.status(400).json({error: "Comment is required"});
    return;
  }

  if (!_.isString(postPath)) {
    res.status(400).json({error: "Must specify a post"});
    return;
  }

  if (!metadata || !_.isString(metadata.name)) {
    res.status(400).json({error: "A name is required"});
    return;
  }

  // In the future this might be used to allow ediitng and deletion of
  // pending comments
  var commentPassword = uuid.v4();
  var commentKey = sha1(commentPassword);

  var sourcePath = urlPathToSourceFile(postPath, req.site.urlMatchRegexp, req.site.prefix, req.site.suffix);
  var preprocessedComment =
    "\n" + markdownCommentSyntax("START COMMENT " + commentKey) +  "\n\n" +
    commentTemplate({comment: comment, metadata: metadata, moment: moment()}) + "\n\n" +
    markdownCommentSyntax("END COMMENT " + commentKey) +  "\n";


  commenter.createComment(commentInserter, sourcePath, metadata, preprocessedComment, commentKey)
    .then(function (sentDetails) {
      // IDEA: In the future when we support message editing the id
      // should contain an hmac with the secret key. That way the id
      // will be unguessable and we can assume that someone who has
      // the id is the message author.
      res.json({
        html: marked(preprocessedComment),
        update_url: req.protocol + '://' + req.get('host') + '/api/' + req.params.site + '/comments/' +
          sentDetails.pullRequestNumber + '/' + commentPassword + '/' + encodeURIComponent(postPath)
      });
    })
    .catch(function (err) {
      var errorMessage;
      if (err.statusCode) {
        errorMessage = "Received " + err.statusCode + " status code from github API";
      } else {
        errorMessage = (err.message) ? err.message : "unknown error";
      }
      errorMessage = "Failed to save comment: " + errorMessage;
      console.error(errorMessage);
      if (err.stacktrace) {
        console.error(err.stacktrace);
      }
      // TODO: Detect errors like missing source files and report them
      res.status(500).json({error: errorMessage});
      return;
    });
});

app.get('/api/:site/comments', function (req, res) {
  res.redirect("/help");
});

// Comment status, will later also support comment editing and
// deleting
app.get('/api/:site/comments/:prNumber/:password/:path', function (req, res) {
  var prNumber = req.params.prNumber

  github.getPullRequest(req.site.user, req.site.repo, prNumber)
    .then(function (pullRequest) {
      var state;
      if (pullRequest.state === 'open') {
        state = "pending";
      } else {
        state = (pullRequest.merged) ? 'accepted' : 'rejected';
      }

      res.json({state: state});
    })
    .catch(function (error) {
      if (error.statusCode === 404) {
        res.status(404).json({error: "Not found"});
      } else {
        console.error(err.message ? err.message : err);
        res.status(500).json({error: "Failed to retrieve Pull Request details"});
      }
    });
});

app.delete('/api/:site/comments/:prNumber/:password/:path', function (req, res) {
  var commenter = new Commenter(github, req.site);
  var postPath = decodeURI(req.params.path);
  var password = req.params.password;
  var sourcePath = urlPathToSourceFile(postPath, req.site.urlMatchRegexp, req.site.prefix, req.site.suffix);
  var commentKey = sha1(password);
  commenter.deleteComment(sourcePath, commentKey)
    .then(function () {
      console.log('OK');
      res.json({status: "ok"});
    })
    .catch(function (err) {
      console.log('ERR', err);
      if (err.statusCode === 404) {
        res.status(404).json({error: "Not found"});
      } else {
        console.error(err.message ? err.message : err);
        res.status(500).json({error: "Failed to delete comment"});
      }
    });
});

var helpPage = _.template(fs.readFileSync(path.resolve(__dirname, "./pages/help.md"), {encoding: "utf8"}));
app.get('/help', function (req, res) {
  res.end(marked(helpPage({domain: req.get('host')})));
});


// Check forks on every startup (happens asynchronously)
ensureForksExist();

app.listen(port, function () {
  console.log('Listening on port ' + port);
});
