<template>
  <v-dialog max-width="750">
    <template v-slot:activator="{ props: activatorProps }">
      <v-btn v-bind="activatorProps" color="primary" text="Project Info" variant="text"></v-btn>
    </template>

    <template v-slot:default="{ isActive }">
      <v-card title="K-Means visualization app">
        <v-card-subtitle>
          Creators: Kristijan Ristovski (index: 196062) and Vladimir Grncharovski (index: 211028)
        </v-card-subtitle>
        <v-card-text>
          <p>
            This project was created as a final assignment for the Introduction to Data Science course
            at the Faculty of Computer Science and Engineering (FCSE) in Skopje, under the mentorship of
            Professor Andrea Kulakov, Ph.D.
          </p>
          <br />
          <p>
            This app is an educational tool designed to illustrate the inner workings
            of the K-means clustering algorithm using a custom implementation of the algorithm in JavaScript to display
            the knowlegde aquired by the creators from the coursework.
          </p>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>

          <v-btn text="Close" @click="isActive.value = false"></v-btn>
        </v-card-actions>
      </v-card>
    </template>
  </v-dialog>
</template>

<script>

</script>

<style scoped></style>
