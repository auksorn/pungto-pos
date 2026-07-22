<script setup lang="ts">
const code = defineModel<string>({ required: true })
defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ submit: [] }>()

function pressDigit(digit: string) {
  if (code.value.length < 8) code.value += digit
}

function backspace() {
  code.value = code.value.slice(0, -1)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UInput
      v-model="code"
      type="password"
      inputmode="numeric"
      size="xl"
      class="w-full text-center"
      readonly
      placeholder="รหัสพนักงาน"
    />
    <div class="grid grid-cols-3 gap-2">
      <UButton
        v-for="digit in ['1', '2', '3', '4', '5', '6', '7', '8', '9']"
        :key="digit"
        size="xl"
        color="neutral"
        variant="soft"
        @click="pressDigit(digit)"
      >
        {{ digit }}
      </UButton>
      <UButton
        size="xl"
        color="neutral"
        variant="soft"
        icon="i-lucide-delete"
        @click="backspace"
      />
      <UButton
        size="xl"
        color="neutral"
        variant="soft"
        @click="pressDigit('0')"
      >
        0
      </UButton>
      <UButton
        size="xl"
        color="primary"
        :loading="loading"
        :disabled="code.length < 4"
        @click="emit('submit')"
      >
        ตกลง
      </UButton>
    </div>
  </div>
</template>
