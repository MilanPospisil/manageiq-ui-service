(function() {
  'use strict';

  angular.module('app.components')
    .factory('CreateCatalogModal', CreateCatalogFactory);

  /** @ngInject */
  function CreateCatalogFactory($modal) {
    var modalCreateCatalog = {
      showModal: showModal,
    };

    return modalCreateCatalog;

    function showModal() {
      var modalOptions = {
        templateUrl: 'app/components/blueprints/blueprint-details-modal/create-catalog-modal/create-catalog-modal.html',
        controller: CreateCatalogModalController,
        controllerAs: 'vm',
      };
      var modal = $modal.open(modalOptions);

      return modal.result;
    }
  }

  /** @ngInject */
  function CreateCatalogModalController($state, $modalInstance, $log) {
    var vm = this;

    vm.modalData = {
      'catalogName': '',
    };

    vm.saveCatalog = saveCatalog;

    function saveCatalog() {
      saveSuccess();

      function saveSuccess() {
        if (vm.modalData.catalogName && vm.modalData.catalogName.length > 0) {
          $modalInstance.close({catalogName: vm.modalData.catalogName});
        } else {
          $log.error("Catalog Name not provided.");
        }
      }
    }
  }
})();
