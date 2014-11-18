var _ = require('underscore');

// Returns a function that takes the source of a post (a page) and a
// comment and combines them by inserting the comment either before
// the comment marker or, if that can't be found, at the end of the
// file.
module.exports = function makeCommentInserter(commentsEndMarker) {
  function findInsertionIndex(postLines) {
    var trimmedLines = _.map(postLines, function (line) { return line.trim(); });

    var insertionIndex = _.lastIndexOf(trimmedLines, commentsEndMarker);

    // Default to end of the file
    if (insertionIndex === -1) {
      insertionIndex = postLines.length-1;
    }

    // Move up to find the end of the block of blank lines that should
    // be above the comment end marker marker
    insertionIndex = _.lastIndexOf(trimmedLines, '', insertionIndex);

    if (insertionIndex == -1) {
      throw new Error("No blank lines found!");
    }
    
    // Now go up further to find the begining of the block of blank lines
    while(insertionIndex >= 0 && trimmedLines[insertionIndex-1] === "") {
      insertionIndex--;
    }

    return insertionIndex;
  }

  function commentInserter (postSource, preprocessedComment) {
    var postLines = postSource.split('\n');
    if (postLines[postLines.length-1] !== '') {
      postLines.push("");
    }
    var insertionIndex = findInsertionIndex(postLines);

    // TODO: Move insertion index to minimise merge conflict? (see issue #2)
    
    postLines.splice(insertionIndex, 0, "\n" + preprocessedComment);
    return postLines.join("\n");
  }

  return commentInserter;
};
