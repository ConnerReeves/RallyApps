Ext.define('ChartRenderer', {
  singleton: true,

  render: function(chartData) {
    if (chartData) {
      console.log(chartData);
      this.chartData = chartData;
    }

    Ext.getCmp('mainChartContainer').removeAll();
    Ext.getCmp('mainChartContainer').add({
      xtype: 'rallychart',
      id: 'mainChart',
      chartConfig: {
        chart: {
          type: '',
          zoomType: 'xy',
          spacingRight: 25,
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
              value: this.chartData.main.todayLineIndex,
              label: {
                text: 'Today',
                x: 7
              }
          }]
        },
        yAxis: {
          min: 0,
          max: this.chartData.main.scopeLineIndex * 1.075,
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
        legend: {
          enabled: false
        },
        tooltip: {
          enabled: false
        }
      },
      chartColors: _.pluck(this.chartData.main.series, 'color'),
      chartData: {
        categories: this.chartData.main.categories,
        series: this.chartData.main.series
      },
      listeners   : {
        afterrender : function() {
          this.unmask();
        }
      }
    });

    Ext.getCmp('histogramChartContainer').removeAll();
    _.delay(function() { //This solution sucks... Look into Deft chain
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
            formatter: function() {
              return (Math.round(this.y * 100) / 100) + '%';
            }
          },
          plotOptions: {
            column: {
              pointPadding: -.25,
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

    }, 100);

  }
});