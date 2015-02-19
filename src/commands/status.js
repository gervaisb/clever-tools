var path = require("path");

var _ = require("lodash");
var Bacon = require("baconjs");

var AppConfig = require("../models/app_configuration.js");
var Application = require("../models/application.js");
var Git = require("../models/git.js")(path.resolve("."));
var Log = require("../models/log.js");

var Logger = require("../logger.js");

var displayGroupInfo = function(instances, commit) {
  return '(' + displayFlavors(instances) + ', ' +
         ' Commit: ' + (commit || 'N/A') +
         ')';
};

var displayFlavors = function(instances) {
  var sizes = _.map(instances, function(instance) {
    return instance.flavor.name;
  });

  return _(sizes)
          .groupBy()
          .pairs()
          .map(function(x) {
            return x[1].length + '*' + x[0];
          }).join(', ');
};

var computeStatus = function(instances) {
  var upInstances = _.filter(instances, function(instance) { return instance.state === 'UP'; });
  var isUp = !_.isEmpty(upInstances);
  var upCommit = _.head(_.pluck(upInstances, 'commit'));

  var isDeploying = !_.isEmpty(deployingInstances);
  var deployingInstances = _.filter(instances, function(instance) { return instance.state === 'DEPLOYING'; });
  var deployingCommit = _.head(_.pluck(upInstances, 'commit'));

  var statusLine = 'App status: ' + (isUp ? 'running ' +  displayGroupInfo(upInstances, upCommit) : 'stopped');
  var deploymentLine = isDeploying ? 'Deployment in progress ' + displayGroupInfo(deployingInstances, deployingCommit) : '';

  return [statusLine, deploymentLine].join('\n');
};

var displayScalability = function(scalability) {
  var vertical, horizontal, enabled = false;
  if(scalability.minFlavor.name === scalability.maxFlavor.name) {
    vertical = scalability.minFlavor.name;
  } else {
    vertical = scalability.minFlavor.name + ' to ' + scalability.maxFlavor.name;
    enabled = true;
  }

  if(scalability.minInstances === scalability.maxInstances) {
    horizontal = scalability.minInstances;
  } else {
    horizontal = scalability.minInstances + ' to ' + scalability.maxInstances;
    enabled = true;
  }

  return 'Scalability:\n' +
         '  Auto scalability: ' + (enabled ? 'enabled' : 'disabled') + '\n' +
         '  Scalers: ' + horizontal + '\n' +
         '  Sizes: ' + vertical;
};

var status = module.exports = function(api, params) {
  var alias = params.options.alias;

  var s_appData = AppConfig.getAppData(alias);
  var s_appInstances = s_appData.flatMapLatest(function(appData) {
    return Application.getInstances(api, appData.app_id, appData.org_id);
  });
  var s_app = s_appData.flatMapLatest(function(appData) {
    return Application.get(api, appData.app_id, appData.org_id);
  });


  s_appInstances
    .zip(s_app, function(instances, app) { return [instances, app]; })
    .onValue(function(data) {
      console.log(computeStatus(data[0]));
      console.log(displayScalability(data[1].instance));
    });
  s_appInstances.onError(Logger.error);
};