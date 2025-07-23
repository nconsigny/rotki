<script setup lang="ts">
import { useTrezor, type TrezorAddress } from '@/composables/blockchain/trezor'

definePage({
  meta: {
    title: 'Trezor Demo',
  },
  name: 'trezor-demo',
});

const { t } = useI18n({ useScope: 'global' });

const {
  ready,
  deviceInfo,
  isConnecting,
  isDerivingAddresses,
  addresses,
  error,
  connectDevice,
  disconnectDevice,
  deriveEth,
  deriveEthereumAddresses,
  isWebUSBSupported,
  isTrezorBridgeNeeded,
} = useTrezor();

const selectedAddresses = ref<Set<string>>(new Set());
const derivationCount = ref(10);

const hasAddresses = computed(() => get(addresses).length > 0);
const selectedCount = computed(() => get(selectedAddresses).size);
const isConnected = computed(() => get(deviceInfo)?.isConnected ?? false);

async function handleConnect() {
  await connectDevice();
}

async function handleLoadAddresses() {
  try {
    await deriveEthereumAddresses(get(derivationCount));
    
    // Auto-select first address
    const addressList = get(addresses);
    if (addressList.length > 0) {
      get(selectedAddresses).add(addressList[0].address);
    }
  } catch (err: any) {
    console.error('Failed to load addresses:', err);
  }
}

function toggleAddressSelection(address: string) {
  const selected = get(selectedAddresses);
  if (selected.has(address)) {
    selected.delete(address);
  } else {
    selected.add(address);
  }
}

function selectAllAddresses() {
  const selected = get(selectedAddresses);
  get(addresses).forEach(addr => selected.add(addr.address));
}

function clearSelection() {
  get(selectedAddresses).clear();
}

function importSelectedAddresses() {
  const selected = Array.from(get(selectedAddresses));
  console.log('Would import addresses:', selected);
  
  // In real implementation, this would emit the addresses to the parent component
  // emit('update:addresses', selected);
  
  // For demo purposes, just show a success message
  alert(`Would import ${selected.length} addresses to rotki`);
}

async function deriveSingleAddress() {
  try {
    const address = await deriveEth();
    console.log('Derived address:', address);
  } catch (err: any) {
    console.error('Failed to derive address:', err);
  }
}
</script>

<template>
  <div class="container mx-auto p-6 max-w-4xl">
    <div class="space-y-6">
      <!-- Header -->
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ t('trezor_demo.title', 'Trezor Hardware Wallet Demo') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('trezor_demo.description', 'Test Trezor integration for address derivation') }}
        </p>
      </div>

      <!-- Browser Compatibility Info -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          {{ t('trezor_demo.browser_compatibility', 'Browser Compatibility') }}
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full" :class="isWebUSBSupported() ? 'bg-green-500' : 'bg-red-500'"></span>
            <span class="text-gray-700 dark:text-gray-300">
              WebUSB Support: {{ isWebUSBSupported() ? 'Available' : 'Not Available' }}
            </span>
          </div>
          <div class="flex items-center space-x-2">
            <span class="w-3 h-3 rounded-full" :class="isTrezorBridgeNeeded() ? 'bg-yellow-500' : 'bg-green-500'"></span>
            <span class="text-gray-700 dark:text-gray-300">
              Trezor Bridge: {{ isTrezorBridgeNeeded() ? 'Required (Firefox/Safari)' : 'Not Required (Chrome/Edge/Brave)' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Connection Status -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">{{ t('trezor_demo.connection_status', 'Connection Status') }}</h2>
        
        <div class="space-y-4">
          <div class="flex items-center space-x-3">
            <span class="text-sm font-medium">{{ t('trezor_demo.trezor_ready', 'Trezor Connect Ready:') }}</span>
            <span class="px-2 py-1 rounded text-xs font-medium" 
                  :class="ready ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'">
              {{ ready ? 'Ready' : 'Not Ready' }}
            </span>
          </div>

          <div v-if="deviceInfo" class="space-y-2">
            <div class="flex items-center space-x-3">
              <span class="text-sm font-medium">{{ t('trezor_demo.device_name', 'Device:') }}</span>
              <span class="text-sm">{{ deviceInfo.deviceName }}</span>
            </div>
            <div class="flex items-center space-x-3">
              <span class="text-sm font-medium">{{ t('trezor_demo.device_id', 'Device ID:') }}</span>
              <span class="text-sm font-mono">{{ deviceInfo.deviceId }}</span>
            </div>
          </div>

          <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p class="text-red-700 dark:text-red-300 text-sm">{{ error }}</p>
          </div>

          <div class="flex space-x-3">
            <button 
              @click="handleConnect"
              :disabled="isConnecting || !ready"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded font-medium">
              <span v-if="isConnecting">{{ t('trezor_demo.connecting', 'Connecting...') }}</span>
              <span v-else-if="isConnected">{{ t('trezor_demo.reconnect', 'Reconnect') }}</span>
              <span v-else>{{ t('trezor_demo.connect', 'Connect Device') }}</span>
            </button>
            
            <button 
              v-if="isConnected"
              @click="disconnectDevice"
              class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium">
              {{ t('trezor_demo.disconnect', 'Disconnect') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Address Derivation -->
      <div v-if="isConnected" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 class="text-xl font-semibold mb-4">{{ t('trezor_demo.address_derivation', 'Address Derivation') }}</h2>
        
        <div class="space-y-4">
          <div class="flex items-center space-x-4">
            <label class="text-sm font-medium">{{ t('trezor_demo.addresses_to_derive', 'Addresses to derive:') }}</label>
            <input 
              v-model.number="derivationCount"
              type="number" 
              min="1" 
              max="50"
              class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700">
          </div>

          <div class="flex space-x-3">
            <button 
              @click="handleLoadAddresses"
              :disabled="isDerivingAddresses"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded font-medium">
              <span v-if="isDerivingAddresses">{{ t('trezor_demo.deriving', 'Deriving Addresses...') }}</span>
              <span v-else>{{ t('trezor_demo.derive_addresses', 'Derive Addresses') }}</span>
            </button>

            <button 
              @click="deriveSingleAddress"
              :disabled="isDerivingAddresses"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded font-medium">
              {{ t('trezor_demo.derive_next', 'Derive Next Address') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Address List -->
      <div v-if="hasAddresses" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">{{ t('trezor_demo.derived_addresses', 'Derived Addresses') }}</h2>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ selectedCount }} of {{ addresses.length }} selected
          </div>
        </div>

        <div class="space-y-3 mb-4">
          <div class="flex space-x-3">
            <button 
              @click="selectAllAddresses"
              class="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm">
              {{ t('trezor_demo.select_all', 'Select All') }}
            </button>
            <button 
              @click="clearSelection"
              class="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm">
              {{ t('trezor_demo.clear_selection', 'Clear Selection') }}
            </button>
            <button 
              @click="importSelectedAddresses"
              :disabled="selectedCount === 0"
              class="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm">
              {{ t('trezor_demo.import_selected', 'Import Selected') }} ({{ selectedCount }})
            </button>
          </div>
        </div>

        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div 
            v-for="(addr, i) in addresses" 
            :key="i"
            class="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="toggleAddressSelection(addr.address)">
            
            <input 
              type="checkbox" 
              :checked="selectedAddresses.has(addr.address)"
              class="w-4 h-4 text-blue-600 rounded">
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 mb-1">
                <span class="text-sm font-medium text-gray-900 dark:text-white">Index {{ addr.index }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ addr.derivationPath }}</span>
              </div>
              <div class="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                {{ addr.address }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 class="font-semibold text-gray-900 dark:text-white mb-3">
          {{ t('trezor_demo.instructions', 'Instructions') }}
        </h3>
        <ol class="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>{{ t('trezor_demo.step1', 'Connect your Trezor device to your computer') }}</li>
          <li>{{ t('trezor_demo.step2', 'Unlock your Trezor device with your PIN') }}</li>
          <li>{{ t('trezor_demo.step3', 'Click "Connect Device" to establish connection') }}</li>
          <li>{{ t('trezor_demo.step4', 'Use "Derive Addresses" to generate Ethereum addresses') }}</li>
          <li>{{ t('trezor_demo.step5', 'Each address derivation requires confirmation on your Trezor device') }}</li>
          <li>{{ t('trezor_demo.step6', 'Select addresses you want to import and click "Import Selected"') }}</li>
        </ol>
      </div>
    </div>
  </div>
</template> 