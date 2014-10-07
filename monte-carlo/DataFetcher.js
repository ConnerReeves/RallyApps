Ext.define('DataFetcher', {
  singleton: true,

  getChartData: function() {
    return Deft.Chain.pipeline([
      DataFetcher._getUnhydratedWorkItemRecords,
      DataFetcher._hydrateIterationValues
    ], this);
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
  }
});