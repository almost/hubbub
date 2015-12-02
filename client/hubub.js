// HubBub client code
// From: https://github.com/almost/hubbub/
// Copyright: Thomas Parslow 2014 (tom@almostobsolete.net)
// License: MIT

(function (hubbub) {
  "use strict";

  var defaults = {
    // For what post are we commenting?
    post: window.location.pathname
  };

  // Send a comment, reports success or failure to the callbacks
  function sendComment(options,  success, failure) {
    var endpoint = options.endpoint || defaults.endpoint,
        comment = options.comment || defaults.comment,
        metadata = options.metadata || defaults.metadata,
        post = options.post || defaults.post;

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("POST", endpoint, true);
    xmlhttp.setRequestHeader("Content-type", "application/json");

    xmlhttp.onload = function (e) {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status >= 200 && xmlhttp.status < 300) {
          var response = JSON.parse(xmlhttp.responseText);
          if (success) success(response);
        } else {
          if (failure) failure(xmlhttp);
        }
      }
    };

    xmlhttp.onerror = function (e) {
      failure(xmlhttp, e);
    };

    xmlhttp.send(JSON.stringify({metadata: metadata, comment: comment, post: post}));
  }

  // Send a comment given in the fields of a form in the DOM
  function sendForm(form, success, failure) {
    var metadata = {}, match;

    for (var i = 0; i < form.length; i++) {
      match = /^metadata_(.*)/.exec(form[i].name);
      if (match) {
        metadata[match[1]] = form[i].value;
      }
    }

    sendComment({endpoint: form.action, comment: form.comment.value, metadata: metadata}, success, failure);
  }

  // Add a comment to the pending storage.
  // commentResponse is the response data returned from posting a comment.
  function storePendingComment(post, commentResponse) {
    post = post || defaults.post;
    var pendingComments = JSON.parse(localStorage["hubbubPendingComments:" + post] || '[]');
    pendingComments.push(commentResponse);
    localStorage["hubbubPendingComments:" + post] = JSON.stringify(pendingComments);
  }

  function clearPendingComments(post) {
    post = post || defaults.post;
    delete localStorage["hubbubPendingComments:" + post];
  }


  // Get pending comments from local storage then check them to make
  // sure they're still pending
  function getPendingComments(post, callback) {
    post = post || defaults.post;
    var pendingComments = JSON.parse(localStorage["hubbubPendingComments:" + post] || '[]');
    var remaining = pendingComments.length;
    var stillPending = [];

    function gotCommentStatus (pendingComment, isStillPending) {
      if (isStillPending) {
        stillPending.push(pendingComment)
      }
      remaining--;
      if (remaining === 0) {
        // Store back just the pending comments
        if (stillPending.length === 0) {
          delete localStorage["hubbubPendingComments:" + post];
        } else {
          localStorage["hubbubPendingComments:" + post] = JSON.stringify(stillPending);
        }

        callback(stillPending);
      }
    }

    pendingComments.forEach(function (pendingComment) {
      var xmlhttp = new XMLHttpRequest();
      xmlhttp.open("GET", pendingComment.update_url, true);

      xmlhttp.onload = function (e) {
        if (xmlhttp.readyState === 4) {
          if (xmlhttp.status === 200) {
            var response = JSON.parse(xmlhttp.responseText);
            gotCommentStatus(pendingComment, response.state === "pending");
          } else if (xmlhttp.status === 404) {
            gotCommentStatus(pendingComment, false);
          } else {
            // Got an unexpected status, let's just assume the comment
            // is still pending for now
            gotCommentStatus(pendingComment, true);
          }
        }
      };

      xmlhttp.onerror = function (e) {
        // Got an unexpected error, let's just assume the comment
        // is still pending for now
        gotCommentStatus(pendingComment, true);
      };

      xmlhttp.send();
    });

    // Return the ones from the cache eright now, the callback will be
    // used once we've checked them
    return pendingComments;
  }

  function addPendingCommentToDOM(container, comment) {
    var html = comment.html;
    var commentEl = document.createElement('div');
    commentEl.className = "hubbub-pending hubbub-added";
    commentEl.innerHTML = html;
    container.appendChild(commentEl);

    // Remove the hubbub-added class to allow CSS transitions to
    // work
    setTimeout(function () {
      commentEl.className = "hubbub-pending";
    }, 100);
    return commentEl;
  }

  // Trap all submit events and check for a data-hubbub attribute, if
  // one exists then send a comment from the form.
  var inProgress = false;
  function onSubmit (evt) {
    var form = evt.target;
    if (!form.hasAttribute('data-hubbub')) {
      // These aren't the forms you're looking for
      return;
    }
    var previewContainer = document.querySelector('[data-hubbub-pendingcomments]');
    evt.preventDefault();

    if (!form.comment) {
      // If there's no comment then just ignore the submit
      return;
    }

    if (inProgress) {
      return;
    }

    inProgress = true;

    // Add status class while we send
    form.className = form.className + " hubbub-sending";

    sendForm(form, success, failure);

    function removeClass() {
      form.className = form.className.split(' ').filter(function (cls) {
        return cls !== 'hubbub-sending';
      })
    }

    function success(commentResponse) {
      inProgress = false;
      removeClass();
      // Clear the comment field
      form.comment.value = '';
      if (previewContainer) {
        // Store the comment away so we can keep on displaying it
        // while it is pending
        storePendingComment(null, commentResponse);

        addPendingCommentToDOM(previewContainer, commentResponse);
      }
    }

    function failure(xmlhttp) {
      inProgress = false;
      removeClass();
      alert("Failed to send comment.");
    }
  }
  document.addEventListener('submit', onSubmit);

  function showPendingComments (previewContainer) {
    var pendingComments = getPendingComments(null, gotPendingComments);
    var previewEls = pendingComments.map(function (pendingComment) {
      return addPendingCommentToDOM(previewContainer, pendingComment);
    });
    function gotPendingComments(verifiedPending) {
      // No we've checked with the server which of the comments are
      // still pending we should remove any that aren't
      pendingComments.forEach(function (pendingComment, index) {
        if (verifiedPending.indexOf(pendingComment) === -1) {
          previewEls[index].parentNode.removeChild(previewEls[index]);
        }
      });
    }
  }


  // If a pending comments container is present then fill it with any pending comments we've stored
  function onDocumentReady() {
    var previewContainer = document.querySelector('[data-hubbub-pendingcomments]');
    if (previewContainer) {
      showPendingComments(previewContainer);
    }
  }
  document.addEventListener('DOMContentLoaded', onDocumentReady);


  hubbub.defaults = defaults;
  hubbub.sendComment = sendComment;
  hubbub.sendForm = sendForm;
  hubbub.addPendingCommentToDOM = addPendingCommentToDOM;

  hubbub.storePendingComment = storePendingComment;
  hubbub.getPendingComments = getPendingComments;
  hubbub.clearPendingComments = clearPendingComments;

})(window.hubbub = {});
