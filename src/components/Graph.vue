<template>
  <div class="wrapper">
    <div id="container"
      :class="manualCentroidMode && !isRunning && manualCentroidCount < clusterAmount && 'crossCursor'"></div>

    <div class="controlsFooter">
      <div class="controls">
        <v-btn class="rounded" variant="outlined" icon="mdi-chevron-double-left" color="primary" @click="firstStep()"
          :disabled="isFinished" />
        <v-btn class="rounded" variant="outlined" icon="mdi-chevron-left" color="primary" @click="previousStep()"
          :disabled="isFinished" />
        <v-btn class="rounded" variant="outlined" icon="mdi-chevron-right" color="primary" @click="nextStep()"
          :disabled="isFinished" />
        <v-btn class="rounded" variant="outlined" icon="mdi-chevron-double-right" color="primary" @click="lastStep()"
          :disabled="isFinished" />
      </div>

      <span v-if="!isFinished" class="stepTotal">Step {{ currentStepIndex }} of {{ stoppedOnStep }}</span>
      <v-icon v-if="isFinished" icon="mdi-alert-circle-outline" color="warning"
        v-tooltip:end="'Step by step controls are enabled when the algorithm has finished'" />
    </div>
  </div>

  <div class="inputs">
    <v-switch v-model="displayVoronoi" color="primary" label="Display Voronoi borders" />
    <div class="centroidMode">
      <v-switch v-model="manualCentroidMode" color="success"
        :label="manualCentroidMode ? 'Centroid mode: Manual' : 'Centroid mode: Auto'" />
      <v-btn variant="plain" icon="mdi-refresh" color="primary" v-tooltip:end="'Generate random centroids'"
        @click="generateRandomCentroids()" :disabled="manualCentroidMode" />
    </div>

    <v-form ref="form" validate-on="input">
      <v-text-field variant="underlined" v-model="iterationSpeed"
        label="Use the slider to enter iteration speed in seconds" disabled
        placeholder="Use the slider to Enter iteration speed in seconds"
        :rules="[rules.required, rules.mustBeNumber, rules.mustBePositive]" />

      <v-slider v-model="iterationSpeed" :min="0.1" :max="10" :step="0.1" :disabled="isRunning" thumb-label />

      <v-text-field variant="underlined" v-model="clusterAmount" label="Amount of clusters"
        :rules="[rules.required, rules.mustBeInteger]" />

      <v-text-field variant="underlined" v-model="dataPointsAmount" label="Amount of data points"
        :rules="[rules.required, rules.mustBeInteger]" />

      <v-text-field variant="underlined" v-model="iterationAmount" label="Maximum amount of iterations"
        :rules="[rules.required, rules.mustBeInteger]" />

      <div class="distributionData">
        <v-select v-model="distribution" label="Select data distribution" :items="distributionOptions"></v-select>
        <v-btn variant="plain" icon="mdi-file-restore" color="primary" v-tooltip:end="'Generate new data points'"
          @click="generateNewData()" :disabled="isRunning" />
      </div>


      <div v-if="isCircularData || isConcentricData" class="circularInputs">
        <v-text-field variant="underlined" class="amountInput" v-model="circleAmount" label="Amount of circles"
          :rules="[rules.required, rules.mustBeInteger, rules.mustBePositive]" />
        <v-text-field variant="underlined" v-if="isCircularData" class="radiusInput" v-model="circleRadius"
          label="Circle radius" :rules="[rules.required, rules.mustBeInteger, rules.mustBePositive]" />
      </div>

      <v-text-field variant="underlined" v-if="isGaussianData" v-model="gaussianVariance" label="Variance"
        :rules="[rules.required, rules.mustBeNumber, rules.mustBePositive]" />
    </v-form>

    <div class="buttons">
      <v-btn variant="outlined" color="green" @click="start" :disabled="isRunning || (manualCentroidMode && !validNumOfCentroidsPlaced)"> Start</v-btn>

      <v-btn variant="outlined" color="red" @click="stop" :disabled="!isRunning"> Stop</v-btn>

      <v-btn variant="outlined" color="warning" @click="reset"> Reset</v-btn>

      <div>
        <ProjectInfo />
        <v-btn variant="text" color="warning" @click="resetInputs" :disabled="isRunning"> Reset inputs</v-btn>
      </div>
    </div>

    <v-snackbar v-model="toast" :timeout="timeout">
      {{ toastMessage }}

      <template v-slot:actions>
        <v-btn color="black" variant="text" @click="showHideToast">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import {
  initializeRandomData,
  initializeCentroids,
  svgAttributes,
  nearestCentroid,
  average,
  initializeCircularData,
  initializeGaussianData,
  initializeGridData,
  initializeConcentricData,
  initializeCrescentData,
  initializeEyeData
} from "../utils/kmeans-helpers.js";
import { debounce, isFinite } from 'lodash';
import { mapActions, mapState } from "pinia";

import { useStepsStore } from "../utils/store/stepsStore.js";
import { useHelperStore } from "../utils/store/helperStore.js";

import ProjectInfo from "./ProjectInfo.vue";

const DEFAULT_DATA_AMOUNT = 100;
const DEFAULT_CLUSTER_AMOUNT = 3;
const DEFAULT_ITERATION_AMOUNT = 10;
const CONVERGENCE_THRESHOLD = 0.001;
const DEFAULT_DISTRIBUTION = 'Random';
const DEFAULT_RADIUS = 8;
const DEFAULT_CIRCLES_AMOUNT = 3;
const DEFAULT_VARIANCE = 0.1;
const DEFAULT_SPEED = 2;

const COLOUR = d3.scaleOrdinal(d3.schemeCategory10);

export default {
  data() {
    return {
      centroids: [],
      dataPoints: [],
      previousCentroids: [],
      step: 0,

      manualStepMode: false,

      manualCentroidMode: false,
      manualCentroidCount: 0,

      inputStepIndex: 0,
      currentStepIndex: 0,
      stoppedOnStep: 0,

      //Needed DOM elements
      domNodes: null,
      domCentroids: null,

      //Inputs Binding
      clusterAmount: DEFAULT_CLUSTER_AMOUNT,
      dataPointsAmount: DEFAULT_DATA_AMOUNT,
      iterationAmount: DEFAULT_ITERATION_AMOUNT,
      distribution: DEFAULT_DISTRIBUTION,
      circleAmount: DEFAULT_CIRCLES_AMOUNT,
      circleRadius: DEFAULT_RADIUS,
      gaussianVariance: DEFAULT_VARIANCE,
      iterationSpeed: DEFAULT_SPEED,

      displayVoronoi: false,

      iterationHelper: null,

      // Properties needed for graph drawing
      graphContainer: null,
      linearDomain: null,
      xLinearScale: null,
      yLinearScale: null,

      //Input rules
      rules: {
        required: inputValue => !!inputValue || 'Required',
        mustBeInteger: inputValue => (inputValue && !isNaN(parseInt(inputValue))) || 'Input must be an Integer',
        mustBeNumber: inputValue => isFinite(parseFloat(inputValue)) || 'Input must be a finite number',
        mustBePositive: inputValue => parseFloat(inputValue) >= 0 || 'Input must be a positive number'
      },

      //Interval for interval running
      interval: null,

      // Toast message
      toast: false,
      toastMessage: null,
      toastTimeout: 2000
    }
  },

  components: {
    ProjectInfo
  },

  computed: {
    ...mapState(useStepsStore, ['steps', 'centroidsStep']),
    ...mapState(useHelperStore, ['initialCentroids']),

    isConverged() {
      if (this.previousCentroids.length && this.centroids.length) {
        for (let i = 0; i < this.centroids.length; i++) {
          const current = this.centroids[i];
          const previous = this.previousCentroids[i];

          if (Math.abs(current.x - previous.x) > CONVERGENCE_THRESHOLD ||
            Math.abs(current.y - previous.y) > CONVERGENCE_THRESHOLD) {

            return false;
          }
        }
        return true;
      }

      return false;
    },

    currentStep() {
      return this.steps.filter(step => step.step === this.currentStepIndex) || [];
    },

    currentCentroids() {
      return this.centroidsStep.filter(centroid => centroid.step === this.currentStepIndex) || [];
    },

    isRunning() {
      return !!this.interval;
    },

    isFinished() {
      return !this.manualStepMode && !(this.isConverged || this.step + 1 === parseInt(this.iterationAmount)) || this.isRunning;
    },

    distributionOptions() {
      return ['Random', 'Circular', 'Gaussian', 'Grid', 'Concentric', 'Crescent', 'Eye'];
    },

    isCircularData() {
      return this.distribution === 'Circular';
    },

    isGaussianData() {
      return this.distribution === 'Gaussian';
    },

    isConcentricData() {
      return this.distribution == 'Concentric'
    },

    validNumOfCentroidsPlaced() {
      return this.manualCentroidCount > 0;
    }
  },
  watch: {
    'dataPointsAmount'(value) {
      // After input change, call the re-draw function after 500ms
      this.dataPointsAmount = value;
      this.onDataPointAmountChange();
    },

    'clusterAmount'(value) {
      // After input change, call the re-draw function after 500ms
      this.clusterAmount = value;
      this.onChange(true);
    },

    'iterationAmount'(value) {
      this.iterationHelper = value;
    },

    'displayVoronoi'(value) {
      this.displayVoronoi = value;
      this.drawVoronoi();
    },

    'distribution'() {
      this.onChange();
    },

    'circleAmount'() {
      this.onChange();
    },

    'gaussianVariance'() {
      this.onChange();
    },

    'circleRadius'() {
      this.onChange();
    },

    'manualCentroidMode'(value) {
      if (value) {
        this.enableManualCentroidMode();
      } else {
        this.restoreInitialCentroids();
      }
    },

    'currentStepIndex'(value) {
      this.inputStepIndex = parseInt(value);
    },

    'inputStepIndex'(value) {
      if (value >= 0 && value <= this.stop) {
        this.currentStepIndex = parseInt(value);
        this.updateGraphStep();
      }
    }
  },

  beforeMount() {
    // Initial data
    this.initData(this.dataPointsAmount);
    this.initCentroids(this.clusterAmount, this.dataPointsAmount)

    //Setting up inital scaling and domain
    this.initScale();

    //Initially set up the iteration helper
    this.iterationHelper = this.iterationAmount;

    //Clear previous stored steps
    this.emptyStore();
  },

  mounted() {
    this.drawGraph();
    this.drawAxis();
    this.drawDataPoints();
    this.drawEventLayer();
    this.drawCentroids();
  },

  methods: {
    ...mapActions(useStepsStore, ['addStep', 'addCentroid', 'emptyStore']),
    ...mapActions(useHelperStore, ['setInitialCentroids', 'clearInitialCentroids']),

    initCentroids(clusterCount = DEFAULT_CLUSTER_AMOUNT, dataPointsCount = DEFAULT_DATA_AMOUNT,) {
      const centroids = initializeCentroids(clusterCount, dataPointsCount);

      if (!this.manualCentroidMode) {
        this.setInitialCentroids(centroids);
        this.centroids = centroids;
      }
    },

    initData(dataPointsCount = DEFAULT_DATA_AMOUNT, distribution = DEFAULT_DISTRIBUTION) {
      let data = [];

      if (distribution === 'Random') {
        data = initializeRandomData(dataPointsCount);
      }

      if (distribution === 'Circular') {
        data = initializeCircularData(dataPointsCount, this.circleAmount, this.circleRadius);
      }

      if (distribution === 'Gaussian') {
        data = initializeGaussianData(dataPointsCount, this.clusterAmount, this.gaussianVariance);
      }

      if (distribution === 'Grid') {
        data = initializeGridData(dataPointsCount);
      }

      if (distribution === 'Concentric') {
        data = initializeConcentricData(dataPointsCount, this.circleAmount)
      }

      if (distribution === 'Crescent') {
        data = initializeCrescentData(dataPointsCount);
      }

      if (distribution === 'Eye') {
        data = initializeEyeData(dataPointsCount);
      }

      this.dataPoints = data;
    },

    initScale() {
      this.linearDomain = [0, this.dataPointsAmount];

      this.xLinearScale = d3.scaleLinear().domain(this.linearDomain).range([0, svgAttributes.width]);
      this.yLinearScale = d3.scaleLinear().domain(this.linearDomain).range([svgAttributes.height, 0]);
    },

    drawGraph() {
      const svg = this.graphContainer = d3.select('#container')
        .append('svg')
        .attr('viewBox', `${svgAttributes.x} ${svgAttributes.y} ${svgAttributes.height} ${svgAttributes.width}`)
        .attr('width', `${svgAttributes.width}`)
        .attr('height', `${svgAttributes.height}`)
        .append('g')
        .attr('transform', 'translate(-10, 50)')
        .attr('color', '#e6e8ea')
        .attr('stroke-width', 4)

      // Elements to catch clicks in graphing area
      svg.append('rect')
        .raise()
        .attr('width', svgAttributes.width)
        .attr('height', svgAttributes.height)
        .attr('fill', 'transparent')
        .style('pointer-events', 'all')
        .on('click', (event) => {
          let [x, y] = d3.pointer(event);
          console.log(x, y)
          this.handleGraphClick(x, y);
        });

    },

    drawEventLayer() {
      const svg = this.graphContainer;

      svg.append('rect')
        .raise()
        .attr('width', svgAttributes.width)
        .attr('height', svgAttributes.height)
        .attr('fill', 'transparent')
        .style('pointer-events', 'all')
        .on('click', (event) => {
          let [x, y] = d3.pointer(event);
          this.handleGraphClick(x, y);
        });
    },

    handleGraphClick(x, y) {
      if (this.manualCentroidMode) {
        const xScale = d3.scaleLinear()
          .domain([0, svgAttributes.width - 10])
          .range([0, this.dataPointsAmount]);

        const yScale = d3.scaleLinear()
          .domain([svgAttributes.height, 0])
          .range([0, this.dataPointsAmount]);

        const clickX = xScale(x).toFixed(2);
        const clickY = yScale(y).toFixed(2);

        if (this.manualCentroidCount < parseInt(this.clusterAmount)) {
          this.addManualCentroid(clickX, clickY);
          if (this.manualCentroidCount === parseInt(this.clusterAmount)) {
            this.toastMessage = 'All centroids placed. You can now start the algorithm or drag centroids to adjust their positions.';
            this.showHideToast();
          }
        }
      }
    },

    addManualCentroid(x, y) {
      const newCentroid = { x: parseFloat(x), y: parseFloat(y) };
      this.centroids.push(newCentroid);
      this.manualCentroidCount++;
      this.drawCentroids();
      this.drawVoronoi();
    },

    restoreInitialCentroids() {
      if (this.initialCentroids.length > 0) {
        this.centroids = this.initialCentroids;
        this.manualCentroidCount = 0;
        this.drawCentroids();
        this.drawVoronoi();
        this.showHideToast();
      } else {
        this.initData(this.dataPointsAmount, this.distribution);
        this.drawCentroids();
        this.drawVoronoi();
      }
    },

    enableManualCentroidMode() {
      this.manualCentroidMode = true;
      this.manualCentroidCount = 0;
      this.centroids = [];
      this.drawCentroids();
      this.toastMessage = `Click on the graph to place ${this.clusterAmount} centroids.`;
      this.showHideToast();
    },

    drawAxis() {
      this.graphContainer.selectAll('g').remove();

      // Draw X axis
      this.graphContainer.append('g')
        .attr('transform', `translate(0, ${svgAttributes.height})`)
        .call(d3.axisBottom(this.xLinearScale).tickPadding(10).ticks(this.dataPointsAmount / (this.clusterAmount ** 2)))
        .attr('font-size', '18px')
        .attr('font-weight', 'bold');

      // Draw Y axis
      this.graphContainer.append('g')
        .call(d3.axisLeft(this.yLinearScale).tickPadding(10).ticks(this.dataPointsAmount / (this.clusterAmount ** 2)))
        .attr('font-size', '18px')
        .attr('font-weight', 'bold');
    },

    drawDataPoints() {
      // Remove previous nodes
      this.graphContainer.selectAll('#nodes').remove();

      this.graphContainer.append('g')
        .attr('id', 'nodes')
        .selectAll('circle')
        .data(this.dataPoints)
        .enter()
        .append('circle')
        .attr('class', 'node')
        .attr('cx', (node) => this.xLinearScale(node.x))
        .attr('cy', (node) => this.yLinearScale(node.y))
        .attr('r', 6)
        .attr('stroke', '#e6e8ea')
        .attr('stroke-width', 2)
        .attr('fill', (node) => COLOUR(node.cluster));

      this.domNodes = d3.selectAll('.node');
    },

    drawCentroids() {
      // Get component context;
      const self = this;

      // Remove previous centroids
      this.graphContainer.selectAll('#centroids').remove();

      const centroids = this.graphContainer.append('g')
        .attr('id', 'centroids')
        .selectAll('circle')
        .data(this.centroids)
        .enter()
        .append('circle')
        .attr('class', 'centroid')
        .attr('cx', (centroid) => this.xLinearScale(centroid.x))
        .attr('cy', (centroid) => this.yLinearScale(centroid.y))
        .attr('r', 10)
        .attr('stroke', 'white')
        .attr('stroke-width', 4)
        .attr('fill', (_, index) => COLOUR(index));

        const dragBehavior = d3.drag()
          .on('start', function (event, d) {
            d3.select(this).attr('stroke', 'black')
              .style('cursor', 'grabbing');

            // Initial position
            d.dragStartX = d.x;
            d.dragStartY = d.y;
          })
          .on('drag', function (event, d) {
            if (!self.isRunning && !self.isConverged) {
              console.log('drag');
            const dx = self.xLinearScale.invert(event.x) - self.xLinearScale.invert(event.subject.x);
            const dy = self.yLinearScale.invert(event.y) - self.yLinearScale.invert(event.subject.y);

            // Calculate delta
            d.x = d.dragStartX + dx;
            d.y = d.dragStartY + dy;

            // Draw on graph
            d3.select(this)
              .attr('cx', self.xLinearScale(d.x))
              .attr('cy', self.yLinearScale(d.y))
              .style('cursor', 'grabbing');

            // Continue updating while moving points
            self.drawVoronoi();
            }
          })
          .on('end', function (event, d) {
            d3.select(this).attr('stroke', 'white')
              .style('cursor', 'grab');
          });

          centroids
            .on('mouseover', function (event, d) {
              d3.select(this).style('cursor', 'grab')
            })
            .call(dragBehavior);

      this.domCentroids = d3.selectAll('.centroid');
    },

    drawVoronoi() {
      this.graphContainer.selectAll('.voronoi').remove(); // Remove previous Voronoi cells

      let voronoi = d3.Delaunay
        .from(this.centroids, c => this.xLinearScale(c.x), c => this.yLinearScale(c.y))
        .voronoi([0, 0, svgAttributes.width, svgAttributes.height]);

      this.graphContainer.selectAll('.voronoi')
        .data(voronoi.cellPolygons())
        .enter()
        .append('path')
        .attr('class', 'voronoi')
        .attr('stroke', this.displayVoronoi ? 'red' : 'none') // if we should display voronoi, apply the red stroke, else no stroke
        .attr('stroke-width', '2px')
        .attr('fill', 'none')
        .attr('d', d => `M${d.join('L')}Z`)
    },

    updateClusters() {
      this.dataPoints.forEach((dataPoint) => {
        dataPoint.cluster = nearestCentroid(dataPoint, this.centroids);

        this.domNodes.style('fill', n => COLOUR(n.cluster));
      });
    },

    updateCentroids() {
      this.centroids.forEach((centroid, index) => {
        const cluster = this.dataPoints.filter((node) => node.cluster === index);

        if (cluster.length) {
          centroid.x = average(cluster.map(node => node.x));
          centroid.y = average(cluster.map(node => node.y));
        }
      });

      this.domCentroids
        .transition().duration(500)
        .attr('cx', c => this.xLinearScale(c.x))
        .attr('cy', c => this.yLinearScale(c.y));
    },

    async start() {
      const { valid } = await this.$refs.form.validate();
      if (!valid) {
        this.toastMessage = "Please provide the correct inputs. Program halted!";
        this.showHideToast();

        return;
      }

      this.updateStoreCentroids();

      this.previousCentroids = this.centroids.map(c => ({ x: c.x, y: c.y }));
      this.updateClusters();

      this.updateStoreDataPoints();

      this.drawVoronoi();

      this.interval = setInterval(() => {
        if (this.iterationHelper <= 0) {
          clearInterval(this.interval);
          this.interval = null;

          this.toastMessage = 'Reached maximum iterations';
          this.showHideToast();

          this.stoppedOnStep = this.step - 1;
          this.inputStepIndex = this.getStepsNumber;
          this.step = 0;
          return;
        }

        this.step++;
        this.updateCentroids();
        this.updateStoreCentroids();

        this.updateClusters();
        this.updateStoreDataPoints();

        this.drawVoronoi();

        if (this.isConverged) {
          clearInterval(this.interval);
          this.interval = null;

          this.toastMessage = `Converged after ${this.iterationAmount - this.iterationHelper} iterations`;
          this.showHideToast();

          this.stoppedOnStep = this.step - 1;
          this.step = 0;
          return;
        }

        this.previousCentroids = this.centroids.map(c => ({ x: c.x, y: c.y }));

        this.currentStepIndex = this.step;
        this.iterationHelper--;
      }, this.iterationSpeed * 1000);
    },

    stop() {
      if (this.interval) {
        this.stoppedOnStep = this.step;
        this.manualStepMode = false;
        clearInterval(this.interval);
        this.interval = null;

        this.toastMessage = 'Stopped';
        this.showHideToast();
      }
    },

    reset() {
      this.clearInitialCentroids();
      this.manualStepMode = false;
      this.emptyStore();
      this.currentStepIndex = 0;
      this.stoppedOnStep = 0;
      this.step = 0;

      this.manualCentroidMode = false;
      this.manualCentroidCount = 0;
      this.iterationHelper = this.iterationAmount;
      clearInterval(this.interval);
      this.interval = null;

      this.initData(this.dataPointsAmount, this.distribution);
      this.initCentroids(this.clusterAmount, this.dataPointsAmount);

      this.domNodes = this.graphContainer.select('#nodes')
        .selectAll('.node')
        .data(this.dataPoints)
        .join(
          enter => enter.append('circle')
            .attr('class', 'node')
            .attr('cx', (node) => this.xLinearScale(node.x))
            .attr('cy', (node) => this.yLinearScale(node.y))
            .attr('r', 5)
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('fill', (node) => COLOUR(node.cluster)),
          update => update.transition().duration(500)
            .attr('cx', (node) => this.xLinearScale(node.x))
            .attr('cy', (node) => this.yLinearScale(node.y))
            .style('fill', (node) => COLOUR(node.cluster)),
          exit => exit.remove()
        );

      this.domCentroids = this.graphContainer.select('#centroids')
        .selectAll('.centroid')
        .data(this.centroids)
        .join(
          enter => enter.append('circle')
            .attr('class', 'centroid')
            .attr('cx', (centroid) => this.xLinearScale(centroid.x))
            .attr('cy', (centroid) => this.yLinearScale(centroid.y))
            .attr('r', 10)
            .attr('stroke', 'white')
            .attr('stroke-width', 4)
            .attr('fill', (_, index) => COLOUR(index)),
          update => update.transition().duration(500)
            .attr('cx', (centroid) => this.xLinearScale(centroid.x))
            .attr('cy', (centroid) => this.yLinearScale(centroid.y)),
          exit => exit.remove()
        );

      this.drawVoronoi();
    },

    updateStoreDataPoints() {
      this.dataPoints.forEach((dataPoint) => {
        this.addStep({ x: dataPoint.x, y: dataPoint.y, cluster: dataPoint.cluster, step: this.step });
      });
    },

    updateStoreCentroids() {
      this.centroids.forEach(centroid => {
        this.addCentroid({ x: centroid.x, y: centroid.y, step: this.step })
      });
    },

    showHideToast() {
      this.toast = !this.toast;
    },

    updateGraphStep() {
      if (this.currentStep.length === 0) return;

      this.dataPoints = this.currentStep.map(point => ({
        x: point.x,
        y: point.y,
        cluster: point.cluster
      }));

      this.centroids = this.currentCentroids.map(centroid => ({
        x: centroid.x,
        y: centroid.y
      }));

      this.drawDataPoints();
      this.drawCentroids();
      this.drawVoronoi();
    },

    firstStep() {
      this.manualStepMode = true;
      this.currentStepIndex = 0;
      this.updateGraphStep();
    },

    lastStep() {
      this.manualStepMode = true;
      this.currentStepIndex = this.stoppedOnStep;
      this.updateGraphStep();
    },

    nextStep() {
      this.manualStepMode = true;
      if (this.currentStepIndex !== this.stoppedOnStep) {
        this.currentStepIndex++;
        this.updateGraphStep();
      }
    },

    previousStep() {
      this.manualStepMode = true;
      if (this.currentStepIndex !== 0) {
        this.currentStepIndex--;
        this.updateGraphStep();
      }
    },

    resetInputs() {
      this.clusterAmount = DEFAULT_CLUSTER_AMOUNT;
      this.dataPointsAmount = DEFAULT_DATA_AMOUNT;
      this.iterationAmount = DEFAULT_ITERATION_AMOUNT;
      this.distribution = DEFAULT_DISTRIBUTION;
      this.circleAmount = DEFAULT_CIRCLES_AMOUNT;
      this.circleRadius = DEFAULT_RADIUS;
      this.gaussianVariance = DEFAULT_VARIANCE;
      this.iterationSpeed = DEFAULT_SPEED;

      this.emptyStore();
    },

    generateRandomCentroids() {
      this.initCentroids(this.clusterAmount, this.dataPointsAmount);
      this.setInitialCentroids(this.centroids);

      this.currentStepIndex = 0;
      this.stoppedOnStep = 0;
      this.step = 0;
      this.iterationHelper = this.iterationAmount;

      this.drawCentroids();
      this.drawVoronoi();
    },

    generateNewData() {
      this.initData(this.dataPointsAmount, this.distribution);

      this.currentStepIndex = 0;
      this.stoppedOnStep = 0;
      this.step = 0;
      this.iterationHelper = this.iterationAmount;

      this.drawDataPoints();
      this.drawCentroids();
    },
    // Debounced (delayed) functions
    onDataPointAmountChange: debounce(function () {
      this.initData(this.dataPointsAmount, this.distribution);
      this.initScale();
      this.drawAxis();
      this.drawVoronoi();

      this.drawDataPoints();
      this.drawEventLayer();
      this.drawCentroids();
      this.emptyStore();
    }, 500),

    onChange: debounce(function (fromInputChange = false) {
      this.initData(this.dataPointsAmount, this.distribution);
      if (fromInputChange) {
        this.initCentroids(this.clusterAmount, this.dataPointsAmount);
        this.setInitialCentroids(this.centroids);
      }
      this.drawVoronoi();
      this.drawDataPoints();
      this.drawEventLayer();
      this.drawCentroids();
      this.emptyStore();

    }, 500),
  }
}
</script>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;

  margin-top: 3vh;
}

.crossCursor {
  cursor: crosshair;
}

.controlsFooter {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: auto;

  width: 400px;
}

.inputs {
  display: flex;
  flex-direction: column;
  width: 330px;

  margin-left: 10vh;
  margin-top: 3vh;
}

.buttons {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;

  gap: 10px;
}

.circularInputs {
  display: flex;
  justify-content: space-between;
}

.amountInput {
  margin-right: 5px;
}

.radiusInput {
  margin-left: 5px;
}

.controls {
  display: flex;
  justify-content: space-between;
  width: 300px;
}

.stepTotal {
  margin-left: 20px;
}

.centroidMode {
  display: flex;
  justify-content: space-between;
  padding-right: 40px;
}

.distributionData {
  display: flex;
  justify-content: space-between;
}
</style>
