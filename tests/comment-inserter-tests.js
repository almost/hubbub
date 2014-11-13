var makeCommentInserter = require('../lib/comment-inserter');

var _ = require('underscore');
var chai = require("chai");
var expect = chai.expect;

describe('commentInserter', function () {
  var commentInserter;
  beforeEach(function () {
    commentInserter = makeCommentInserter("END_COMMENTS");
  });

  it('should insert into the top of the block of blank lines immediately preceeding the comment send marker', function () {
    var post = "Hello world\n\nSome other stuff\n\n\n\n\n\n{% comment %}\nEND_COMMENTS\n{% endcomment %}\n";
    var proccessed = commentInserter(post, "This is my super comment\nHello");
    expect(proccessed).to.equal("Hello world\n\nSome other stuff\n\nThis is my super comment\nHello\n\n\n\n\n\n{% comment %}\nEND_COMMENTS\n{% endcomment %}\n");
  });

  it('should go from the bottom of the file if no comment marker is found', function () {
    var post = "Hello world\n\nSome other stuff\n\n\n\n\n\n";
    var proccessed = commentInserter(post, "This is my super comment\nHello");
    expect(proccessed).to.equal("Hello world\n\nSome other stuff\n\nThis is my super comment\nHello\n\n\n\n\n\n");
  });

  it('should always leave a space before and after a comment', function () {
    var post = "Hello world\n\nSome other stuff\n\n{% comment %}\nEND_COMMENTS\n{% endcomment %}\n";
    var proccessed = commentInserter(post, "This is my super comment\nHello");
    expect(proccessed).to.equal("Hello world\n\nSome other stuff\n\nThis is my super comment\nHello\n\n{% comment %}\nEND_COMMENTS\n{% endcomment %}\n");
  });

  it('should work even if there is only one blank line at the bottom', function () {
    var post = "Hello world\n\nSome other stuff\n";
    var proccessed = commentInserter(post, "This is my super comment\nHello");
    expect(proccessed).to.equal("Hello world\n\nSome other stuff\n\nThis is my super comment\nHello\n");
  });
  
  it('should add a blank line at bottom if there is no final one', function () {
    var post = "Hello world\n\nSome other stuff";
    var proccessed = commentInserter(post, "This is my super comment\nHello");
    expect(proccessed).to.equal("Hello world\n\nSome other stuff\n\nThis is my super comment\nHello\n");
  });

  it('should pick the last end marker if multiple ones are present', function () {
    var post = "Hello world\n\nSome other stuff\n\n\nEND_COMMENTS\n\n\n{% comment %}\nEND_COMMENTS\n{% endcomment %}\n";
    var proccessed = commentInserter(post, "This is my super comment\nHello");
    expect(proccessed).to.equal("Hello world\n\nSome other stuff\n\n\nEND_COMMENTS\n\nThis is my super comment\nHello\n\n\n{% comment %}\nEND_COMMENTS\n{% endcomment %}\n");
  });
  
});
