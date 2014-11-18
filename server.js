var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    bodyParser = require('body-parser'),
    marked = require('marked'),
    cors = require('cors'),
    _ = require('underscore'),
    config = require('config'),
    GithubClient = require('./lib/github-client'),
    Commenter = require('./lib/commenter'),
    makeCommentInserter = require('./lib/comment-inserter'),

    app = express(),
    port = process.env.PORT || 44444;

app.use(bodyParser.json());

app.use(cors());

var commentTemplate = _.template(config.get('commentTemplate'));
var sites = config.get('sites');
var github = new GithubClient(config.get('commentUser.user'), config.get('commentUser.auth'));

function ensureForksExist() {
  _.each(sites, function (site) {
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
function urlPathToSourceFile(urlPath) {
  // TODO: Make this configurable!
  return "_posts/" + urlPath.split('/').slice(-5, -1).join('-') + ".markdown";
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
  var commenter = new Commenter(github, req.site, commentInserter);
  
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

  
  var sourcePath = urlPathToSourceFile(postPath);
  var preprocessedComment = commentTemplate({comment: comment, metadata: metadata});

  commenter.createComment(sourcePath, metadata, preprocessedComment)
    .then(function (sentDetails) {
      // IDEA: In the future when we support message editing the id
      // should contain an hmac with the secret key. That way the id
      // will be unguessable and we can assume that someone who has
      // the id is the message author.
      res.json({
        html: marked(preprocessedComment),
        update_url: req.protocol + '://' + req.get('host') + '/api/' + req.params.site + '/comments/' + sentDetails.pullRequestNumber
      });
    })
    .catch(function (err) {
      console.error("Failed to save comment: " + (err.message || err.toString()));
      if (err.stacktrace) {
        console.error(err.stacktrace);
      }
      // TODO: Detect errors like missing source files and report them
      res.status(500).json({error: "Failed to save comment"});
      return;
    });
});

app.get('/api/:site/comments', function (req, res) {
  res.redirect("/help");
});

// Comment status, will later also support comment editing and
// deleting
app.get('/api/:site/comments/:id', function (req, res) {
  var id = req.params.id;
  
  github.getPullRequest(req.site.user, req.site.repo, id)
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
        res.status(500).json({error: "Failed to retrieve Pull Request details"});
      }
    });
});

var helpPage = _.template(fs.readFileSync(path.resolve(__dirname, "./pages/help.md"), {encoding: "utf8"}));
app.get('/help', function (req, res) {
  res.end(marked(helpPage({domain: req.get('host')})));
});


// Check forks on every startup (happend asynchronously)
ensureForksExist();

app.listen(port, function () {
  console.log('Listening on port ' + port);
});
