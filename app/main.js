$( document ).ready(function() {
    
    var analysis, totalAnalysis, filters, loginView, statusView, contentView, filtersView, datePicker, periodView, selectionView, dataTableView, totalKPIView, flowChartView, originView;

    squid_api.setup({
        "clientId" : "local",
        "projectId" : "els_flow_1",
    });
    
    var domainId = "usage";
    
    //var defaultSelection = null;
    
    var defaultSelection = {
            "facets" : [ {
                "dimension" : {
                    "id" : {
                        "projectId" : squid_api.projectId,
                        "domainId" : domainId,
                        "dimensionId" : "session_cre_dt"
                    }
                },
                "selectedItems" : [ {
                    "type" : "i",
                    "lowerBound" : "2014-07-16T00:00:00.000Z",
                    "upperBound" : "2014-07-31T00:00:00.000Z"
                } ]
            }, {
                "dimension" : {
                    "id" : {
                        "projectId" : squid_api.projectId,
                        "domainId" : domainId,
                        "dimensionId" : "usergroup"
                    }
                },
                "selectedItems" : [ {
                    "type" : "v",
                    "id" : -1,
                    "value" : "Customer"
                } ]
            } ]
    };
    
    analysis = new squid_api.controller.analysisjob.AnalysisModel();
    analysis.setDomainIds([domainId]);
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
    totalAnalysis.setDomainIds([domainId]);
    totalAnalysis.setMetricIds(["count", "withFTA"]);

    filters = new squid_api.controller.facetjob.FiltersModel();
    filters.setDomainIds([domainId]);
    filters.set("selection" , defaultSelection);
    
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
        model : filters,
        el : '#filters',
        booleanGroupName : "Goals",
        displayContinuous : false
    });

    datePicker = new squid_api.view.FiltersView({
        model : filters,
        el : '#date-picker',
        pickerVisible : true,
        refreshOnChange : false,
        displayCategorical : false
    });

    periodView = new squid_api.view.PeriodView({
        el : $('#date'),
        model : filters,
        format : d3.time.format("%Y-%m-%d")
    });

    selectionView = new squid_api.view.SelectionView({
        el : $('#selection'),
        model : filters
    });
    
    dataTableView = new squid_api.view.DataTableView({
        el : $('#analysis'),
        model : analysis,
        maxRowsPerPage : 20
    });
    
    totalView = new squid_api.view.DataTableView({
        el : $('#total'),
        model : totalAnalysis
    });
    
    totalKPIView = new squid_api.view.KPIView({
        el : $('#totalKPI'),
        model : totalAnalysis,
        format : d3.format(",.1f")
    });
    
    originView = new squid_api.view.DimensionSelector({
        el : $('#origin'),
        model : analysis
    })
    
    flowChartView = new squid_api.view.FlowChartView({
        el : $('#flowchart'),
        model : analysis,
        filterModel : filters
    });
    
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

    // datepicker modal buttons
    $("#modal2 .btn-primary").click(function() {
        datePicker.applySelection();
    });
    $("#modal2 .btn-default").click(function() {
        datePicker.cancelSelection();
    });
    
    // check for new filter selection
    filters.on('change:userSelection', function() {
        squid_api.controller.facetjob.compute(filters, filters.get("userSelection"));
    });
    
    // check for filters update
    filters.on('change:selection', function(data) {
        squid_api.controller.analysisjob.computeAnalysis(analysis, filters);
        squid_api.controller.analysisjob.computeAnalysis(totalAnalysis, filters);
    });
    
    // check for analysis origin update
    analysis.on('change:dimensions', function(data) {
        squid_api.controller.analysisjob.computeAnalysis(analysis, filters);
    });
    
    // check for project init performed
    squid_api.model.project.on('change', function(model) {
        // launch the filters computation
        squid_api.controller.facetjob.compute(filters);
    });
    
    /*
     * Start the App
     */
    squid_api.init();
});
