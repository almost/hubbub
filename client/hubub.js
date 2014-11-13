// HubBub client code
// From: https://github.com/almost/hubbub/

(function () {
  // Just a very rough demo, needs a lot more work

  var form = document.querySelector('form[data-hubbub]');
  form.addEventListener('submit', function (evt) {
    evt.preventDefault();
    var comment = form.querySelector('[name=comment]').value;
    var name = form.querySelector('[name=name]').value;
    
    var xmlhttp = new XMLHttpRequest();
    // TODO: Make this configurable!
    xmlhttp.open("POST","https://hubbub.herokuapp.com/api/default/comments",true);
    xmlhttp.setRequestHeader("Content-type", "application/json");

    xmlhttp.onload = function (e) {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status >= 200 && xmlhttp.status < 300) {
          var response = JSON.parse(xmlhttp.responseText);
          var commentsContainer = document.querySelector('[data-hubbub-pendingcomment]');         
          if (commentsContainer) {
            var commentEl = document.createElement('div');
            commentEl.innerHTML = response.html;
            commentsContainer.appendChild(commentEl);
          }
          alert("Comment sent!");
          form.querySelector('[name=comment]').value = "";
        } else {
          alert("Failed to send comment: " + xmlhttp.statusText);
        }
      }
    };
    xmlhttp.onerror = function (e) {
      alert("Failed to send comment: " + xmlhttp.statusText);
    };
    
    // TOOD: Get post path from canonical meta tag if it's present
    xmlhttp.send(JSON.stringify({metadata: {name: name}, comment: comment, post: window.location.pathname}));
  });
})();
