Ext.define('DataFetcher', {
  singleton: true,

  _getWorkItems: function(piOID) {
    this.piOID = piOID;

    Deft.Chain.pipeline([
      this._getUnhydratedWorkItemRecords,
      this._hydrateIterationValues,
      this._calculateIterationVelocities
    ], this).then({
      success: function(out) {
        console.log(out);
      }
    });
  },

  _getUnhydratedWorkItemRecords: function() {
    var deferred = Ext.create('Deft.Deferred');
    Ext.create('Rally.data.lookback.SnapshotStore', {
      limit: Infinity,
      fetch: ['FormattedID', 'Iteration', 'PlanEstimate', 'ScheduleState'],
      hydrate: ['ScheduleState'],
      filters: [{
        property: '__At',
        value: 'current'
      },{
        property: '_TypeHierarchy',
        operator: 'in',
        value: ['Defect', 'HierarchicalRequirement']
      },{
        property: '_ItemHierarchy',
        value: this.piOID
      },{
        property: 'PlanEstimate',
        operator: '>',
        value: 0
      },{
        property: 'Children',
        value: null
      }]
    }).load({
      params : {
        removeUnauthorizedSnapshots: true
      },
      callback: function(workItemRecords, operation, success) {
        if (success && workItemRecords.length) {
          deferred.resolve(workItemRecords);
        } else {
          deferred.reject('No artifacts found.');
        }
      }
    });
    return deferred.promise;
  },

  _hydrateIterationValues: function(workItemRecords) {
    var deferred = Ext.create('Deft.Deferred');

    var iterationOIDs = _.filter(_.unique(_.map(workItemRecords, function(workItemRecord) {
      return workItemRecord.get('Iteration');
    })), function(OID) {
      return OID;
    });

    var iterationFilter = Rally.data.QueryFilter.or(_.map(iterationOIDs, function(OID) {
      return {
        property: 'ObjectID',
        value: OID
      };
    }));

    Ext.create('Rally.data.WsapiDataStore', {
      model: 'Iteration',
      fetch: ['Name', 'StartDate', 'EndDate'],
      filters: iterationFilter
    }).load().then(function(iterationRecords) {
      var iterationRecordsTwo = iterationRecords;

      var iterationNameMap = _.zipObject(_.map(iterationRecords, function(iterationRecord) {
        return iterationRecord.get('ObjectID');
      }), _.map(iterationRecords, function(iterationRecord) {
        return iterationRecord.get('Name');
      }));

      var iterationDataMap = _.zipObject(_.map(iterationRecords, function(iterationRecord) {
        return iterationRecord.get('Name');
      }), _.map(iterationRecords, function(iterationRecord) {
        return {
          Name: iterationRecord.get('Name'),
          StartDate: iterationRecord.get('StartDate'),
          EndDate: iterationRecord.get('EndDate'),
          WorkItems: []
        };
      }));

      iterationDataMap.Backlog = {
        Name: 'Backlog',
        WorkItems: []
      };

      _.each(workItemRecords, function(workItemRecord) {
        if (iterationDataMap[iterationNameMap[workItemRecord.get('Iteration')]]) {
          iterationDataMap[iterationNameMap[workItemRecord.get('Iteration')]].WorkItems.push(workItemRecord);
        } else {
          iterationDataMap.Backlog.WorkItems.push(workItemRecord);
        }
      });

      deferred.resolve(_.values(iterationDataMap));
    });

    return deferred.promise;
  },

  _calculateIterationVelocities: function(iterationGroups) {
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
        _.each(iterationGroups, function(workItemRecords, iterationName) {
          console.log(iterationName);
        });
      }
    });

    return deferred.promise;
  }
});

// {
//   'Iteration 1': {
//     StartDate:
//     EndDate:
//     WorkItems: []
//   }
// }