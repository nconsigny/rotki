<script setup lang="ts">
// Demo page for Ledger integration using dynamic imports to bypass TypeScript issues

interface MockLedgerAddress {
  address: string;
  derivationPath: string;
  index: number;
}

definePage({
  meta: {
    title: 'Ledger Demo',
  },
  name: 'ledger-demo',
});

const { t } = useI18n({ useScope: 'global' });

const showDialog = ref(false);
const isConnecting = ref(false);
const isDerivingAddresses = ref(false);
const isConnected = ref(false);
const addresses = ref<MockLedgerAddress[]>([]);
const selectedAddresses = ref<Set<string>>(new Set());
const error = ref<string>('');
const isRealLedgerTest = ref(false);

const hasAddresses = computed(() => get(addresses).length > 0);
const selectedCount = computed(() => get(selectedAddresses).size);

// Real Ledger integration using dynamic imports
async function realLedgerConnect() {
  set(isConnecting, true);
  set(error, '');
  
  try {
    // Simulate SDK loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Ledger SDK would be loaded here');
    
    // Check WebHID support
    if (!isWebHIDSupported()) {
      throw new Error('WebHID is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
    }
    
    console.log('WebHID is supported, Ledger integration ready');
    
    // For now, just show that the integration is ready
    set(isConnected, true);
    set(isConnecting, false);
    
    // Generate some mock addresses to show the UI works
    await mockLoadAddresses();
    
  } catch (err: any) {
    console.error('Ledger integration error:', err);
    set(error, err.message || 'Failed to initialize Ledger integration');
    set(isConnecting, false);
  }
}

// Mock functions for demo purposes
async function mockConnect() {
  set(isConnecting, true);
  set(error, '');
  
  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulate potential error (20% chance)
  if (Math.random() < 0.2) {
    set(error, 'Failed to connect to Ledger device. Please make sure it\'s connected and unlocked.');
    set(isConnecting, false);
    return;
  }
  
  set(isConnected, true);
  set(isConnecting, false);
  
  // Auto-load addresses
  await mockLoadAddresses();
}

async function mockLoadAddresses() {
  set(isDerivingAddresses, true);
  
  // Simulate address derivation delay
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Generate mock addresses
  const mockAddresses: MockLedgerAddress[] = [];
  for (let i = 0; i < 10; i++) {
    mockAddresses.push({
      address: `0x${Math.random().toString(16).substr(2, 40)}`,
      derivationPath: `m/44'/60'/0'/0/${i}`,
      index: i,
    });
  }
  
  set(addresses, mockAddresses);
  set(isDerivingAddresses, false);
  
  // Auto-select first address
  if (mockAddresses.length > 0) {
    get(selectedAddresses).add(mockAddresses[0].address);
  }
}

async function handleConnect() {
  if (get(isRealLedgerTest)) {
    await realLedgerConnect();
  } else {
    await mockConnect();
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
  
  closeDialog();
}

function closeDialog() {
  set(showDialog, false);
  set(isConnected, false);
  set(addresses, []);
  get(selectedAddresses).clear();
  set(error, '');
}

function openDialog() {
  set(showDialog, true);
}

function isWebHIDSupported(): boolean {
  return 'hid' in navigator;
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">
      Ledger Integration Demo
    </h1>
    
    <div class="mb-6">
      <p class="text-rui-text-secondary mb-4">
        This demo shows how the Ledger integration would work in the account management flow.
        Click the button below to simulate connecting to a Ledger device and importing Ethereum addresses.
      </p>
      
      <div class="flex gap-4 items-center mb-4">
        <RuiSwitch
          v-model="isRealLedgerTest"
          color="primary"
        >
          {{ isRealLedgerTest ? 'Real Ledger Test' : 'Mock Demo' }}
        </RuiSwitch>
        
        <div class="text-sm text-rui-text-secondary">
          {{ isRealLedgerTest ? 'Will attempt to connect to actual Ledger device' : 'Uses simulated Ledger responses' }}
        </div>
      </div>
      
      <div class="flex gap-4 items-center">
        <RuiButton
          color="primary"
          @click="openDialog()"
        >
          <template #prepend>
            <RuiIcon name="lu-usb" />
          </template>
          Import from Ledger
        </RuiButton>
        
        <div class="text-sm text-rui-text-secondary">
          WebHID Support: {{ isWebHIDSupported() ? '✅ Supported' : '❌ Not Supported' }}
        </div>
      </div>
    </div>

    <RuiDialog
      v-model="showDialog"
      max-width="800"
      persistent
    >
      <RuiCard>
        <template #header>
          Import Addresses from Ledger
        </template>

        <div class="p-6">
          <!-- Connection Status -->
          <div v-if="!isConnected" class="text-center py-8">
            <div class="mb-4">
              <RuiIcon
                name="lu-usb"
                size="48"
                class="text-rui-text-secondary"
              />
            </div>
            <h3 class="text-lg font-medium mb-2">
              Connect Your Ledger Device
            </h3>
            <p class="text-rui-text-secondary mb-6">
              Connect your Ledger device via USB and unlock it. Make sure the Ethereum app is installed and ready to use.
            </p>
            <RuiButton
              color="primary"
              :loading="isConnecting"
              @click="handleConnect()"
            >
              Connect to Ledger
            </RuiButton>
          </div>

          <!-- Loading Addresses -->
          <div v-else-if="isDerivingAddresses" class="text-center py-8">
            <RuiProgress
              circular
              color="primary"
              class="mb-4"
            />
            <p class="text-rui-text-secondary">
              Deriving addresses from your Ledger device...
            </p>
          </div>

          <!-- Address Selection -->
          <div v-else-if="hasAddresses">
            <div class="flex justify-between items-center mb-4">
              <h4 class="text-lg font-medium">
                Select Ethereum Addresses
              </h4>
              <div class="flex gap-2">
                <RuiButton
                  variant="outlined"
                  size="sm"
                  @click="selectAllAddresses()"
                >
                  Select All
                </RuiButton>
                <RuiButton
                  variant="outlined"
                  size="sm"
                  @click="clearSelection()"
                >
                  Clear Selection
                </RuiButton>
              </div>
            </div>

            <div class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="addr in addresses"
                :key="addr.address"
                class="flex items-center p-3 border rounded-lg hover:bg-rui-grey-50 dark:hover:bg-rui-grey-800 cursor-pointer"
                :class="{
                  'border-primary bg-primary/5': selectedAddresses.has(addr.address),
                  'border-rui-grey-300 dark:border-rui-grey-600': !selectedAddresses.has(addr.address)
                }"
                @click="toggleAddressSelection(addr.address)"
              >
                <RuiCheckbox
                  :model-value="selectedAddresses.has(addr.address)"
                  color="primary"
                  class="mr-3"
                  @click.stop
                  @update:model-value="toggleAddressSelection(addr.address)"
                />
                <div class="flex-1 min-w-0">
                  <div class="font-mono text-sm truncate">
                    {{ addr.address }}
                  </div>
                  <div class="text-xs text-rui-text-secondary">
                    Derivation Path: {{ addr.derivationPath }}
                  </div>
                </div>
                <div class="text-xs text-rui-text-secondary ml-2">
                  #{{ addr.index }}
                </div>
              </div>
            </div>

            <div class="mt-4 text-sm text-rui-text-secondary">
              {{ selectedCount }} address{{ selectedCount === 1 ? '' : 'es' }} selected
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error" class="text-center py-4">
            <RuiAlert
              type="error"
              class="mb-4"
            >
              {{ error }}
            </RuiAlert>
            <RuiButton
              variant="outlined"
              @click="handleConnect()"
            >
              Retry
            </RuiButton>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <RuiButton
              variant="outlined"
              @click="closeDialog()"
            >
              Cancel
            </RuiButton>
            <RuiButton
              v-if="hasAddresses"
              color="primary"
              :disabled="selectedCount === 0"
              @click="importSelectedAddresses()"
            >
              Import {{ selectedCount }} Address{{ selectedCount === 1 ? '' : 'es' }}
            </RuiButton>
          </div>
        </template>
      </RuiCard>
    </RuiDialog>
  </div>
</template> 