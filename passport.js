(function() {
  var LocalStrategy, bcrypt, db, passport;

  db = require("redis").createClient();

  bcrypt = require('bcryptjs');

  passport = require('passport');

  LocalStrategy = require('passport-local').Strategy;

  passport.serializeUser(function(user, done) {
    return done(null, user.username.toLowerCase());
  });

  passport.deserializeUser(function(username, done) {
    return db.hgetall("user:" + username.toLowerCase(), function(err, user) {
      return done(null, user);
    });
  });

  passport.use(new LocalStrategy(function(username, password, done) {
    return db.hget("user:" + username.toLowerCase(), 'password', function(err, hash) {
      if (err) {
        return done(err);
      }
      if (hash) {
        return bcrypt.compare(password, hash, function(err, match) {
          if (match) {
            return db.hgetall("user:" + username.toLowerCase(), function(err, user) {
              return done(null, user);
            });
          } else {
            return done(null, false);
          }
        });
      } else {
        return done(null, false);
      }
    });
  }));

  module.exports = passport;

}).call(this);
