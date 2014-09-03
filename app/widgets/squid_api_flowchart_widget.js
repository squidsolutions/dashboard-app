(function (root, factory) {
    root.squid_api.view.FlowChartView = factory(
            root.Backbone, 
            app.template.sankey, 
            app.template.sankeyHeader, 
            app.template.sankeyTipNode, 
            app.template.sankeyTipLink);
}(this, function (Backbone, template, templateHeader, templateTipNode, templateTipLink) {

    var View = Backbone.View.extend( {

        titleMaxChars : 30, /* the maximum number of characters for a node title */
        
        thresholdValue : 42, /* don't ask why */

        sankeyD3 : null,

        energyData : null,

        filterModel : null,

        displayOptionModel : null,
        
        analyses : null,
        
        rendering : false,
        
        primaryMetric : null,
        
        secondaryMetric : null,

        initialize : function(options) {
            if (this.model) {
                this.model.set({"threshold":this.thresholdValue});
                this.model.on('change:status', this.update, this);
                this.model.on('change:error', this.render, this);
                this.model.on('change:threshold', function() {
                        this.render(false);
                    }, this);
            }
            if (options.filterModel) {
                this.filterModel = options.filterModel;
            }
            if (options.displayOptionModel) {
                this.displayOptionModel = options.displayOptionModel;
            } else {
                var DisplayOptionModel = Backbone.Model.extend();
                this.displayOptionModel = new DisplayOptionModel({displayScaleForNodes : true});
            }
            this.displayOptionModel.on('change:displayScaleForNodes', function() {this.render(true);}, this);
            $(window).on("resize", _.bind(this.resize(),this));
        },

        resize : function() {
            var resizing = true;
            return function() {
                if (this.resizing) {
                    window.clearTimeout(resizing);
                }
                this.resizing = window.setTimeout(_.bind(this.render,this), 100);
            }
        },

        setModel : function(model) {
            this.model = model;
            this.initialize();
        },

        events: {
            "input .threshold-selector": function(event) {
                if (this.model) {
                    if (!this.rendering) {
                        this.model.set({"threshold" : event.target.value});
                    } else {
                        this.$el.find(".threshold-selector").val(this.thresholdValue);
                    }
                }
            }
        },

        update : function() {
            var energy, analyses;
            if (this.model.isDone()) {
                analyses = this.model.get("analyses");
                if (!analyses) {
                    // single analysis
                    analyses = [this.model];
                }
                this.analyses = analyses;
                var energy = null;
                for (var i=0;i<this.analyses.length;i++) {
                    var result = this.analyses[i].get("results");
                    if (result) {
                        energy = energy?this.buildEnergyDataSet(result,energy):this.buildEnergyDataSet(result);
                    } else {
                        energy = null;
                        break;
                    }
                }
                this.energyData = energy;
            } else {
                this.energyData = null;
            }
            if (this.energyData) {
                if (this.energyData.subtotals[0]) {
                    this.model.set("total",this.energyData.subtotals[0]);
                } else {
                    this.model.set("total",0);
                }
            } else {
                this.model.set("total",null);
            }
            this.render(true);
        },

        render : function(slowmo) {
            
            this.rendering = true;
            this.thresholdValue = this.model.get("threshold");

            windowHeight = $(window).height();
            if (windowHeight<600) {
                windowHeight=600;
            }
            var sankeyHeight = windowHeight-50-45-77-5;
            $(".sq-widget").css({"height":sankeyHeight});
            if (!this.sankeyD3) {
                var html = template({"linksValuesThreshold" : this.model.get("threshold"), "headerCols" : [], "loading":true});
                this.$el.html(html);
            }
            if (!this.model.isDone()) {
                // running
                this.$el.find(".sq-content").show();
                if (this.model.get("status") == "RUNNING") {
                    this.$el.find(".sq-loading").show();
                }
                this.$el.find(".sq-error").hide();
            } else if (this.model.get("error")) {
                // error
                this.$el.find(".sq-error").show();
                this.$el.find(".sq-content").hide();
                this.$el.find(".sq-wait").hide();
            } else {
                // display
                var sankeyWidth = this.$el.width();
                // build the header
                var headerCols = [];
                var headerColsCnt = this.energyData.stepCount;
                var headerWidth = Math.round((sankeyWidth)/headerColsCnt);
                if (this.energyData && this.energyData.subtotals && this.energyData.subtotals.length<headerColsCnt) {// handle null columns
                    sankeyWidth = (headerWidth)* this.energyData.subtotals.length;
                }
                var formatPercent = d3.format(",.0f");
                for (var i=1; i<headerColsCnt; i++) {
                    headerCols.push({
                        "label":this.energyData.cols[i].lname, 
                        "width" : headerWidth,
                        "subtotal" : this.energyData.subtotals[i],
                        "value" : (!this.energyData.subtotals?"No data":(!this.energyData.subtotals[i]?"0%":formatPercent(this.energyData.subtotals[i]/this.energyData.subtotals[0]*100)+"%"))
                    });
                }
                this.$el.find(".sq-loading").hide();
                var html = templateHeader({"headerCols" : headerCols, "width" : headerWidth});
                this.$el.find(".sq-header").html(html);

                // add the origin view
                var domains = squid_api.model.project.get("domains");
                for (var domainIdx = 0; domainIdx < domains.length; domainIdx++) {
                    var dom = domains[domainIdx];
                    if (dom.oid == this.analyses[0].get("domains")[0].domainId) {
                        var dimensions = dom.dimensions;
                        for (var dimensionIdx = 0; dimensionIdx < dimensions.length; dimensionIdx++) {
                            var dim = dimensions[dimensionIdx];
                            if (dim.oid == this.analyses[0].get("dimensions")[0].dimensionId) {
                                this.$el.find('#sq-origin').html(dim.name);
                            }
                        }
                    }
                }           

                // energy
                energy = this.applyThreshold(this.energyData,this.model.get("threshold"));

                // build the diagram
                var diagramPort = this.$el.find(".sq-diagram");
                var headerPort = this.$el.find(".sq-header");
                sankeyHeight = sankeyHeight - headerPort.height();
       
                if (!this.sankeyD3) {
                    this.sankeyD3 = this.buildSankey(diagramPort.get(0), energy, this.energyData.cols[this.energyData.cols.length-1], sankeyWidth, sankeyHeight, headerWidth);
                }
                this.updateSankey(diagramPort.get(0), this.sankeyD3, energy, sankeyWidth, sankeyHeight, headerWidth, slowmo);   

                this.$el.find(".sq-content").show();
                this.$el.find(".sq-wait").hide();
                this.$el.find(".sq-error").hide();
            }
            this.rendering = false;
            return this;
        },

        /*
         * Turn a Datatable into a D3 energy object with added information to support the threshold computation
         */
        buildEnergyDataSet : function(datatable,energy) {
            var startTime = new Date().getTime();
            var step0 = 0;
            if (!energy) {
                energy = {
                        "nodes"     : [],
                        "nodesById" : [],
                        "links"     : [],
                        "subtotals" : [], // total by step
                        "stepCount" : 0, // number of steps (including empty ones)
                        "cols"      : [],
                        "metrics"   : [],
                        "columns"   : [],
                        "stepStats" : [], // statistics by step
                        "primaryTotal"  : 0,
                        "secondaryTotal": 0
                };
            } else {
                step0 = energy.stepCount-1;// previous_energy(last_column)==next_energy(first_column) 
            }

            var nodesById = energy.nodesById;//
            var linksById = [];

            function getNode(nodename, step) {
                var key = (step0+step)+"_"+nodename;
                var node = nodesById[key];
                if (!node) {
                    nidx = energy.nodes.length;
                    node = {
                            "name":nodename,
                            "input":0,
                            "output":0, 
                            "exit":0, 
                            "primary":0,
                            "secondary":0, 
                            "step":step0+step, 
                            "id":nidx};
                    energy.stepStats[node.step].nodes++;
                    // handle label
                    node.label = nodename;
                    node.colorHtml = 'rgb(120,121,123)';
                    node.color = d3.rgb('rgb(120,121,123)');
                    node.fullname = node.label;
                    
                    nodesById[key] = node;
                    energy.nodes.push(node);
                }
                return node;
            }
            var selectedMetricId = null;
            var primaryMetricId = null;
            var secondaryMetricId = null;
            // count the steps
            for (var i=0;i<datatable.cols.length;i++) {
                var column = datatable.cols[i];
                if (column.role == "DOMAIN") {
                    if (!energy.columns[column.id]) {
                        energy.stepStats[energy.stepCount] = { "subTotals" : 0, "nodes" : 0};
                        energy.stepCount++;
                        energy.cols.push(column);
                        energy.columns[column.id] = column;
                    }
                } else if (column.role == "DATA") {
                    energy.metrics.push({"metadata":column,"index":i});
                    // support for legacy model
                    if (this.model.get("primaryMetric")) {
                        if (column.id==this.model.get("selectedMetric").oid) {
                            selectedMetricId = i;
                        }
                        if (column.id==this.model.get("primaryMetric").oid) {
                            primaryMetricId = i;
                        }
                        if (column.id==this.model.get("secondaryMetric").oid) {
                            secondaryMetricId = i;
                        }
                    } else {
                        // by default select the last metric
                        if (!primaryMetricId) {
                            primaryMetricId = i;
                            secondaryMetricId = i+1;
                        }
                        selectedMetricId = i;
                    }
                }
            }
            
            // set the metrics
            this.primaryMetric = datatable.cols[primaryMetricId];
            this.secondaryMetric = datatable.cols[secondaryMetricId];
            
            // create nodes and links to join consecutive steps
            for ( var i = 0; i < datatable.rows.length; i++) {
                var row = datatable.rows[i].v;
                var rowMetric = parseFloat(row[selectedMetricId]);
                var primaryMetric = primaryMetricId?parseFloat(row[primaryMetricId]):null;
                var secondaryMetric = secondaryMetricId?parseFloat(row[secondaryMetricId]):null;
                if (rowMetric > 0) {
                    if (step0==0) {
                        energy.subtotals[0] = rowMetric + (energy.subtotals[0]==null?0:energy.subtotals[0]);
                        energy.stepStats[0].nodes++;
                        if (primaryMetric) energy.primaryTotal += primaryMetric;
                        if (secondaryMetric) energy.secondaryTotal += secondaryMetric;
                    }
                    var isExit = true;// is the current node the exit node?
                    for ( var j = (row.length - 1); j > 0; j--) {
                        // treat only DOMAIN columns
                        if (datatable.cols[j].role == "DOMAIN") {
                            var targetName = row[j];
                            if ((targetName != null) && (targetName != "")) {
                                var target = getNode(targetName, j);
                                energy.subtotals[step0+j] = rowMetric + (energy.subtotals[step0+j]==null?0:energy.subtotals[step0+j]);
                                if (j >= 0) {
                                    var sourceName = row[j - 1];
                                    var source = getNode(sourceName, j - 1);
                                    var key = source.id + ":" + target.id;
                                    var link = linksById[key];
                                    if (!link) {
                                        link = {
                                                "source" : source.id,
                                                "sourceObject" : source,
                                                "target" : target.id,
                                                "targetObject" : target,
                                                "value" : 0,
                                                "exit" : 0,
                                                "primary"  : 0,
                                                "secondary" : 0
                                        };
                                        linksById[key] = link;
                                        energy.links.push(link);
                                    }
                                    link.value += rowMetric;
                                    if (isExit) {
                                        link.exit += rowMetric;
                                    }
                                    if (primaryMetric) {
                                        link.primary += primaryMetric;
                                    }
                                    if (secondaryMetric) {
                                        link.secondary += secondaryMetric;
                                    }
                                    source.output += rowMetric;
                                    target.input += rowMetric;
                                    source.value = Math.max(source.input,source.output);
                                    target.value = Math.max(target.input,target.output);
                                    source.exit = source.input>0?source.input - source.output:0;
                                    target.exit = target.input>0?target.input - target.output:0;
                                    if (primaryMetric) {
                                        if (source.step==0) source.primary += primaryMetric;
                                        target.primary += primaryMetric;
                                    }
                                    if (secondaryMetric) {
                                        if (source.step==0) source.secondary += secondaryMetric;
                                        target.secondary += secondaryMetric;
                                    }
                                }
                                isExit = false;
                            }
                        }
                    }
                }
            }

            // sort the new nodes by step ASC, value DSC
            energy.nodes = energy.nodes.sort(function(a,b) {
                if (a.step!=b.step) {
                    return a.step-b.step;
                } else {
                    return b.value-a.value;
                }
            });

            var endTime = new Date().getTime();
            console.log("buildEnergyDataSet time : "+(endTime - startTime)+" (ms)");
            return energy;
        },

        /*
         *  apply a threshold on a energy matrix and return a new matrix;
         *  threshold applies at the node level, nodes under threshold are merged into one "other" node.
         */
        applyThreshold : function(energy,threshold) {

            // convert the threshold from expected [0,100] interval into [.01,100]
            threshold = Math.max(0,Math.min(100,100-threshold));// force 0-100
            threshold = Math.pow(10,((threshold/100)*3-1));// covert into 10-1/10+2

            var nodes = energy.nodes;

            var mergeNodesByStep = []; // reference the mergeNode by step
            var nodeToMerge = []; // link from original node to mergeNode, in order to update the links
            var new_nodes = []; // list of selected nodes
            var new_indexes = []; // mapping between old indexes and new indexes for updanting links

            var step_stats = [];

            // first iter over the nodes and merge if total value is under threshold
            var total = Math.max.apply(Math, energy.subtotals);
            var mergeNodeIndex = nodes.length;// make sure merge node indexes don't mess with regular nodes
            for (var i=0; i< nodes.length; i++) {
                // compute node value
                var node = nodes[i];
                if (node.step<energy.stepCount) {
                    var stats = step_stats[node.step];
                    if (!stats) {
                        stats = {"count":0,"total":0};
                        step_stats[node.step] = stats;
                    }
                    var valuePercent = node.value/total*100;// use the total for the start step
                    // check threshold
                    if ((valuePercent < threshold || stats.count>15)) {// if under threshold, merge the node; if too many nodes, merge too
                        // get merge node for the node step
                        var mergeNode = mergeNodesByStep[node.step];
                        if (mergeNode==null) {
                            // create a mergeNode for the given step
                            mergeNode = {
                                    "step" : node.step,
                                    "name" : "More pages",
                                    "type" : "merge",
                                    "nodes" : [],
                                    "id" : mergeNodeIndex++,// it will be added at the end
                                    "value" : 0,
                                    "input" : 0,
                                    "output": 0,
                                    "exit"  : 0,
                                    "primary": 0,
                                    "secondary" : 0
                            };
                            mergeNode.fullname = mergeNode.name;
                            new_nodes.push(mergeNode);
                            mergeNodesByStep[node.step]=mergeNode;
                        }
                        mergeNode.nodes.push(node);// link to original node, could be used to zoom in
                        mergeNode.label = "More pages ("+mergeNode.nodes.length+")...";
                        mergeNode.value += node.value;
                        mergeNode.input += node.input;
                        mergeNode.output += node.output;
                        mergeNode.exit += node.exit;
                        mergeNode.exitPercent = mergeNode.exit/energy.subtotals[0]*100;
                        mergeNode.percentTotal = mergeNode.value/energy.subtotals[0]*100;
                        mergeNode.primary += node.primary;
                        mergeNode.secondary += node.secondary;
                        nodeToMerge[node.id] = mergeNode;// link the original node to the mergeNode
                    } else {
                        // keep the node
                        new_nodes.push(node);
                        // update stats
                        stats.count++;
                        stats.total += node.value;
                    }
                }
                // update node statistics
                node.percentTotal = node.value/energy.subtotals[0]*100;
                node.exitPercent = node.exit/energy.subtotals[0]*100;
            }

            // sort the new nodes by step ASC, value DSC, with merge nodes at the end
            new_nodes.sort(function(a,b) {
                if (a.step!=b.step) {
                    return a.step-b.step;
                } else {
                    if (b.type=="merge") {
                        return -1;
                    } else if (a.type=="merge") {
                        return 1;
                    } else {
                        return b.value-a.value;
                    }
                }
            });

            // rebuild the indexes
            for (var i=0;i<new_nodes.length;i++) {
                var node =new_nodes[i];
                new_indexes[node.id] = i;// old node id => new position in new nodes
            }

            var links = energy.links;
            var merge_links = [];// list of merged link, used to combine several links into one
            var new_links = [];// the updated list of links

            // now iter over the links and reindexe if source or target moved
            for (var i=0; i< links.length; i++) {
                // check if need to merge the link
                var link = links[i];
                var mergeSource = nodeToMerge[link.source];
                var mergeTarget = nodeToMerge[link.target];
                // compute new indexes
                var sourceID = mergeSource!=null?mergeSource.id:link.source;
                var targetID = mergeTarget!=null?mergeTarget.id:link.target;
                if (link.targetObject.step<energy.stepCount) {
                    if (mergeSource!=null || mergeTarget!=null) {
                        var merge_link = merge_links[sourceID+":"+targetID];
                        if (merge_link==null) {
                            // create a link for merging
                            merge_link = {
                                    "source" : new_indexes[sourceID],
                                    "sourceObject" : mergeSource?mergeSource:link.sourceObject,
                                            "target" : new_indexes[targetID],
                                            "targetObject" : mergeTarget?mergeTarget:link.targetObject,
                                                    "value" : 0,
                                                    "exit" : 0,
                                                    "primary" : 0,
                                                    "secondary" : 0
                            };
                            merge_links[sourceID+":"+targetID] = merge_link;// register the link for new source and target
                            new_links.push(merge_link);// add to the energy matrix
                        }
                        // update value
                        merge_link.value += link.value;
                        merge_link.exit += link.exit;
                        merge_link.primary += link.primary;
                        merge_link.secondary += link.secondary;
                        merge_link.percentTotal = merge_link.value/energy.subtotals[0]*100;
                    } else {
                        // reindexe the link
                        var update_link = {
                                "source" : new_indexes[sourceID],
                                "target" : new_indexes[targetID],
                                "value"  : link.value,
                                "exit"   : link.exit,
                                "primary": link.primary,
                                "secondary":link.secondary,
                                "percentTotal": link.value/energy.subtotals[0]*100
                        };
                        new_links.push(update_link);
                    }
                }
            }

            return {
                "nodes" : new_nodes,
                "links" : new_links,
                "stepCount" : energy.stepCount,
                "primaryTotal" : energy.primaryTotal,
                "secondaryTotal" : energy.secondaryTotal
            };;

        },

        dbclickNode : function(d) {
            if (d.type=="merge") {
                // zoom in
                var max = 0;
                for (var i=0;i<d.nodes.length;i++) {
                    max = Math.max(max,d.nodes[i].percentTotal);
                }
                if (max>0.1) {
                    max = max/2;
                    max = Math.log(max)/Math.LN10;
                    max = (max+1)/3*100;
                    max = 100 - max;
                    max = Math.min(100,Math.max(0,max));
                    this.model.set({"threshold":max});
                }
            } else {
                // step filtering (currently disabled)
                if (this.filterModel) {
                    // filter on node value
                    var col = this.energyData.cols[d.step];
                    var value = d.name;
                    var dimension = 
                    {"id" : {"domainId" : this.analyses[0].get("domains")[0].domainId, "dimensionId" : col.id},
                            "name" : col.lname};
                    this.filterModel.addSelection(dimension,value);
                    this.filterModel.trigger("change:userSelection");
                }
            }
        },

        dbclickLink : function(d) {
            if (this.filterModel) {
                var source = d.sourceObject?d.sourceObject:d.source;
                var target = d.targetObject?d.targetObject:d.target;
                var update = false;
                if (source.type!="merge") {
                    var col = this.energyData.cols[source.step];
                    var value = source.name;
                    var dimension = 
                    {"id" : {"domainId" : this.analyses[0].get("domains")[0].domainId, "dimensionId" : col.id},
                            "name" : col.lname};
                    this.filterModel.addSelection(dimension,value);
                    update = true;
                }
                if (target.type!="merge") {
                    var col = this.energyData.cols[target.step];
                    var value = target.name;
                    var dimension = 
                    {"id" : {"domainId" : this.analyses[0].get("domains")[0].domainId, "dimensionId" : col.id},
                            "name" : col.lname};
                    this.filterModel.addSelection(dimension,value);
                    update = true;
                }
                if (update) {
                    this.filterModel.trigger("change:userSelection");
                }
            }
        },

        tipNode : null,
        tipLink : null,

        updateSankey : function(selector, sankey, energy, viewWidth, viewHeight, headerWidth, slowmo) {
            var me = this;

            var formatPercent1 = d3.format(",.1f");
            var formatPercent2 = d3.format(",.2f");

            var fomatPercentSpecial = function(value) {
                if (value>=1) {
                    return formatPercent1(value);
                } else {
                    return formatPercent2(value);
                }
            };

            var lastStep = energy.stepCount-1;

            var duration = slowmo?1000:200;

            sankey
            .nodes(energy.nodes)
            .links(energy.links)
            .layout(0);// disable layout optimization since we already sorted the nodes according to our own needs

            var path = sankey.link();

            var svg = d3.select(selector).select("svg");

            var avg_secondary_rate = energy.secondaryTotal/energy.primaryTotal*100;
            var inflexion_value = 50;
            var colorscale = d3.scale.linear()
            .range(['red', 'skyblue', 'green'])
            .domain([0, inflexion_value, 100]);

            var displayScaleForNodes;
            if (this.displayOptionModel) {
                displayScaleForNodes = this.displayOptionModel.get("displayScaleForNodes");
            } else {
                displayScaleForNodes = false;
            }

            var scaleColor = function (d) { 
                var x = d.secondary/d.primary*100;
                return colorscale(x);
            };
            var nodeColor =  function(d) {
                return displayScaleForNodes?scaleColor(d):d.color;
            }
            var linkDefaultColor = "#aaaaaa";
            var linkColor =  function(d) {
                return displayScaleForNodes?scaleColor(d):linkDefaultColor;
            }

            // update secondary metric
            var html = "<table class='color-scale' style='width:100%;'><tr>";
            var step = -5;
            var defaultColor = "rgba(170,170,170,.5)";
            for (var i = 100; i>=0; i+=step) { 
                var selected = avg_secondary_rate<=i && avg_secondary_rate>i+step;
                var color = (displayScaleForNodes||selected)?colorscale(i):defaultColor;
                html += "<td class='"+(selected?"color-scale-selected":"color-scale")+"' style='background-color:"+color+";";
                if (selected) {
                    html += "border-color:"+color+";"
                }
                html += "'>";
                html += "<div class='color-scale' ";
                html += "rel='tooltip' href='#' data-toggle='tooltip' data-placement='bottom' title data-original-title='"+(selected?fomatPercentSpecial(avg_secondary_rate):i)+"%'>&nbsp;</div></td>";
            }
            html += "</tr></table>";
            $("#secondary-range").html(html);
            $("#secondary-value").html("<a rel='tooltip' class='prevent-default' href='#' data-toggle='tooltip' data-placement='top' title data-original-title='Average % of selected visits with at least 1 FTA'>"+fomatPercentSpecial(avg_secondary_rate)+"% Visits with FTA</a>");
            $("[rel=tooltip]").tooltip();

            var margin = {top: 1, right: headerWidth-17+5, bottom: 6, left: 0},
            width = viewWidth - margin.left - margin.right,
            height = viewHeight - margin.top - margin.bottom;

            svg.attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .select("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            sankey
            .nodeWidth(15)
            .nodePadding(10)
            .size([width, height]);

            // create data
            var nodedata = svg.selectAll(".node")
            .data(energy.nodes, function(d) {return d.step+"_"+d.name;});

            var linkdata = svg.selectAll(".link")
            .data(energy.links, function(d) { return d.source.step+"_"+d.source.name+"/"+d.target.step+"_"+d.target.name;});

            // enter link first
            var link = linkdata.enter().append("path")
            .attr("class", "link")
            .style("stroke", function(d) { 
                return linkDefaultColor;})
                .style("stroke-opacity", function(d) {return "0.1";})
                .attr("d", path)
                .on("dblclick", function (d) {
                    me.dbclickLink(d);
                })
                .transition().duration(duration).style("stroke-width", function(d) { return Math.max(1, d.dy); })
                .sort(function(a, b) { return b.dy - a.dy; });

            // enter node after to be on top
            var node = nodedata.enter().append("g")
            .attr("class","node")
            .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
            .on("dblclick", function (d) {
                me.dbclickNode(d);
            })
            .call(d3.behavior.drag()
                    .origin(function(d) { return d; })
                    .on("dragstart", function() { this.parentNode.appendChild(this); })
                    .on("drag", dragmove));

            node.append("text")
            .attr("x", 15 + sankey.nodeWidth())
            .attr("text-anchor", "start")
            .attr("transform", null)
            .text(function(d) {
                var name = d.label;
                if (name.length > me.titleMaxChars && name.indexOf("...", this.length - 3) == -1) {
                    name = name.substr(0, me.titleMaxChars) + "...";
                }
                return name;
            });

            node.append("rect")
            .attr("height", function(d) { return 0; })
            .attr("width", sankey.nodeWidth())
            .style("fill", function(d) { return d.color;})
            .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
            ;

            // update
            nodedata
            .transition().duration(duration)
            .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
            .select("rect")
            .attr("height", function(d) { return d.dy; })
            .style("fill", nodeColor)
            ;

            nodedata.select("text")
            .transition().duration(duration)
            .attr("y", function(d) { return d.dy / 2; })
            .attr("dy", ".35em");

            var tipNodeRenderHtml = function(d) {
                var data = {"width":headerWidth-15};
                //
                data.node = d;
                data.endsNode = (d.step==0) || (d.step==lastStep);
                data.percentTotal = fomatPercentSpecial(d.percentTotal);
                data.percentTotalGoThrough = fomatPercentSpecial(d.percentTotal-d.exitPercent);
                data.percentTotalExit = fomatPercentSpecial(d.exitPercent);
                data.percentGoThrough = fomatPercentSpecial((d.percentTotal-d.exitPercent)/d.percentTotal*100);
                data.percentExit = fomatPercentSpecial(d.exitPercent/d.percentTotal*100);
                data.secondaryKPI = me.secondaryMetric.oid;
                data.secondaryRate = fomatPercentSpecial(d.secondary/d.primary*100);
                data.secondaryColor = scaleColor(d);
                data.secondaryDefinition = me.secondaryMetric.lname;
                data.primaryDefinition = me.primaryMetric.lname;
                
                // pie chart
                data.piechart = {};
                data.piechart.r = 15;
                data.piechart.center = data.piechart.r+2;
                data.piechart.size = 2*data.piechart.center;
                data.piechart.startx = data.piechart.center-data.piechart.r;
                data.piechart.starty = data.piechart.center;
                var angular = d.exitPercent/d.percentTotal*2*Math.PI;
                if (d.exitPercent==0) {
                    data.piechart.fullpie = true;
                    data.piechart.green = "green";
                } else if (d.exitPercent==d.percentTotal) {
                    data.piechart.fullpie = true;
                    data.piechart.green = "red";
                } else {
                    data.piechart.cos = data.piechart.center-data.piechart.r*Math.cos(angular);
                    data.piechart.sin = data.piechart.center+data.piechart.r*Math.sin(angular);
                    data.piechart.first = data.percentExit>50?0:1;
                    data.piechart.second = data.percentExit<=50?0:1;
                    data.piechart.green = "green";
                    data.piechart.red = "red";
                }
                // merge node
                if (d.type=="merge") {
                    data.mergeNode = {};
                    data.mergeNode.nodes = new Array();
                    for (var i=0;i<d.nodes.length;i++) {
                        var node = d.nodes[i];
                        if (i>5 && d.nodes.length>6) {
                            data.mergeNode.moreNodes = (d.nodes.length-i);
                            break;
                        }
                        var node = {"fullname":node.fullname,"percentTotal":fomatPercentSpecial(node.percentTotal)};
                        data.mergeNode.nodes.push(node);
                    }
                }
                return templateTipNode(data);
            };

            if (this.tipNode) {
                this.tipNode.hide();
            }
            this.tipNode = d3.tip()
            .attr('class', 'd3-tip')
            .style('min-width', (headerWidth-sankey.nodeWidth()-15)+'px')
            .style('z-index',2000)
            .offset(function(d) {
                if (d.type=="merge") {
                    return [d.dy/2+35,5];
                } else {
                    return [0,5];
                }
            }
            )
            .direction(function(d) {
                if (d.type=="merge") {
                    return "ne";
                } else {
                    return "e";
                }
            })
            .html(function(d) {
                return tipNodeRenderHtml(d);
            });
            var myTipNode = this.tipNode;
            svg.call(myTipNode);

            nodedata.select("rect")
            .on('dblclick', myTipNode.hide)
            .on('click', myTipNode.show)// touch?
            .on('mouseover', function(d) {
                var selection = d3.select(this);
                selection.style("fill", function(d) {
                    var color = nodeColor(d);
                    return d3.rgb(color).darker(1);});
                myTipNode.attr('class', 'd3-tip animate').show(d);})
                .on('mouseout', function(d) {
                    var selection = d3.select(this);
                    selection.style("fill", function(d) {
                        var color = nodeColor(d);
                        return color;});
                    myTipNode.attr('class', 'd3-tip').show(d);myTipNode.hide();});

            // exit
            nodedata.exit().select("text").remove();
            var trans = nodedata.exit().transition();
            trans.duration(duration).select("rect")
            .attr("height", function(d) { return 0; });
            trans.transition().remove();

            var tipLinkRenderHtml = function(d) {
                var data = {"width":headerWidth-15,"percentTotal":fomatPercentSpecial(d.percentTotal)};
                data.source = d.source;
                data.target = d.target;
                data.percentRelativeSource = fomatPercentSpecial(d.percentTotal/d.source.percentTotal*100);
                data.percentRelativeTarget = fomatPercentSpecial(d.percentTotal/d.target.percentTotal*100);
                data.exitRate = fomatPercentSpecial(d.exit/d.value*100);
                data.secondaryKPI = me.secondaryMetric.oid;
                data.secondaryRate = fomatPercentSpecial(d.secondary/d.primary*100);
                data.secondaryColor = scaleColor(d);
                data.secondaryDefinition = me.secondaryMetric.lname;
                data.primaryDefinition = me.primaryMetric.lname;
                return templateTipLink(data);
            }
            if (this.tipLink) {
                this.tipLink.hide();
            }
            var mytipLink = d3.tip()
            .attr('class', 'd3-tip')
            .style('min-width', (headerWidth-sankey.nodeWidth()-15)+'px')
            .style('z-index',2000)
            .offset(function(d) {
                // recompute the path bounds
                var y0 = d.source.y + d.sy + d.dy / 2;
                var y1 = d.target.y + d.ty + d.dy / 2;
                var L = y1-y0;
                return [L/2,sankey.nodeWidth()/2];
            }
            )
            .direction(function(d) {
                return "e";
            })
            .html(function(d) {
                return tipLinkRenderHtml(d);
            })
            this.tipLink = mytipLink;
            svg.call(mytipLink);

            linkdata
            .on('dblclick', mytipLink.hide)
            .on('click', mytipLink.show)// touch?
            .on('mouseover', function(d) {
                var selection = d3.select(this);
                selection.style("stroke", function(d) {
                    var color = linkColor(d);
                    return d3.rgb(color).darker(1);}).style("stroke-opacity",0.6);
                mytipLink.attr('class', 'd3-tip animate').show(d);})
                .on('mouseout', function(d) {
                    var selection = d3.select(this);
                    selection.style("stroke", function(d) {
                        var color = linkColor(d);
                        return color;}).style("stroke-opacity",function(d) {return d.percentTotal>10?.5:d.percentTotal>1?0.4:.1;});
                    mytipLink.attr('class', 'd3-tip').show(d);mytipLink.hide();})
                    ;

            svg.selectAll(".link")
            .transition().duration(duration)
            .attr("d", path)
            .style("stroke-width", function(d) { return Math.max(1, d.dy); })
            .style("stroke-opacity", function(d) {return d.percentTotal>10?.5:d.percentTotal>1?0.4:.1;})
            .style("stroke", linkColor);

            var trans2 = linkdata.exit().transition();
            trans2.duration(duration).style("stroke-width", 0);
            trans2.transition().remove();

            function value(link) {
                return link.value;
            }

            function dragmove(d) {
                d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
                sankey.relayout();
                linkdata.attr("d", path);
            }

        },

        buildSankey : function(selector, energy, metric, viewWidth, viewHeight, headerWidth) {
            var me = this;
            var margin = {top: 1, right: headerWidth-17+5, bottom: 6, left: 0},
            width = viewWidth - margin.left - margin.right,
            height = viewHeight - margin.top - margin.bottom;

            var svg = d3.select(selector).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            svg.append("g");

            var sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .size([width, height]);

            return sankey;
        }

    });

    return View;
}));
