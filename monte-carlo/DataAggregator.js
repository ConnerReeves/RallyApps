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
    var deferred = Ext.create('Deft.Deferred');
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

    //Get future iterations
    console.log(maxProjectedIterationsCount)
    Ext.create('Rally.data.WsapiDataStore', {
      limit: maxProjectedIterationsCount,
      model: 'Iteration',
      fetch: ['Name'],
      filters: [{
        property: 'Project.ObjectID',
        value: Rally.environment.getContext().getProject().ObjectID
      },{
        property: 'EndDate',
        operator: '>=',
        value: Rally.util.DateTime.toIsoString(new Date())
      }]
    }).load().then(function(futureIterationRecords) {
      var mainChartCategories = _.map(pastIterationsData, function(pastIteration) {
        return pastIteration.Name;
      }).concat(_.map(futureIterationRecords, function(futureIterationRecord) {
        return futureIterationRecord.get('Name');
      })); 

      var projectionOuterRangeSeries = {
        name: 'Outer Projection Range',
        type: 'arearange',
        color: '#E6E6E6',
        data: _.map(_.range(pastIterationsData.length - 1), function(pastIterationNumber) {
          return [null, null];
        }).concat(_.map(futureIterationRecords, function(futureIterationRecord, projectionIndex) {
          return [
            Math.min(maxProjectionValue, initialProjectionValue + (worstIterationVelocity * projectionIndex)),
            Math.min(maxProjectionValue, initialProjectionValue + (bestIterationVelocity * projectionIndex))
          ];
        }))
      };

      var pastIterationsBurnupSeries = {
        name: 'Past Iteration Burnup',
        type: 'line',
        color: '#FF8200',
        data: _.map(pastIterationsData, function(pastIteration) {
          return pastIteration.AccumulatedVelocity;
        })
      };

      var completionIterationIndices = [];
      var projectionSeries = _.map(_.range(1, 50001), function(projectionNumber) {
        var projectionValue = _.last(pastIterationsData, 1)[0].AccumulatedVelocity; 
        
        var projectionData = _.map(_.range(pastIterationsData.length - 1), function(pastIterationNumber) {
          return null;
        }).concat(_.map(_.range(maxProjectedIterationsCount), function(futureIterationNumber) {
          if (projectionValue === maxProjectionValue) {
            return null;
          } else if (futureIterationNumber) {
            projectionValue += pastIterationsData[_.random(0, pastIterationsData.length - 1)].Velocity;
            
            if (projectionValue >= maxProjectionValue) {
              completionIterationIndices.push(futureIterationNumber);
              projectionValue = maxProjectionValue;
            }

            projectionValue = projectionValue;
          }
          
          return projectionValue;
        }));

        return {
          name: 'Projection ' + projectionNumber,
          type: 'line',
          color: '#00A9E0',
          dashStyle: 'ShortDash',
          lineWidth: 1,
          marker: {
            enabled: false
          },
          data: _.first(projectionData, pastIterationsData.length + futureIterationRecords.length - 1) //Remove unscheduled iterations
        };
      });

      var histogramCategories = _.range(_.min(completionIterationIndices), _.max(completionIterationIndices) + 1);
      var histogramCounts = _.countBy(completionIterationIndices);
      var histogramSeries = {
        name: 'Data',
        data: _.map(histogramCategories, function(iterationIndex) {
          return ((histogramCounts[iterationIndex] || 0) / completionIterationIndices.length) * 100;
        })
      };

      if (projectionSeries.length > 50) {
        projectionSeries = _.first(projectionSeries, 50);
      }

      deferred.resolve({
        main: {
          categories: mainChartCategories,
          series: _.flatten([pastIterationsBurnupSeries, projectionOuterRangeSeries, projectionSeries]),
          todayLineIndex: pastIterationsData.length - 1,
          scopeLineIndex: _.last(pastIterationsData, 1)[0].AccumulatedVelocity + backlogData.PlanEstimateTotal
        },
        histogram: {
          categories: histogramCategories,
          series: [histogramSeries]
        }
      });
    });

    return deferred.promise;
  }
});