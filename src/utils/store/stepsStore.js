import { defineStore } from "pinia";

export const useStepsStore = defineStore("kmeansSteps", {
  state: () => ({
    steps: [],
    centroidsStep: [],
  }),

  actions: {
    addStep(step) {
      if (step) {
        this.steps.push(step);
      }
    },

    addCentroid(centroid) {
      if (centroid) {
        this.centroidsStep.push(centroid);
      }
    },

    emptyStore() {
      this.steps.length = 0;
      this.centroidsStep.length = 0;
    },
  },
});
