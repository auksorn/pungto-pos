// Shared with the header's own nav (app.vue) and the home page's tile grid —
// one role-gated source of truth for "what sections can this user reach."
export function useNavItems() {
  const { user } = useUserSession()

  return computed(() => {
    if (!user.value) return []
    const role = user.value.role
    return [
      { label: 'ขายหน้าร้าน', to: '/pos', icon: 'i-lucide-shopping-cart' },
      { label: 'สต๊อก', to: '/stock', icon: 'i-lucide-package' },
      ...(['owner', 'manager'].includes(role) ? [{ label: 'จัดการเมนู', to: '/menu', icon: 'i-lucide-coffee' }] : []),
      ...(['owner', 'manager'].includes(role) ? [{ label: 'รายงาน', to: '/reports', icon: 'i-lucide-bar-chart-3' }] : []),
      ...(['owner', 'manager'].includes(role) ? [{ label: 'เวลาเข้างาน', to: '/time-entries', icon: 'i-lucide-clock' }] : []),
      ...(role === 'owner' ? [{ label: 'จัดการสาขา', to: '/branches', icon: 'i-lucide-store' }] : []),
      ...(role === 'owner' ? [{ label: 'จัดการพนักงาน', to: '/employees', icon: 'i-lucide-users' }] : [])
    ]
  })
}
