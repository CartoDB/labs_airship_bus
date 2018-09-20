function run() {
    const client = new carto.Client({
        apiKey: 'PHyP0dx0_OTdktkzc4PiwQ',
        username: 'jsanzcdb'
    });

    const map = L.map('map').setView([36.72,-4.43], 15);
    new L.Hash(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png', {
        maxZoom: 18
    }).addTo(map);

    const current_timestamp = new Date();
    const delta_value = (current_timestamp.getHours() % 4) * 3600 + 
                        current_timestamp.getMinutes() * 60 +
                        current_timestamp.getSeconds();

    console.log(delta_value);

    const source = new carto.source.SQL(`
    with firsts as (
     select cartodb_id,
            rank() over (partition by codbus order by delta_update desc) as rank
       from malaga_buses
     where delta_update between ${delta_value} - 120 and ${delta_value}
   ) 
   select m.*,
          ${delta_value} - delta_update as delta_diff,
          c.id as company_id,
          c.name as company_name
       from malaga_buses m
       join firsts f
         on f.cartodb_id = m.cartodb_id
        and rank = 1
       join malaga_buses_companies c
         on round(m.codbus / 100) = c.id 
    `);

    const style = new carto.style.CartoCSS(`
    #layer {
        marker-width: 9.5;
        marker-fill: ramp([sentido], (#7F3C8D, #11A579, #A5AA99), (1, 2), "=", category);
        marker-fill-opacity: 1;
        marker-allow-overlap: true;
        marker-line-width: 0;
        marker-line-color: #FFFFFF;
        marker-line-opacity: 1;
        marker-comp-op: multiply;
      }
    `);

    const layer = new carto.layer.Layer(source, style,{
        featureOverColumns: ['codbus','codlinea','sentido','delta_update', 'delta_diff','company_name']
    });

    client.addLayer(layer);
    client.getLeafletLayer().addTo(map);


    const dataViews = [];

    /* Category widget: bus by line */

    const busLinesCategoryWidget = document.querySelector('#bus-lines-category');

    const busLinesDataView = new carto.dataview.Category(source, 'codlinea', {
        operation: carto.operation.COUNT
    });

    dataViews.push(busLinesDataView);

    busLinesDataView.on('dataChanged', function (newData) {
        busLinesCategoryWidget.categories = newData.categories;
    });

    const selectedLine = new carto.filter.Category('codlinea', {});
    source.addFilter(selectedLine);

    busLinesCategoryWidget.addEventListener('categoriesSelected', (event) => {
        if (event.detail.length == 0) {
            selectedLine.resetFilters();
        } else {
            selectedLine.setFilters({ in: event.detail
            });
        }
    });

    /* Category widget: bus by company */

    const busCompaniesCategoryWidget = document.querySelector('#bus-companies-category');

    const busCompaniesDataView = new carto.dataview.Category(source, 'company_name', {
        operation: carto.operation.COUNT
    });

    dataViews.push(busCompaniesDataView);

    busCompaniesDataView.on('dataChanged', function (newData) {
        busCompaniesCategoryWidget.categories = newData.categories;
    });

    const selectedCompany = new carto.filter.Category('company_name', {});
    source.addFilter(selectedCompany);

    busCompaniesCategoryWidget.addEventListener('categoriesSelected', (event) => {
        if (event.detail.length == 0) {
            selectedCompany.resetFilters();
        } else {
            selectedCompany.setFilters({ in: event.detail
            });
        }
    });


    /* Formula widget: count */
    const formulaTotalCount = new carto.dataview.Formula(source, 'codlinea', {
        operation: carto.operation.COUNT
    });

    dataViews.push(formulaTotalCount);

    formulaTotalCount.on('dataChanged', data => {
        if (data.result) {
            document.getElementById('js-count-buses').innerHTML = data.result;
        }
    });

    /* Formula widget: average delta_update difference */
    const formulaAvgDiff = new carto.dataview.Formula(source,'delta_diff', {
        operation: carto.operation.AVERAGE
    });
    dataViews.push(formulaAvgDiff);

    formulaAvgDiff.on('dataChanged', data => {
        if (data.result) {
            document.getElementById('js-avg-diff').innerHTML = data.result;
        }
    });


    /* Bounding box filter */
    const bboxFilter = new carto.filter.BoundingBoxLeaflet(map);

    /* For all dataviews, add the BBOX filter, 
       an error handler and finally add them to the client */
    dataViews.forEach(view => {
        view.addFilter(bboxFilter);

        view.on('error', error => {
            console.error(error.message);
        });

        client.addDataview(view);
    });


    /* Checkbox line 7 */
    const forwardFilter = new carto.filter.Category('sentido', {});
    source.addFilter(forwardFilter);
    const backwardFilter = new carto.filter.Category('sentido', {});
    source.addFilter(backwardFilter);

    document.querySelector('#switch_backward').addEventListener('change', function (event) {
        if (! event.target.checked) {
            forwardFilter.set('eq',1);
        } else {
            forwardFilter.resetFilters();
        };
    })
    document.querySelector('#switch_forward').addEventListener('change', function (event) {
        if (! event.target.checked) {
            backwardFilter.set('eq',2);
        } else {
            backwardFilter.resetFilters();
        };
    })


    /* pop up */
    const popup = L.popup({ closeButton: false });

    function openPopup(featureEvent) {
        const data = featureEvent.data;
        const direction = data.sentido == 1 ? 'forward' : 'backwards';
        const content = `
        <h1 class="as-title">#${data.codbus}</h1>
        <p style="text-align:center;margin:0;">
            <img class="infowindow-image" src="resources/companies/${data.company_name.toLowerCase()}.jpg"/>
        </p>
        <p>
            <span class="as-badge">Line ${data.codlinea}</span>
            <span class="as-badge as-bg--badge-pink">Moving ${direction}</span>
        </p>
        `;

        popup.setContent(content);
        popup.setLatLng(featureEvent.latLng);
        if (!popup.isOpen()) {
            popup.openOn(map);
        }
    }

    layer.on('featureClicked',openPopup);


    // layer.on('featureOver',openPopup);
    // layer.on('featureOut',function(){
    //     popup.removeFrom(map);
    // });


}

/* Equivalent to jQuery document.ready */
const applicationContent = document.querySelector('as-application-content');
applicationContent.addEventListener('load', run);