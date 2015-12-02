Using Hubbub on your Blog
=========================

Next steps to install Hubbub on your Jekyll blog.

 * Add the Hubbub Javascript to your post layout HTML file (you can
   reference the file here or you can download `hubbub.js` and include
   it locally).

```
<script src="http://<%- domain %>/hubbub.js"></script>
```

 * Add the new comments form and pending comments container to yoru post layout HTML file.

```
<div data-hubbub-pendingcomments>
</div>

<form data-hubbub action="http://<%- domain %>/api/default/comments">
  <p>Your name: <input name="metadata_name"></p>
  <p>Your Comment</p>
  <textarea name="comment" placeholder="Comment here"></textarea>
  <p><input type="submit" value="Comment"></p>
</form>
```

Pending comments (comments the local user has made but which haven't
yet been accepted and put on the site) will be added to the `DIV`
marked with `data-hubbub-pendingcomments`.

 * OPTIONAL: If for any of your posts you don't want the comments at
   the bottom then add a marker *after* the spot you do want them in.
   Remember to leave a few blank lines before the marker.

```
{% comment %}
END_COMMENTS
{% endcomment %}
```

 * OPTIONAL (but recomended): Add some extra CSS to make it look nice.

```
.hubbub-sending input {
  opacity: 0.5; 
}

.hubbub-pending {
  transition: background-color 1s ease-in-out;
}

.hubbub-pending.hubbub-added {
  background-color: rgba(255,255,0,1);
}
```

   - The CSS class `hubbub-sending` will be added to the form while
     the comments are in the process of sending.
   - New comments added to the to the pending comments `DIV` will be
     given the CSS class `hubbub-pending`, they will also briefly be
     given the class `hubbub-added` (you can use this to apply CSS
     transititons).
