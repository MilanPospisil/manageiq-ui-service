(function() {
  'use strict';

  angular.module('app.states')
    .run(appRun);

  /** @ngInject */
  function appRun(routerHelper) {
    routerHelper.configureStates(getStates());
  }

  function getStates() {
    return {
      'help': {
        parent: 'application',
        url: '/',
        templateUrl: 'app/states/help/help.html',
        controller: StateController,
        controllerAs: 'vm',
        title: N_('Help'),
      },
    };
  }

  /** @ngInject */
  function StateController() {
  }
})();
