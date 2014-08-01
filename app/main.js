$( document ).ready(function() {
    
    var loginView, statusView, contentView, config, filtersView, datePicker, periodView, selectionView;
    
    config = {
        "customerId" : null,
        "clientId" : "local",
        "projectId" : "els_flow_1",
    };

    var domainId = "usage";

    var filters = new squid_api.controller.facetjob.FiltersModel();
    filters.setProjectId(config.projectId);
    filters.setDomainIds([domainId]);
    
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
    
    /*
     * Controller part
     */
    
    squid_api.model.login.on('change:login', function(model) {
        // performed when login is updated
        if (model.get("login")) {
            // login ok
            squid_api.controller.facetjob.compute(filters);
        }
    });
    
    /*
     * Start the App
     */
    squid_api.init(config);
});
