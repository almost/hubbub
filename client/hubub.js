// HubBub client code
// From: https://github.com/almost/hubbub/
// Copyright: Thomas Parslow 2014 (tom@almostobsolete.net)
// License: MIT

(function (hubbub) {
  "use strict";

  var defaults = {
    post: window.location.pathname
  };

  // Send a comment, reports success or failure to the callbacks
  function sendComment(options,  success, failure) {
    var endpoint = options.endpoint || defaults.endpoint,
        comment = options.comment || defaults.comment,
        metadata = options.metadata || defaults.metadata,
        post = options.post || defaults.post;
    
    var xmlhttp = new XMLHttpRequest();
    // TODO: Make this configurable!
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
  
  // Trap all submit events and check for a data-hubbub attribute, if
  // one exists then send a comment from the form.
  var inProgress = false;
  function onSubmit (evt) {
    var form = evt.target;
    if (!form.getAttribute('data-hubbub')) {
      // These aren't the forms you're looking for
      return;
    }
    var previewContainer = document.querySelector(evt.target.getAttribute('data-hubbub'));
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

    function success(response) {
      inProgress = false;
      removeClass();
      // Clear the comment field
      form.comment.value = '';
      if (previewContainer) {
        var commentEl = document.createElement('div');
        commentEl.className = "hubbub-pending hubbub-added";
        commentEl.innerHTML = response.html;
        previewContainer.appendChild(commentEl);
        
        // Remove the hubbub-added class to allow CSS transitions to
        // work
        setTimeout(function () {
          commentEl.className = "hubbub-pending";
        }, 100);
      }
    }
    
    function failure(xmlhttp) {
      inProgress = false;
      removeClass();
      alert("Failed to send comment.");
    }
  }

  document.addEventListener('submit', onSubmit);
  

  hubbub.defaults = defaults;
  hubbub.sendComment = sendComment;
  hubbub.sendForm = sendForm;
  
})(window.hubbub = {});
