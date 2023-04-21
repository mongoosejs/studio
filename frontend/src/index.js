'use strict';

const app = Vue.createApp({
  template: '<app-component />'
});

require('./async-button/async-button')(app);
require('./detail-array/detail-array')(app);
require('./detail-default/detail-default')(app);
require('./document/document')(app);
require('./edit-default/edit-default')(app);
require('./edit-number/edit-number')(app);
require('./edit-date/edit-date')(app);
require('./export-query-results/export-query-results')(app);
require('./list-array/list-array')(app);
require('./list-default/list-default')(app);
require('./list-string/list-string')(app);
require('./list-subdocument/list-subdocument')(app);
require('./modal/modal')(app);
require('./models/models')(app);
require('./navbar/navbar')(app);

app.component('app-component', {
  template: `
  <div>
    <navbar />
    <div class="view">
      <router-view :key="$route.fullPath" />
    </div>
  </div>
  `
});

const routes = require('./routes');
const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: routes.map(route => ({
    ...route,
    component: app.component(route.component),
    props: (route) => route.params
  }))
});

app.use(router);

app.mount('#content');