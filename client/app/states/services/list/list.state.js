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
      'services.list': {
        url: '', // No url, this state is the index of projects
        templateUrl: 'app/states/services/list/list.html',
        controller: StateController,
        controllerAs: 'vm',
        title: N_('Service List'),
        resolve: {
          services: resolveServices,
        },
      },
    };
  }

  /** @ngInject */
  function resolveServices(CollectionsApi) {
    var options = {
      expand: 'resources',
      attributes: ['picture', 'picture.image_href', 'evm_owner.name', 'v_total_vms', 'chargeback_report'],
      filter: ['service_id=nil'],
    };

    return CollectionsApi.query('services', options);
  }

  /** @ngInject */
  function StateController($state, services, ServicesState, $filter, $rootScope, Language, ListView, Chargeback, CollectionsApi, EventNotifications, sprintf) {
    var vm = this;

    vm.services = [];

    if (angular.isDefined($rootScope.notifications) && $rootScope.notifications.data.length > 0) {
      $rootScope.notifications.data.splice(0, $rootScope.notifications.data.length);
    }

    angular.forEach(services.resources, function(item) {
      if (angular.isUndefined(item.service_id)) {
        item.powerState = angular.isDefined(item.options.power_state) ? item.options.power_state : "";
        item.powerStatus = angular.isDefined(item.options.power_status) ? item.options.power_status : "";
        vm.services.push(item);
      }
    });

    vm.services.forEach(Chargeback.processReports);
    Chargeback.adjustRelativeCost(vm.services);

    vm.servicesList = angular.copy(vm.services);

    vm.listConfig = {
      selectItems: false,
      showSelectBox: false,
      selectionMatchProp: 'service_status',
      onClick: handleClick,
    };

    var serviceFilterConfig = {
      fields: getServiceFilterFields(),
      resultsCount: vm.servicesList.length,
      appliedFilters: ServicesState.filterApplied ? ServicesState.getFilters() : [],
      onFilterChange: filterChange,
    };

    var serviceSortConfig = {
      fields: getServiceSortFields(),
      onSortChange: sortChange,
      isAscending: ServicesState.getSort().isAscending,
      currentField: ServicesState.getSort().currentField,
    };

    vm.toolbarConfig = {
      filterConfig: serviceFilterConfig,
      sortConfig: serviceSortConfig,
    };

    vm.actionButtons = [
      {
        name: __('Start'),
        actionName: 'start',
        title: __('Start this service'),
        actionFn: startService,
        isDisabled: false,
      },
    ];

    vm.menuActions = [
      {
        name: __('Stop'),
        actionName: 'stop',
        title: __('Stop this service'),
        actionFn: stopService,
        isDisabled: false,
      },
      {
        name: __('Suspend'),
        actionName: 'suspend',
        title: __('Suspend this service'),
        actionFn: suspendService,
        isDisabled: false,
      },
    ];

    function getServiceFilterFields() {
      var retires = [__('Current'), __('Soon'), __('Retired')];
      var dollars = ['$', '$$', '$$$', '$$$$'];

      return [
        ListView.createFilterField('name', __('Name'), __('Filter by Name'), 'text'),
        ListView.createFilterField('retirement', __('Retirement Date'), __('Filter by Retirement Date'), 'select', retires),
        ListView.createFilterField('vms', __('Number of VMs'), __('Filter by VMs'), 'text'),
        ListView.createFilterField('owner', __('Owner'), __('Filter by Owner'), 'text'),
        ListView.createFilterField('owner', __('Created'), __('Filter by Created On'), 'text'),
        ListView.createFilterField('chargeback_relative_cost', __('Relative Cost'), __('Filter by Relative Cost'), 'select', dollars),
      ];
    }

    function getServiceSortFields() {
      return [
        ListView.createSortField('name', __('Name'), 'alpha'),
        ListView.createSortField('retires', __('Retirement Date'), 'numeric'),
        ListView.createSortField('vms', __('Number of VMs'), 'numeric'),
        ListView.createSortField('owner', __('Owner'), 'alpha'),
        ListView.createSortField('created', __('Created'), 'numeric'),
        ListView.createSortField('chargeback_relative_cost', __('Relative Cost'), 'alpha'),
      ];
    }

    if (ServicesState.filterApplied) {
      /* Apply the filtering to the data list */
      filterChange(ServicesState.getFilters());
      ServicesState.filterApplied = false;
    } else {
      vm.servicesList = ListView.applyFilters(ServicesState.getFilters(), vm.servicesList, vm.services, ServicesState, matchesFilter);

      /* Make sure sorting direction is maintained */
      sortChange(ServicesState.getSort().currentField, ServicesState.getSort().isAscending);
    }

    vm.enableButtonForItemFn = function (action, item) {
      return powerOperationUnknownState(item)
        || powerOperationOffState(item)
        || powerOperationSuspendState(item)
        || powerOperationTimeoutState(item);
    };

    vm.hideMenuForItemFn = function (item) {
      return powerOperationUnknownState(item) || powerOperationInProgressState(item);
    };

    vm.updateMenuActionForItemFn = function(action, item) {
      if (powerOperationSuspendState(item) && action.actionName === "suspend") {
        action.isDisabled = true;
      } else if (powerOperationOffState(item) && action.actionName === "stop") {
        action.isDisabled = true;
      } else {
        action.isDisabled = false;
      }
    };

    function powerOperationUnknownState(item) {
      return item.powerState === "" && item.powerStatus === "";
    }

    function powerOperationInProgressState(item) {
      return (item.powerState !== "timeout" && item.powerStatus === "starting")
        || (item.powerState !== "timeout" && item.powerStatus === "stopping")
        || (item.powerState !== "timeout" && item.powerStatus === "suspending");
    }

    function powerOperationOnState(item) {
      return item.powerState === "on" && item.powerStatus === "start_complete";
    }

    function powerOperationOffState(item) {
      return item.powerState === "off" && item.powerStatus === "stop_complete";
    }

    function powerOperationSuspendState(item) {
      return item.powerState === "off" && item.powerStatus === "suspend_complete";
    }

    function powerOperationTimeoutState(item) {
      return item.powerState === "timeout";
    }

    function powerOperationStartTimeoutState(item) {
      return item.powerState === "timeout" && item.powerStatus === "starting";
    }

    function powerOperationStopTimeoutState(item) {
      return item.powerState === "timeout" && item.powerStatus === "stopping";
    }

    function powerOperationSuspendTimeoutState(item) {
      return item.powerState === "timeout" && item.powerStatus === "suspending";
    }

    function startService(action, item) {
      item.powerStatus = 'starting';
      powerOperation('start', item);
    }

    function stopService(action, item) {
      item.powerStatus = 'stopping';
      powerOperation('stop', item);
    }

    function suspendService(action, item) {
      item.powerStatus = 'suspending';
      powerOperation('suspend', item);
    }

    function powerOperation(powerAction, item) {
      CollectionsApi.post('services', item.id, {}, {action: powerAction}).then(actionSuccess, actionFailure);

      function actionSuccess() {
        if (powerAction === 'start') {
          EventNotifications.success(__(sprintf("%s was started", item.name)));
        } else if (powerAction === 'stop') {
          EventNotifications.success(__(sprintf("%s was stopped", item.name)));
        } else if (powerAction === 'suspend') {
          EventNotifications.success(__(sprintf("%s was suspended", item.name)));
        }
      }

      function actionFailure() {
        if (powerAction === 'start') {
          EventNotifications.error(__('There was an error starting this service.'));
        } else if (powerAction === 'stop') {
          EventNotifications.error(__('There was an error stopping this service.'));
        } else if (powerAction === 'suspend') {
          EventNotifications.error(__('There was an error suspending this service.'));
        }
      }
    }

    function handleClick(item, e) {
      $state.go('services.details', {serviceId: item.id});
    }

    function sortChange(sortId, isAscending) {
      vm.servicesList.sort(compareFn);

      /* Keep track of the current sorting state */
      ServicesState.setSort(sortId, vm.toolbarConfig.sortConfig.isAscending);
    }

    function compareFn(item1, item2) {
      var compValue = 0;
      if (vm.toolbarConfig.sortConfig.currentField.id === 'name') {
        compValue = item1.name.localeCompare(item2.name);
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'vms') {
        compValue = item1.v_total_vms - item2.v_total_vms;
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'owner') {
        if (angular.isUndefined(item1.evm_owner)
          && angular.isDefined(item2.evm_owner)) {
          compValue = 1;
        } else if (angular.isDefined(item1.evm_owner)
          && angular.isUndefined(item2.evm_owner)) {
          compValue = -1;
        } else if (angular.isUndefined(item1.evm_owner)
          && angular.isUndefined(item2.evm_owner)) {
          compValue = 0;
        } else {
          compValue = item1.evm_owner.name.localeCompare(item2.evm_owner.name);
        }
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'created') {
        compValue = new Date(item1.created_at) - new Date(item2.created_at);
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'retires') {
        compValue = getRetirementDate(item1.retires_on) - getRetirementDate(item2.retires_on);
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'chargeback_relative_cost') {
        compValue = item1.chargeback_relative_cost.length - item2.chargeback_relative_cost.length;
      }

      if (!vm.toolbarConfig.sortConfig.isAscending) {
        compValue = compValue * -1;
      }

      return compValue;
    }

    /* Date 10 years into the future */
    var neverRetires = new Date();
    neverRetires.setDate(neverRetires.getYear() + 10);

    function getRetirementDate(value) {
      if (angular.isDefined(value)) {
        return new Date(value);
      } else {
        return neverRetires;
      }
    }

    function filterChange(filters) {
      vm.servicesList = ListView.applyFilters(filters, vm.servicesList, vm.services, ServicesState, matchesFilter);

      /* Make sure sorting direction is maintained */
      sortChange(ServicesState.getSort().currentField, ServicesState.getSort().isAscending);

      vm.toolbarConfig.filterConfig.resultsCount = vm.servicesList.length;
    }

    function matchesFilter(item, filter) {
      if (filter.id === 'name') {
        return item.name.toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      } else if (filter.id === 'vms') {
        return String(item.v_total_vms).toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      } else if (filter.id === 'owner' && angular.isDefined(item.evm_owner)) {
        return item.evm_owner.name.toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      } else if (filter.id === 'retirement') {
        return checkRetirementDate(item, filter.value.toLowerCase());
      } else if (filter.id === 'created') {
        return $filter('date')(item.created_at).toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      } else if (filter.id === 'chargeback_relative_cost') {
        return item.chargeback_relative_cost === filter.value;
      }

      return false;
    }

    function checkRetirementDate(item, filterValue) {
      var currentDate = new Date();

      if (filterValue === 'retired' && angular.isDefined(item.retires_on)) {
        return angular.isDefined(item.retired) && item.retired === true;
      } else if (filterValue === 'current') {
        return angular.isUndefined(item.retired) || item.retired === false;
      } else if (filterValue === 'soon' && angular.isDefined(item.retires_on)) {
        return new Date(item.retires_on) >= currentDate
          && new Date(item.retires_on) <= currentDate.setDate(currentDate.getDate() + 30);
      }

      return false;
    }

    Language.fixState(ServicesState, vm.toolbarConfig);
  }
})();
