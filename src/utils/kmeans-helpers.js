import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Constants and needed functions
export const svgAttributes = {
  x: 10,
  y: 10,
  width: 700,
  height: 600,
};

function addJitter(value, dataPointAmount) {
  return value + Math.floor(Math.random() * (dataPointAmount / 50));
}

function euclideanDistance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// Determine closest centroid and assign to cluster
export function nearestCentroid(node, centroids) {
  let distances = centroids.map((c) => euclideanDistance(c, node));
  return distances.findIndex((distance) => distance === Math.min(...distances));
}

// Determine average distance to update centroids
export function average(values) {
  if (!values.length) {
    return 0;
  }

  let sum = 0;
  values.forEach((number) => {
    sum += number;
  });

  return sum / values.length;
}

export function initializeCentroids(clusters, dataPointAmount) {
  let centroids = d3.range(clusters).map(() => ({
    x: Math.floor(Math.random() * dataPointAmount),
    y: Math.floor(Math.random() * dataPointAmount),
  }));

  return centroids;
}

export function initializeRandomData(dataPointAmount) {
  let data = d3.range(dataPointAmount).map(() => ({
    x: Math.floor(Math.random() * dataPointAmount),
    y: Math.floor(Math.random() * dataPointAmount),
    cluster: null,
  }));
  return data;
}

function isValidCenter(newCenter, centers, minDistance) {
  return centers.every((center) => {
    const distance = Math.sqrt(
      Math.pow(center.x - newCenter.x, 2) + Math.pow(center.y - newCenter.y, 2)
    );
    return distance >= minDistance;
  });
}

export function initializeCircularData(dataPointAmount, circles, radiusInput) {
  const RADIUS = Number(radiusInput);
  const MIN_DISTANCE = 2 * RADIUS;
  let angle = null;
  let radius = null;

  let validCenters = [];

  while (validCenters.length < circles) {
    let potentialCenter = {
      x: Math.floor(Math.random() * (dataPointAmount - 2 * RADIUS)) + RADIUS,
      y: Math.floor(Math.random() * (dataPointAmount - 2 * RADIUS)) + RADIUS,
    };

    if (isValidCenter(potentialCenter, validCenters, MIN_DISTANCE)) {
      validCenters.push(potentialCenter);
    }
  }

  let data = validCenters.flatMap((center) =>
    d3.range(Math.floor(dataPointAmount / circles)).map(() => {
      angle = Math.random() * 2 * Math.PI;
      radius = RADIUS * Math.sqrt(Math.random());
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        cluster: null,
      };
    })
  );

  return data;
}

export function initializeGaussianData(
  dataPointAmount,
  clusters,
  varianceAmount
) {
  let data = [];
  const clusterCenters = initializeCentroids(clusters, dataPointAmount);
  const variance = dataPointAmount * varianceAmount;
  const gaussian = d3.randomNormal(0, Math.sqrt(variance));

  clusterCenters.forEach((center) => {
    let clusterData = d3.range(dataPointAmount / clusters).map(() => ({
      x: center.x + gaussian(),
      y: center.y + gaussian(),
      cluster: null,
    }));
    data = data.concat(clusterData);
  });

  return data;
}

export function initializeGridData(dataPointAmount) {
  const cellScale = dataPointAmount * 0.1;

  let data = [];

  for (let i = 0; i <= cellScale; i++) {
    for (let j = 0; j <= cellScale; j++) {
      const x = i * cellScale;
      const y = j * cellScale;

      data.push({
        x: addJitter(x, dataPointAmount),
        y: addJitter(y, dataPointAmount),
        cluster: null,
      });
    }

    if (data.length > dataPointAmount) {
      break;
    }
  }

  return data;
}

export function initializeConcentricData(dataPointAmount, circleAmount) {
  const centerX = dataPointAmount * 5;
  const centerY = dataPointAmount * 5;
  const maxRadius = Math.min(centerX, centerY) * 0.9;

  let data = [];
  const pointsPerCircle = Math.floor(dataPointAmount / circleAmount);
  const angleIncrement = (2 * Math.PI) / pointsPerCircle;

  for (let i = 1; i <= circleAmount; i++) {
    const radius = (i / circleAmount) * maxRadius;

    for (let j = 0; j < pointsPerCircle; j++) {
      const angle = j * angleIncrement;
      data.push({
        x: addJitter(
          (centerX + radius * Math.cos(angle)) / 10,
          dataPointAmount
        ),
        y: addJitter(
          (centerY + radius * Math.sin(angle)) / 10,
          dataPointAmount
        ),
        cluster: null,
      });
    }
  }
  return data;
}

export function initializeCrescentData(dataPointAmount) {
  const centerX = dataPointAmount / 2;
  const centerY = dataPointAmount / 2;

  const maxRadius = Math.min(centerX, centerY) * 0.5;

  const angle = Math.PI;
  let data = [];

  for (let i = 0; i <= dataPointAmount / 2; i++) {
    let theta = angle * (i / (dataPointAmount / 2));
    let x = centerX + maxRadius * Math.cos(theta);
    let y = centerY + maxRadius * Math.sin(theta);
    data.push({
      x: addJitter(x, dataPointAmount),
      y: addJitter(y, dataPointAmount),
      cluster: null,
    });
  }

  for (let i = 0; i <= dataPointAmount / 2; i++) {
    let theta = Math.PI + angle * (i / (dataPointAmount / 2));
    let x = dataPointAmount / 5 + centerX + maxRadius * Math.cos(theta);
    let y = centerY + maxRadius * Math.sin(theta);
    data.push({
      x: addJitter(x, dataPointAmount),
      y: addJitter(y, dataPointAmount),
      cluster: null,
    });
  }

  return data;
}

export function initializeEyeData(dataPointAmount) {
  const centerX = dataPointAmount / 2;
  const centerY = dataPointAmount / 2;

  const eyeWidth = dataPointAmount;
  const eyeHeight = dataPointAmount * 0.5;

  const irisRadius = dataPointAmount / 10;

  let data = [];

  const eyelidPoints = Math.floor(dataPointAmount * 0.7);
  for (let i = 0; i < eyelidPoints; i++) {
    let angle, r;
    if (i < eyelidPoints / 2) {
      angle = Math.PI * (Math.random() * 0.5 + 0.25);
      r = (eyeWidth / 2) * Math.pow(Math.sin(angle), 0.4);
    } else {
      angle = Math.PI * (Math.random() * 0.5 + 1.25);
      r = (eyeWidth / 2) * Math.pow(Math.sin(Math.PI + angle), 0.4);
    }
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle) * (eyeHeight / eyeWidth);
    data.push({
      x: addJitter(x, dataPointAmount),
      y: addJitter(y, dataPointAmount),
      cluster: null,
    });
  }

  const irisPoints = Math.floor(dataPointAmount * 0.3);
  for (let i = 0; i < irisPoints; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const r = irisRadius * Math.pow(Math.random(), 0.3);
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    data.push({
      x: addJitter(x, dataPointAmount),
      y: addJitter(y, dataPointAmount),
      cluster: null,
    });
  }
  return data;
}
