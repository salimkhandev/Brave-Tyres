const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  tyres: {
    getAll: () => ipcRenderer.invoke('tyres:getAll'),
    getById: (id) => ipcRenderer.invoke('tyres:getById', id),
    create: (tyreData) => ipcRenderer.invoke('tyres:create', tyreData),
    update: (id, tyreData) => ipcRenderer.invoke('tyres:update', id, tyreData),
    delete: (id) => ipcRenderer.invoke('tyres:delete', id),
    addStock: (id, qtyToAdd, costPrice, supplier) => ipcRenderer.invoke('tyres:addStock', id, qtyToAdd, costPrice, supplier)
  },
  sales: {
    create: (saleData) => ipcRenderer.invoke('sales:create', saleData),
    getAll: (filters) => ipcRenderer.invoke('sales:getAll', filters),
    getSummary: (filters) => ipcRenderer.invoke('sales:getSummary', filters)
  },
  purchases: {
    getAll: () => ipcRenderer.invoke('purchases:getAll')
  },
  dashboard: {
    getSummary: () => ipcRenderer.invoke('dashboard:getSummary')
  },
  export: {
    stockExcel: () => ipcRenderer.invoke('export:stock:excel'),
    salesExcel: () => ipcRenderer.invoke('export:sales:excel')
  },
  backup: {
    getInfo: () => ipcRenderer.invoke('backup:getInfo'),
    create: () => ipcRenderer.invoke('backup:create'),
    restore: () => ipcRenderer.invoke('backup:restore')
  }
});
