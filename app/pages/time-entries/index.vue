<script setup lang="ts">
definePageMeta({
  middleware: [() => {
    const { user } = useUserSession()
    if (user.value && !['owner', 'manager'].includes(user.value.role)) {
      return navigateTo('/')
    }
  }]
})

interface TimeEntry {
  id: number
  clockIn: string
  clockOut: string | null
  employee: { id: number, name: string }
  branch: { id: number, name: string }
}

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type Preset = 'today' | '7d' | '30d' | 'custom'

const activePreset = ref<Preset>('today')
const from = ref(toDateStr(new Date()))
const to = ref(toDateStr(new Date()))

const presets: { key: Preset, label: string }[] = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d', label: '7 วันล่าสุด' },
  { key: '30d', label: '30 วันล่าสุด' }
]

function applyPreset(preset: Preset) {
  activePreset.value = preset
  const now = new Date()
  if (preset === 'today') {
    from.value = toDateStr(now)
    to.value = toDateStr(now)
  } else if (preset === '7d') {
    from.value = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6))
    to.value = toDateStr(now)
  } else if (preset === '30d') {
    from.value = toDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29))
    to.value = toDateStr(now)
  }
}

function onCustomDateChange() {
  activePreset.value = 'custom'
}

const query = computed(() => ({ from: from.value, to: to.value }))
const { data: entries, status } = await useFetch<TimeEntry[]>('/api/time-entries', { query })

const showBranchColumn = computed(() => new Set((entries.value ?? []).map(e => e.branch.id)).size > 1)

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDuration(entry: TimeEntry) {
  const end = entry.clockOut ? new Date(entry.clockOut) : new Date()
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(entry.clockIn).getTime()) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`
}
</script>

<template>
  <UContainer class="py-6 flex flex-col gap-4">
    <UCard>
      <template #header>
        <h1 class="font-bold text-lg">
          เวลาเข้า-ออกงาน
        </h1>
      </template>

      <div class="flex flex-wrap items-center gap-2.5">
        <UButton
          v-for="p in presets"
          :key="p.key"
          size="lg"
          :color="activePreset === p.key ? 'primary' : 'neutral'"
          :variant="activePreset === p.key ? 'solid' : 'soft'"
          @click="applyPreset(p.key)"
        >
          {{ p.label }}
        </UButton>
        <div class="flex items-center gap-2 ml-2">
          <UInput
            v-model="from"
            type="date"
            size="lg"
            @change="onCustomDateChange"
          />
          <span class="text-muted">ถึง</span>
          <UInput
            v-model="to"
            type="date"
            size="lg"
            @change="onCustomDateChange"
          />
        </div>
      </div>
    </UCard>

    <UCard>
      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="flex items-center justify-between py-3 gap-2"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium truncate">
                {{ entry.employee.name }}
              </p>
              <UBadge
                v-if="!entry.clockOut"
                color="success"
                variant="subtle"
              >
                กำลังทำงาน
              </UBadge>
              <UBadge
                v-if="showBranchColumn"
                color="neutral"
                variant="subtle"
              >
                {{ entry.branch.name }}
              </UBadge>
            </div>
            <p class="text-sm text-muted">
              เข้า {{ formatDateTime(entry.clockIn) }}
              <template v-if="entry.clockOut">
                · ออก {{ formatDateTime(entry.clockOut) }}
              </template>
            </p>
          </div>
          <p class="text-sm text-muted shrink-0">
            {{ formatDuration(entry) }}
          </p>
        </div>
        <p
          v-if="status === 'success' && !entries?.length"
          class="text-muted text-sm py-4"
        >
          ไม่มีรายการในช่วงที่เลือก
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
