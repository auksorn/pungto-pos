<script setup lang="ts">
const { user } = useUserSession()
const navItems = useNavItems()
</script>

<template>
  <UContainer class="py-8">
    <h1 class="text-2xl font-bold">
      สวัสดี, {{ user?.name }}
    </h1>
    <p class="text-muted mt-1 mb-6">
      สาขา: {{ user?.branchName ?? '-' }} · สิทธิ์: {{ user?.role }}
    </p>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <UCard
        v-for="item in navItems"
        :key="item.to"
        class="cursor-pointer hover:ring-2 hover:ring-primary active:ring-2 active:ring-primary transition-shadow select-none"
        :ui="{ body: 'p-6 flex flex-col items-center justify-center gap-3 text-center min-h-32' }"
        @click="navigateTo(item.to)"
      >
        <UIcon
          :name="item.icon"
          class="size-8 text-primary"
        />
        <span class="font-medium">{{ item.label }}</span>
      </UCard>
    </div>
  </UContainer>
</template>
