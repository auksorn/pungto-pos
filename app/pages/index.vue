<script setup lang="ts">
const { user } = useUserSession()
</script>

<template>
  <UContainer class="py-8">
    <h1 class="text-2xl font-bold">
      สวัสดี, {{ user?.name }}
    </h1>
    <p class="text-muted mt-1">
      สาขา: {{ user?.branchName ?? '-' }} · สิทธิ์: {{ user?.role }}
    </p>
  </UContainer>
</template>
