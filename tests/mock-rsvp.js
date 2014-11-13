var _ = require('underscore');

function MockRSVP(label) {
  this.label = label;
  this.state = "pending";
  this._dones = [];
  this._errors = [];

  _.bindAll(this, 'resolve', 'reject');
}

MockRSVP.prototype = {
  then: function (done, error) {
    var me = this;
    var downstream = new MockRSVP('downstream: ' + this.label);

    function makeHandler(callback, resultKey) {
      return function () {
        var result;
        try {
          result = callback(me[resultKey]);
        } catch (e) {
          downstream.reject(e);
          return;
        }
        if (_.isObject(result) && result.then) {
          result.then(downstream.resolve, downstream.reject);
        } else {
          downstream.resolve(result);
        }
      };
    }
    
    this._dones.push(makeHandler(done || _.identity, 'value'));
    this._errors.push(makeHandler(error || function (e) { throw e; }, 'error'));

    this._callCallbacks();
    return downstream;
  },
  "catch": function (error) {
    return this.then(null, error);
  },
  
  resolve: function (value) {
    if (this.state !== "pending") {
      throw new Error("Resolve twice!");
    }
    this.state = "resolved";
    this.value = value;
    this._callCallbacks();
  },
  reject: function (error) {
    if (this.state !== "pending") {
      throw new Error("Resolve twice!");
    }
    this.state = "rejected";
    this.error = error;
    this._callCallbacks();
  },
  _callCallbacks: function () {
    var call = function (f) { f(); };
    if (this.state === "resolved") {
      var dones = this._dones;
      this._dones = [];
      _.each(dones, call);
    } else if (this.state === "rejected") {
      var errors = this._errors;
      this._errors = [];
      _.each(errors, call);
    }
  }
};

module.exports = MockRSVP;
