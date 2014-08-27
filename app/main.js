$( document ).ready(function() {
    
    var analysis, totalAnalysis, filters, loginView, statusView, contentView, filtersView, datePicker, periodView, selectionView, dataTableView, totalKPIView, flowChartView, originView;

    squid_api.setup({
        "clientId" : "local",
        "projectId" : "els_flow_1",
        "domainId" : "usage",
        "selection" : {
            "date" : {
                "dimensionId" : "session_cre_dt",
                "lowerBound" : "2014-07-16",
                "upperBound" : "2014-07-31"
            }
        }
    });
    
    analysis = new squid_api.controller.analysisjob.AnalysisModel();
    analysis.setDimensionIds(["origin", "step0","step1","step2"]);
    analysis.setMetricIds(["count", "withFTA"]);
    analysis.set({
        "selectedMetric" : {
            "oid" : "count"
        },
        "primaryMetric" : {
            "oid" : "count"
        },
        "secondaryMetric" : {
            "oid" : "sum_fta"
        }
    });
    
    totalAnalysis = new squid_api.controller.analysisjob.AnalysisModel();
    totalAnalysis.setMetricIds(["count", "withFTA"]);

    
    /*
     * Declare the views 
     */
     
    loginView = new squid_api.view.LoginView({
        el : '#login',
        autoShow : false
    });
    
    statusView = new squid_api.view.StatusView({
        el : '#status'
    });

    filtersView = new squid_api.view.FiltersView({
        el : '#filters',
        booleanGroupName : "Goals",
        displayContinuous : false
    });

    periodView = new squid_api.view.PeriodSelectionView({
        el : '#date',
        datePickerEl : $('#picker'),
        format : d3.time.format("%Y-%m-%d")
    });

    selectionView = new squid_api.view.SelectionView({
        el : '#selection',
    });
    
    dataTableView = new squid_api.view.DataTableView({
        el : '#analysis',
        model : analysis,
        maxRowsPerPage : 20
    });
    
    totalView = new squid_api.view.DataTableView({
        el : '#total',
        model : totalAnalysis
    });
    
    totalKPIView = new squid_api.view.KPIView({
        el : '#totalKPI',
        model : totalAnalysis,
        format : d3.format(",.1f")
    });
    
    originView = new squid_api.view.DimensionSelector({
        el : '#origin',
        model : analysis
    })
    
    /*
    flowChartView = new squid_api.view.FlowChartView({
        el : '#flowchart',
        model : analysis,
        filterModel : filters
    });
    */
    
    /*
     * Controller part
     */
    
    // filters modal buttons
    $("#modal3 .btn-primary").click(function() {
        filtersView.applySelection();
    });
    $("#modal3 .btn-default").click(function() {
        filtersView.cancelSelection();
    });
    
    // check for filters update
    squid_api.model.filters.on('change:selection', function(data) {
        squid_api.controller.analysisjob.compute(analysis);
        squid_api.controller.analysisjob.compute(totalAnalysis);
    });
    
    // check for analysis origin update
    analysis.on('change:dimensions', function(data) {
        squid_api.controller.analysisjob.compute(analysis);
    });
    
    /*
     * Start the App
     */
    squid_api.init();
});
