Ext.define('ChartRenderer', {
  singleton: true,

  render: function(chartData) {
    if (chartData) {
      this.chartData = chartData;
    }

    Ext.getBody().unmask();
    this._drawMainChart();
    this._drawHistogram();
  },

  _drawMainChart: function() {
    Ext.getCmp('mainChartContainer').removeAll();
    Ext.getCmp('mainChartContainer').add({
      xtype: 'rallychart',
      id: 'mainChart',
      chartConfig: {
        chart: {
          type: '',
          zoomType: 'xy',
          spacingBottom: 50,
          height: Ext.getCmp('mainChartContainer').getHeight()
        },
        title: {
          text: ''
        },
        xAxis: {
          labels: {
            y: 21
          },
          tickmarkPlacement: 'on',
          plotLines: [{
              color: '#FAD200',
              width: 2,
              value: this.chartData.main.currentIterationIndex,
              zIndex: 10,
              label: {
                text: 'Current Iteration',
                x: 7
              }
          },{
            color: '#FAD200',
              width: 2,
              value: this.chartData.main.lastDefinedIterationIndex,
              zIndex: 10,
              label: {
                text: 'Last Defined Iteration',
                x: 7
              }
          }]
        },
        yAxis: {
          min: 0,
          maxPadding: Ext.getCmp('mainChartContainer').getHeight() >= 700 ? 0.3 : 0.5,
          endOnTick: false,
          title: {
            text: 'Points'
          },
          plotLines: [{
            color: '#8DC63F',
            width: 2,
            value: this.chartData.main.scopeLineIndex,
            label: {
              text: 'Current Scope',
              y: -7
            },
            zIndex: 5
          }]
        },
        tooltip: {
          enabled: false,
          crosshairs: [{
            width: 2,
            zIndex: 9
          }]
        },
        legend: {
          margin: 24,
          y: 30,
          itemHoverStyle: {
            cursor: 'default'
          }
        },
        plotOptions: {
          line: {
            events: {
              legendItemClick: function () {
                return false;
              }
            }
          },
          arearange: {
            lineWidth: 1,
            lineColor: '#C0C0C0',
            events: {
              legendItemClick: function () {
                return false;
              }
            }
          },
          series: {
            animation: false,
            states: {
              hover: {
                enabled: false
              }
            }
          },
          allowPointSelect: false
        }
      },
      chartColors: _.pluck(this.chartData.main.series, 'color'),
      chartData: {
        categories: this.chartData.main.categories,
        series: this.chartData.main.series
      },
      listeners   : {
        afterrender: function() {
          this.unmask();
        }
      }
    });
  },

  _drawHistogram: function() {
    Ext.getCmp('histogramChartContainer').removeAll();
    Ext.getCmp('histogramChartContainer').add({
      xtype: 'rallychart',
      id: 'histogramChart',
      chartConfig: {
        chart: {
          type: 'column',
          height: Ext.getCmp('mainChartContainer').getHeight()
        },
        title: {
          text: ''
        },
        xAxis: {
          title: {
            text: 'Future Iterations'
          }
        },
        yAxis: {
          min: 0,
          endOnTick: false,
          opposite: true,
          allowDecimals: false,
          title: {
            text: 'Frequency'
          },
          labels: {
            formatter: function() {
              return this.value + '%';
            }
          }
        },
        legend: {
          enabled: false
        },
        tooltip: {
          useHTML: true,
          formatter: function() {
            var onOrBeforePercentage = _.reduce(this.series.data, function(sum, seriesPoint) {
              return sum + (seriesPoint.category <= this.x ? seriesPoint.y : 0);
            }, 0, this);

            var tooltipTable = (
              '<table>' +
                '<tr><td style="text-align:right">This Iteration:</td><td>' + (Math.round(this.y * 100) / 100) + '%</td></tr>' +
                '<tr><td style="text-align:right">On or Before:</td><td>' + (Math.round(onOrBeforePercentage * 100) / 100) + '%</td></tr>' +
              '</table>'
            );

            return tooltipTable;
          }
        },
        plotOptions: {
          series: {
            animation: false
          },
          column: {
            pointPadding: -0.25,
            borderWidth: 0
          }
        }
      },
      chartData: {
        categories: ChartRenderer.chartData.histogram.categories,
        series: ChartRenderer.chartData.histogram.series
      },
      chartColors: ['#00A9E0'],
      listeners: {
        afterrender : function() {
          this.unmask();
        }
      }
    });
  }
});