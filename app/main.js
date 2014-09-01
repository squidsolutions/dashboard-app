$( document ).ready(function() {

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
    
    var analysis = new squid_api.controller.analysisjob.AnalysisModel();
    analysis.setDimensionIds(["origin", "step0","step1","step2"]);
    analysis.setMetricIds(["count", "withFTA"]);
    
    var totalAnalysis = new squid_api.controller.analysisjob.AnalysisModel();
    totalAnalysis.setMetricIds(["count", "withFTA"]);

    /*
     * Declare the views 
     */
     
    var loginView = new squid_api.view.LoginView({
        el : '#login',
        autoShow : false
    });
    
    var statusView = new squid_api.view.StatusView({
        el : '#status'
    });

    var filtersView = new squid_api.view.FiltersSelectionView({
        el : '#selection',
        filtersEl : $('#filters'),
        booleanGroupName : "Goals"
    });

    var periodView = new squid_api.view.PeriodSelectionView({
        el : '#date',
        datePickerEl : $('#picker'),
        format : d3.time.format("%Y-%m-%d")
    });

    /*
    var dataTableView = new squid_api.view.DataTableView({
        el : '#analysis',
        model : analysis,
        maxRowsPerPage : 20
    });
    */
    
    var totalView = new squid_api.view.DataTableView({
        el : '#total',
        model : totalAnalysis
    });
    
    var totalKPIView = new squid_api.view.KPIView({
        el : '#totalKPI',
        model : totalAnalysis,
        format : d3.format(",.1f")
    });
    
    var originView = new squid_api.view.DimensionSelector({
        el : '#origin',
        model : analysis
    })
    
    var flowChartView = new squid_api.view.FlowChartView({
        el : '#flowchart',
        model : analysis,
        filterModel : filters
    });
    
    /*
     * Controller part
     */
    
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
