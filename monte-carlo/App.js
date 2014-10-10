Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    layout: 'border',

    launch: function() {
      this._setupUI();

      // this.activePortfolioItem = {
      //   piOID: 19728385560,
      //   title: 'I3180: New Iteration Status Page - Improve Performance and Make Default'
      // };

      // this._update();
    },

    _update: function() {
      Ext.getCmp('mainChartContainer').removeAll();
      Ext.getCmp('histogramChartContainer').removeAll();
      Ext.getBody().mask('Loading');

      Ext.getCmp('activePortfolioItemContainer').update(this.activePortfolioItem.title);

      Deft.Chain.pipeline([
        DataFetcher.getChartData,
        DataAggregator.parseChartData
      ], this).then({
        success: ChartRenderer.render,
        failure: this._showErrorMsg,
        scope: ChartRenderer
      });
    },

    _showErrorMsg: function(err) {
      Ext.getBody().unmask();

      if (err) {
        Rally.ui.notify.Notifier.showError({
          message: err,
          duration: 5000
        });
      }
    },

    _setupUI: function() {
      this.add([{
        region: 'center',
        xtype: 'container',
        layout: 'border',
        defaults: {
          xtype: 'container',
          style: {
            background: 'white'
          }
        },
        listeners: {
          resize: function(me, width, height, oldWidth, oldHeight) {
            if (height !== oldHeight && Ext.getCmp('mainChart')) {
              ChartRenderer.render();
            }
          }
        },
        items: [{
          region: 'north',
          xtype: 'container',
          layout: 'hbox',
          style: {
            background: '#FFF'
          },
          defaults: {
            margin: '3 0 3 3',
            height: 33,
            width: 33
          },
          items: [{
            xtype: 'rallybutton',
            text: '<span class="icon-refresh icon-large"></span>',
            listeners: {
              click: this._update,
              scope: this
            }
          },{
            xtype: 'rallybutton',
            id: 'gearBtn',
            text: '<span class="icon-gear icon-large"></span>',
            toolTipConfig: {
              html: 'Add a Portfolio Item...',
              anchor: 'right',
              width: 140,
              showDelay: 5000
            },
            arrowCls: '',
            menu: {
              xtype: 'menu',
              items: [{
                text: 'Change Portfolio Item',
                listeners: {
                  click: this._changePortfolioItem,
                  scope: this
                }
              },{
                text: 'Projection Permutations',
                menu: {
                  xtype: 'menu',
                  defaults: {
                    xtype: 'menucheckitem',
                    group: 'projectionPermutations',
                    handler: function(item) {
                      DataAggregator.permutationCount = item.val;
                      this._update();
                    },
                    scope: this
                  },
                  items: [{
                    text: 'High (1,000,000)',
                    val: 1000000
                  },{
                    text: 'Medium (100,000)',
                    checked: true,
                    val: 100000
                  },{
                    text: 'Low (10,000)',
                    val: 10000
                  },{
                    text: 'Very Low (1,000)',
                    val: 1000
                  }]
                }
              },{
                text: 'Visualization Granularity',
                menu: {
                  xtype: 'menu',
                  defaults: {
                    xtype: 'menucheckitem',
                    group: 'visualizationGranularity',
                    handler: function(item) {
                      DataAggregator.visualizationGranularity = item.val;
                      this._update();
                    },
                    scope: this
                  },
                  items: [{
                    text: 'Very High (250)',
                    val: 250
                  },{
                    text: 'High (100)',
                    val: 100
                  },{
                    text: 'Medium (50)',
                    val: 50,
                    checked: true
                  },{
                    text: 'Low (10)',
                    val: 10
                  }]
                }
              }]
            }
          },{
            xtype: 'component',
            id: 'activePortfolioItemContainer',
            margin: '12 0 0 15',
            flex: 1,
            style: {
              fontSize: '13px',
              fontFamily: 'ProximaNova,Helvetica',
              textTransform: 'uppercase'
            },
            listeners: {
              afterrender: function() {
                _.delay(function() {
                  Ext.getCmp('gearBtn').toolTip.show();
                }, 500);
              }
            }
          }]
        },{
          region: 'center',
          id: 'mainChartContainer'
        }]
      },{
        region: 'east',
        collapsible: true,
        collapsed: true,
        resizable: true,
        stateful: true,
        stateId: 'histogram-container-state',
        border: false,
        title: 'Frequency Histogram',
        id: 'histogramChartContainer',
        width: 500,
        minWidth: 300,
        maxWidth: 700,
        style: {
          borderLeft: '1px solid #D6D6D6'
        }
      }]);
    },

    _changePortfolioItem: function() {
      Deft.Chain.pipeline([
        this._selectNewPortfolioItem,
        this._saveSelectedPortfolioItem
      ], this).then({
        success: function() {
          Rally.ui.notify.Notifier.show({
            message  : 'Settings saved successfully.',
            duration : 3000
          });

          this._update();
        },
        failure: this._showErrorMsg,
        scope: this
      });
    },

    _selectNewPortfolioItem: function() {
      var deferred = Ext.create('Deft.Deferred');

      Ext.create('Rally.data.WsapiDataStore', {
        model: 'TypeDefinition',
        filters: [{
          property: 'TypePath',
          operator: 'contains',
          value: 'PortfolioItem/'
        }]
      }).load().then(function(typeDefRecords) {
        var modelNames = _.map(typeDefRecords, function(typeDefRecord) {
          return typeDefRecord.get('TypePath');
        });

        Ext.create('Rally.ui.dialog.ChooserDialog', {
            title: 'Choose Portfolio Item',
            selectionButtonText: 'Save',
            artifactTypes: modelNames,
            autoShow: true,
            modal: true,
            height: 510,
            width: 700,
            movable: true,
            columns: [{
                dataIndex: 'FormattedID',
                maxWidth: 65
            },{
                dataIndex: 'Name',
                flex: 1
            }],
            storeConfig: {
                context: {
                  project: '/project/10823784037',
                  projectScopeDown: true
                },
                pageSize: 20000,
                sorters: [{
                    property: 'FormattedID',
                    direction: 'ASC'
                }]
            },
            gridConfig: {
                showPagingToolbar: false,
                margin: '5 0 11 0',
                style: {
                    borderBottom: '2px solid #888888'
                }
            },
            listeners: {
                artifactChosen: function(artifact, scope) {
                  if (artifact) {
                    scope.artifactHasBeenChosen = true;
                    deferred.resolve(artifact);
                  }
                },
                close: function(chooser, scope) {
                  if (!scope.artifactHasBeenChosen) {
                    deferred.reject();
                  }
                },
                artifactHasBeenChosen: false,
                scope: this
            }
        });
      });
      return deferred.promise;
    },

    _saveSelectedPortfolioItem: function(selectedRecord) {
      var deferred = Ext.create('Deft.Deferred');

      this.activePortfolioItem = {
        piOID: selectedRecord.get('ObjectID'),
        title: selectedRecord.get('FormattedID') + ': ' + selectedRecord.get('Name')
      };

      deferred.resolve();

      // Rally.data.PreferenceManager.update({
      //   filterByUser: true,
      //   settings: {
      //     'monte-carlo-portfolio-item-oid': selectedRecord.get('ObjectID')
      //   }
      // });
      return deferred.promise;
    },

    _getSavedPortfolioItem: function() {
      var deferred = Ext.create('Deft.Deferred');
      deferred.resolve(19728385560); //I3180
      return deferred.promise;

      // Rally.data.PreferenceManager.load({
      //   filterByUser: true,
      //   success: function(prefs) {
      //       deferred.resolve(Ext.JSON.decode(prefs.selectedFeatureOIDs));
      //   },
      //   scope: this
      // });
    }
});
