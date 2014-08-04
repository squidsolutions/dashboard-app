$( document ).ready(function() {
    
    var analysis, totalAnalysis, filters, loginView, statusView, contentView, config, filtersView, datePicker, periodView, selectionView, dataTableView;
    
    config = {
        "customerId" : null,
        "clientId" : "local",
        "projectId" : "els_flow_1",
    };
    
    var domainId = "usage";
    
    var defaultSelection = {
            "facets" : [ {
                "dimension" : {
                    "id" : {
                        "projectId" : config.projectId,
                        "domainId" : domainId,
                        "dimensionId" : "session_cre_dt"
                    }
                },
                "selectedItems" : [ {
                    "type" : "i",
                    "lowerBound" : "2014-04-15T00:00:00.000Z",
                    "upperBound" : "2014-04-30T00:00:00.000Z"
                } ]
            }, {
                "dimension" : {
                    "id" : {
                        "projectId" : config.projectId,
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
    analysis.setProjectId(config.projectId);
    analysis.setDomainIds([domainId]);
    analysis.setDimensionIds(["step0","step1","step2"]);
    analysis.setMetricIds(["count"]);
    
    totalAnalysis = new squid_api.controller.analysisjob.AnalysisModel();
    totalAnalysis.setProjectId(config.projectId);
    totalAnalysis.setDomainIds([domainId]);
    totalAnalysis.setMetricIds(["count"]);

    filters = new squid_api.controller.facetjob.FiltersModel();
    filters.setProjectId(config.projectId);
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
        multiselectOptions : {nonSelectedText: 'ALL',maxHeight: 400, buttonClass: 'btn btn-link', enableFiltering: true, enableCaseInsensitiveFiltering: true},
        booleanGroupName : "Goals",
    });
    filtersView.displayContinuous = false;

    datePicker = new squid_api.view.FiltersView({
        model : filters,
        el : '#date-picker',
        pickerVisible : true,
        refreshOnChange : false
    });
    datePicker.displayCategorical = false;

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
        model : analysis
    });
    
    totalView = new squid_api.view.DataTableView({
        el : $('#total'),
        model : totalAnalysis
    });
    
    /*
     * Controller part
     */
    
    squid_api.model.login.on('change:login', function(model) {
        // performed when login is updated
        if (model.get("login")) {
            // login ok
            // compute the filters
            squid_api.controller.facetjob.compute(filters);
            // compute the analysis
            squid_api.controller.analysisjob.computeAnalysis(analysis, filters);
            squid_api.controller.analysisjob.computeAnalysis(totalAnalysis, filters);
        }
    });
    
    /*
     * Start the App
     */
    squid_api.init(config);
});
