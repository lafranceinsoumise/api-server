const deepEqual = require('deep-equal');

exports.anyPropChanged = function(item, props) {
  return Object.keys(props).some((key) =>(
    !deepEqual(props[key], item[key])
  ));
};

exports.getDifferentProps = function(item, props) {
  let res = {};

  for(let key of Object.keys(props)) {
    if(!deepEqual(props[key], item[key])) {
      res[key] = {'existing': item[key], 'new': props[key]};
    }
  }

  return res;
};
