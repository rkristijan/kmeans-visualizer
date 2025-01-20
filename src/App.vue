<template>
  <div class="wrapper">
    <div class="graph">
      <Graph/>
    </div>
  </div>
</template>

<script >
import Graph from './components/Graph.vue'

export default {
  components: {
    Graph
  }
}
</script>

<style scoped>
.wrapper {
  display: flex;
  justify-content: center;
}

.graph {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 700px;
}
</style>
