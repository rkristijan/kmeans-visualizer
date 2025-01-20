import { defineStore } from "pinia";

export const useHelperStore = defineStore("helperStore", {
  state: () => ({
    initialCentroids: [],
  }),

  actions: {
    setInitialCentroids(centroids) {
      this.initialCentroids = centroids;
    },

    clearInitialCentroids() {
      if (this.initialCentroids.length) {
        this.initialCentroids.length = 0;
      }
    },
  },
});
