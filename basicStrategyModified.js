const { BasicStrategy } = require('passport-http');

class BasicStrategyModified extends BasicStrategy {
  constructor(options, verify) {
    super(options, verify);
  }

  _challenge() {
    return 'xBasic realm="' + this._realm + '"';
  }
}

module.exports = BasicStrategyModified;