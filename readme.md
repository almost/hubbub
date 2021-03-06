Hubbub
======

Comments as Github pull requests for Jekyll (and other static site generator) websites.

Thanks to Miles Sabin ([twitter](https://twitter.com/milessabin) & [github](https://github.com/milessabin)) for the original idea and initial sponsorship. 

Initial development by [Thomas Parslow](http://almostobsolete.net). Pull requests very welcome.

[![Build Status](https://travis-ci.org/almost/hubbub.svg)](https://travis-ci.org/almost/hubbub) 

Quick Deployment
----------------

You can deploy (for free) to Heroku with the button below:

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/almost/hubbub)

It will ask you for a Github username *and* a password. This is for the commenter user which will be the user which actually creates the pull requests for comments. I strongly suggest you create a new user just for this.  

Set `URL_PREFIX` config var to `_posts/` and `URL_SUFFIX` to `.markdown` for file structure like `_posts/2018-12-15-welcome-to-jekyll.markdown`.  

Manual Deployment
-----------------

To run the Hubbub server you'll first need to install Node.JS and NPM which you can get [nodejs.org](http://nodejs.org).

To install the dependencies required by the Hubbub server run the following command from the project directory:

```
npm install
```

You can configure the Hubbub server component by adding a `local.json` file to the `config` directory, you can use `default.json` as a base. You'll need to configure the commenter user (should be a Github user created solely for this purpose) and the target site (you can configure more than one if you want, but you'll usually just want to supply a single default site).

Once you've created the configuration file you can run the server with this command:

```
PORT=8080 NODE_ENV=local node server.js
```

Once you've got the server running go to `http://127.0.0.1:8080/help`
to see instructions for integrating Hubbub into your blog (or read the instructions [through Github](https://github.com/almost/hubbub/blob/master/pages/help.md))

Contributing
------------

Pull Requests are very welcome. Check out the Github issues for a list of things that need doing (and please feel free to add your own).

We use Waffle.io to view Github issues, you can too if you want: [![Stories in Ready](https://badge.waffle.io/almost/hubbub.png?label=ready&title=Ready)](https://waffle.io/almost/hubbub)
