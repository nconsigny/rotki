<!-- frontend/src/components/TrezorAddresses.vue -->
<script setup lang="ts">
import { useTrezor } from '@/composables/blockchain/trezor'
const { addresses, deriveEth } = useTrezor()
</script>

<template>
  <div class="space-y-4">
    <button class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
            @click="deriveEth()">
      Derive next address
    </button>

    <ul>
      <li v-for="(addr,i) in addresses" :key="i" class="font-mono text-sm">
        {{ i }} ➜ {{ addr.address }}
      </li>
    </ul>
  </div>
</template> 