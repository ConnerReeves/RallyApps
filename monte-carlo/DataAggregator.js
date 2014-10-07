Ext.define('DataAggregator', {
  singleton: true,

  parseChartData: function(chartData) {
    return DataAggregator._calculateIterationVelocities(chartData)
      .then(DataAggregator._projectFutureIterations);
  },

  _calculateIterationVelocities: function(chartData) {
    var deferred = Ext.create('Deft.Deferred');

    Deft.Promise.all(_.map(['HierarchicalRequirement', 'Defect'], function(modelName) {
      return function() {
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
          type: modelName,
          success: function(model) {
            model.getField('ScheduleState').getAllowedValueStore().load({
              callback: function(stateRecords, operation, success) {
                deferred.resolve(stateRecords[stateRecords.length - 1].get('StringValue'));
              }
            });
          }
        });
        return deferred.promise;
      }();
    })).then({
      success: function(finalStateNames) {
        chartData = _.sortBy(chartData, 'StartDate');

        _.each(chartData, function(iterationDetail, index) {
          if (iterationDetail.Name !== 'Backlog') {
            iterationDetail.Velocity = _.reduce(iterationDetail.WorkItems, function(sum, workItemRecord) {
              return sum + (_.contains(finalStateNames, workItemRecord.get('ScheduleState')) ? workItemRecord.get('PlanEstimate') : 0);
            }, 0);

            iterationDetail.AccumulatedVelocity = _.reduce(chartData, function(sum, iterationDetail) {
              return sum + (iterationDetail.Velocity || 0);
            }, 0);
          } else {
            iterationDetail.PlanEstimateTotal = _.reduce(iterationDetail.WorkItems, function(sum, workItemRecord) {
              return sum + (workItemRecord.get('PlanEstimate') || 0);
            }, 0);
          }
        });

        chartData = _.filter(chartData, function(iterationDetail) {
          return iterationDetail.Name === 'Backlog' || iterationDetail.Velocity > 0;
        });

        deferred.resolve(chartData);
      }
    });

    return deferred.promise;
  },

  _projectFutureIterations: function(chartData) {
    var pastIterationsData = _.first(chartData, chartData.length - 1);
    var backlogData = _.last(chartData, 1)[0];

    var initialProjectionValue = _.last(pastIterationsData, 1)[0].AccumulatedVelocity;

    var worstIterationVelocity = _.min(_.pluck(pastIterationsData, 'Velocity'));
    var bestIterationVelocity = _.max(_.pluck(pastIterationsData, 'Velocity'));
    var maxProjectedIterationsCount = Math.ceil(backlogData.PlanEstimateTotal / worstIterationVelocity);

    var averageIterationVelocity = _.reduce(pastIterationsData, function(sum, iterationDetail) {
      return sum + iterationDetail.Velocity;
    }, 0) / pastIterationsData.length;

    var maxProjectionValue = initialProjectionValue + backlogData.PlanEstimateTotal;

    console.log('backlog data', backlogData);
    console.log('initial projection', initialProjectionValue);
    console.log('best velocity', bestIterationVelocity);
    console.log('worst velocity', worstIterationVelocity);
    console.log('average velocity', averageIterationVelocity);

    //Get future iterations
    Ext.create('Rally.data.WsapiDataStore', {
      limit: maxProjectedIterationsCount,
      model: 'Iteration',
      fetch: ['Name', 'StartDate', 'EndDate'],
      filters: [{
        property: 'Project.ObjectID',
        value: Rally.environment.getContext().getProject().ObjectID
      },{
        property: 'EndDate',
        operator: '>=',
        value: Rally.util.DateTime.toIsoString(new Date())
      }]
    }).load().then(function(futureIterationRecords) {
      var futureIterationsData = _.map(futureIterationRecords, function(futureIterationRecord, index) {
        return {
          Name: futureIterationRecord.get('Name'),
          StartDate: futureIterationRecord.get('StartDate'),
          EndDate: futureIterationRecord.get('EndDate'),
          OuterProjection: [
            Math.min(maxProjectionValue, initialProjectionValue + (worstIterationVelocity * index)),
            Math.min(maxProjectionValue, initialProjectionValue + (bestIterationVelocity * index))
          ],
          MeanProjection: Math.min(maxProjectionValue, initialProjectionValue + (averageIterationVelocity * index))
        };
      });

      console.log(futureIterationsData);
    });

    return chartData;
  }
});