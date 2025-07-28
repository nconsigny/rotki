<script setup lang="ts">
import type { AccountManage } from '@/composables/accounts/blockchain/use-account-manage';
import type { ValidationErrors } from '@/types/api/errors';
import type { Module } from '@/types/modules';
import { assert, Blockchain } from '@rotki/common';
import AddressInput from '@/components/accounts/blockchain/AddressInput.vue';
import AccountDataInput from '@/components/accounts/management/inputs/AccountDataInput.vue';
import ModuleActivator from '@/components/accounts/ModuleActivator.vue';
import { useLedger } from '@/composables/blockchain/ledger';
import { useTrezor } from '@/composables/blockchain/trezor';
import { useSupportedChains } from '@/composables/info/chains';
import { computed, nextTick, ref, watch } from 'vue';

const modelValue = defineModel<AccountManage>({ required: true });
const errors = defineModel<ValidationErrors>('errorMessages', { required: true });
defineProps<{ loading: boolean }>();
const address = ref<InstanceType<typeof AddressInput>>();
const selectedModules = ref<Module[]>([]);
const { isEvm } = useSupportedChains();
const editMode = computed(() => modelValue.value.mode === 'edit');
const tags = computed<string[]>({ get() { const model = modelValue.value; return (model.mode === 'edit' ? model.data.tags : model.data.length > 0 ? model.data[0].tags : null) ?? []; }, set(tags: string[]) {
  const model = modelValue.value; const tagData = tags.length > 0 ? tags : null; if (model.mode === 'edit') { modelValue.value = { ...model, data: { ...model.data, tags: tagData } }; }
  else { modelValue.value = { ...model, data: [...model.data.map(item => ({ ...item, tags: tagData }))] }; }
} });
const label = computed<string>({ get() { const model = modelValue.value; return (model.mode === 'edit' ? model.data.label : model.data.length > 0 ? model.data[0].label : null) ?? ''; }, set(label: string) {
  const model = modelValue.value; if (model.mode === 'edit') { modelValue.value = { ...model, data: { ...model.data, label } }; }
  else { modelValue.value = { ...model, data: [...model.data.map(item => ({ ...item, label }))] }; }
} });
const addresses = ref<string[]>([]);
watch(addresses, (newAddresses) => {
  if (hardwareType.value && newAddresses.length > 0) {
    // Update model value when addresses are confirmed
    const addressStr = newAddresses.join(',');
    
    const accountData = {
      address: addressStr,
      label: `Hardware Wallet Account (${newAddresses.length} addresses)`,
      tags: null,
    };
    
    set(modelValue, {
      ...get(modelValue),
      ...accountData,
    });
  }
}, { deep: true, immediate: true });
const showWalletImport = computed(() => { const model = modelValue.value; return isEvm(model.chain) || model.chain === 'evm'; });
const useHardware = ref(false);
const hardwareType = ref<'ledger' | 'trezor'>('ledger');
const deriving = ref(false);
const modelChain = computed(() => modelValue.value.chain);
const showHardwareToggle = computed(() => isEvm(modelChain.value) || modelChain.value === 'evm');
const { connectDevice: connectLedger, deriveEthereumAddresses: deriveLedger, error: ledgerError } = useLedger();
const { deriveEth: deriveTrezor, deriveEthereumAddresses: deriveTrezorAddresses } = useTrezor();

// Hardware wallet address selection state
const derivedHardwareAddresses = ref<Array<{ address: string; path: string; index: number }>>([]);
const selectedAddressIndices = ref<Set<number>>(new Set());
const currentPage = ref(1);
const addressesPerPage = 5;
const showAddressSelection = ref(false);

// Computed for pagination
const totalPages = computed(() => Math.ceil(derivedHardwareAddresses.value.length / addressesPerPage));
const paginatedAddresses = computed(() => {
  const start = (currentPage.value - 1) * addressesPerPage;
  const end = start + addressesPerPage;
  return derivedHardwareAddresses.value.slice(start, end);
});

const selectedAddresses = computed(() => Array.from(selectedAddressIndices.value)
  .map((index) => {
    // Find the address by its actual index, not array position
    const addressData = derivedHardwareAddresses.value.find(addr => addr.index === index);
    return addressData?.address;
  })
  .filter((address): address is string => Boolean(address)));

async function deriveAddresses() {
  // Show the selection UI immediately
  showAddressSelection.value = true;
  derivedHardwareAddresses.value = [];
  selectedAddressIndices.value.clear();
  deriving.value = true;

  try {
    if (hardwareType.value === 'ledger') {
      // First connect to the Ledger device
      const connected = await connectLedger();
      if (!connected) {
        throw new Error(ledgerError.value || 'Failed to connect to Ledger device');
      }

      // Derive 5 addresses for initial display
      const result = await deriveLedger(5);
      derivedHardwareAddresses.value = result.map(addr => ({
        address: addr.address,
        index: addr.index,
        path: addr.derivationPath,
      }));
    }
    else {
      // For Trezor, derive multiple addresses using batch method
      const result = await deriveTrezorAddresses(5);
      derivedHardwareAddresses.value = result.map(addr => ({
        address: addr.address,
        index: addr.index,
        path: addr.derivationPath,
      }));
    }
  }
  catch (error: any) {
    console.error('Derivation error:', error);
    alert(`Hardware wallet error: ${error?.message || error}`);
    showAddressSelection.value = false; // Hide on error
  }
  finally {
    deriving.value = false;
  }
}

function toggleAddressSelection(index: number) {
  if (selectedAddressIndices.value.has(index)) {
    selectedAddressIndices.value.delete(index);
  }
  else {
    selectedAddressIndices.value.add(index);
  }
}

function selectAllAddresses() {
  paginatedAddresses.value.forEach((addr) => {
    selectedAddressIndices.value.add(addr.index);
  });
}

function deselectAllAddresses() {
  paginatedAddresses.value.forEach((addr) => {
    selectedAddressIndices.value.delete(addr.index);
  });
}

function confirmAddressSelection() {
  const selectedAddresses = derivedHardwareAddresses.value.filter(addr =>
    selectedAddressIndices.value.has(addr.index),
  );

  if (selectedAddresses.length === 0) {
    alert('Please select at least one address');
    return;
  }

  // Set the addresses - this will trigger the watcher to update modelValue
  addresses.value = selectedAddresses.map(addr => addr.address);

  // Hide the selection UI
  showAddressSelection.value = false;
}

function loadMoreAddresses() {
  deriving.value = true;
  const currentCount = derivedHardwareAddresses.value.length;

  // Derive 10 more addresses
  setTimeout(async () => {
    try {
      if (hardwareType.value === 'ledger') {
        const result = await deriveLedger(10, currentCount);
        derivedHardwareAddresses.value.push(...result.map(addr => ({
          address: addr.address,
          index: addr.index,
          path: addr.derivationPath,
        })));
      }
      else {
        // For Trezor, use batch method
        const result = await deriveTrezorAddresses(10, currentCount);
        derivedHardwareAddresses.value.push(...result.map(addr => ({
          address: addr.address,
          index: addr.index,
          path: addr.derivationPath,
        })));
      }
    }
    catch (error: any) {
      console.error('Error loading more addresses:', error);
      alert(`Error loading more addresses: ${error?.message || error}`);
    }
    finally {
      deriving.value = false;
    }
  }, 100);
}

async function validate(): Promise<boolean> { assert(address.value); return address.value.validate(); }
defineExpose({ validate });
</script>

<template>
  <div class="flex flex-col gap-6">
    <RuiSwitch
      v-if="showHardwareToggle"
      v-model="useHardware"
      label="Add from Hardware Wallet"
    />
    <template v-if="useHardware">
      <RuiRadioGroup v-model="hardwareType">
        <RuiRadio
          value="ledger"
          label="Ledger"
        />
        <RuiRadio
          value="trezor"
          label="Trezor"
        />
      </RuiRadioGroup>
      <RuiButton
        :loading="deriving"
        @click="deriveAddresses"
      >
        Derive Addresses
      </RuiButton>

      <!-- Hardware Wallet Addresses Confirmed -->
      <div
        v-if="useHardware && !showAddressSelection && addresses.length > 0"
        class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
      >
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              class="w-3 h-3 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-green-800 dark:text-green-200">
              {{ addresses.length }} {{ addresses.length === 1 ? 'address' : 'addresses' }} selected from {{ hardwareType === 'ledger' ? 'Ledger' : 'Trezor' }}
            </p>
            <p class="text-xs text-green-600 dark:text-green-300">
              Ready to save. You can now click the save button.
            </p>
          </div>
          <RuiButton
            size="sm"
            variant="outlined"
            class="ml-auto"
            @click="showAddressSelection = true"
          >
            Change Selection
          </RuiButton>
        </div>
      </div>

      <!-- Address Selection Modal/Panel -->
      <div
        v-if="showAddressSelection"
        class="border border-rui-grey-300 dark:border-rui-grey-600 rounded-lg p-6 bg-white dark:bg-rui-grey-900"
      >
        <div class="flex justify-between items-center mb-6">
          <div>
            <h3 class="text-lg font-semibold text-rui-text dark:text-rui-text-dark">
              Select Addresses
              <span
                v-if="!deriving"
                class="text-rui-primary"
              >
                ({{ selectedAddresses.length }} selected)
              </span>
            </h3>
            <p
              v-if="selectedAddresses.length > 0"
              class="text-sm text-rui-text-secondary dark:text-rui-text-secondary-dark mt-1"
            >
              {{ selectedAddresses.length }} {{ selectedAddresses.length === 1 ? 'address' : 'addresses' }} will be added to your account
            </p>
          </div>
          <div class="flex gap-2">
            <RuiButton
              size="sm"
              variant="outlined"
              :disabled="deriving || paginatedAddresses.length === 0"
              @click="selectAllAddresses"
            >
              Select All (Page)
            </RuiButton>
            <RuiButton
              size="sm"
              variant="outlined"
              :disabled="deriving || paginatedAddresses.length === 0"
              @click="deselectAllAddresses"
            >
              Deselect All (Page)
            </RuiButton>
            <RuiButton
              size="sm"
              :loading="deriving"
              :disabled="derivedHardwareAddresses.length === 0"
              @click="loadMoreAddresses"
            >
              Load More
            </RuiButton>
          </div>
        </div>

        <!-- Loading State -->
        <div
          v-if="deriving && derivedHardwareAddresses.length === 0"
          class="flex flex-col items-center justify-center py-12"
        >
          <RuiProgress
            circular
            indeterminate
            color="primary"
            class="mb-4"
          />
          <p class="text-rui-text-secondary dark:text-rui-text-secondary-dark text-center">
            Connecting to {{ hardwareType === 'ledger' ? 'Ledger' : 'Trezor' }} device and deriving addresses...
            <br />
            <span class="text-sm">Please confirm on your device if prompted</span>
          </p>
        </div>

        <!-- Address Table -->
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full border-collapse border border-rui-grey-300 dark:border-rui-grey-600 rounded-lg overflow-hidden">
            <thead>
              <tr class="bg-rui-grey-50 dark:bg-rui-grey-800">
                <th class="border-b border-rui-grey-300 dark:border-rui-grey-600 px-4 py-3 text-left text-rui-text dark:text-rui-text-dark font-medium">
                  Select
                </th>
                <th class="border-b border-rui-grey-300 dark:border-rui-grey-600 px-4 py-3 text-left text-rui-text dark:text-rui-text-dark font-medium">
                  Index
                </th>
                <th class="border-b border-rui-grey-300 dark:border-rui-grey-600 px-4 py-3 text-left text-rui-text dark:text-rui-text-dark font-medium">
                  Address
                </th>
                <th class="border-b border-rui-grey-300 dark:border-rui-grey-600 px-4 py-3 text-left text-rui-text dark:text-rui-text-dark font-medium">
                  Derivation Path
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Loading rows while deriving more addresses -->
              <template v-if="deriving && derivedHardwareAddresses.length > 0">
                <tr
                  v-for="n in 3"
                  :key="`loading-${n}`"
                  class="animate-pulse"
                >
                  <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3">
                    <div class="w-4 h-4 bg-rui-grey-300 dark:bg-rui-grey-600 rounded" />
                  </td>
                  <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3">
                    <div class="w-8 h-4 bg-rui-grey-300 dark:bg-rui-grey-600 rounded" />
                  </td>
                  <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3">
                    <div class="w-80 h-4 bg-rui-grey-300 dark:bg-rui-grey-600 rounded" />
                  </td>
                  <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3">
                    <div class="w-32 h-4 bg-rui-grey-300 dark:bg-rui-grey-600 rounded" />
                  </td>
                </tr>
              </template>

              <!-- Actual address rows -->
              <tr
                v-for="addr in paginatedAddresses"
                :key="addr.index"
                class="hover:bg-rui-grey-50 dark:hover:bg-rui-grey-800 transition-colors"
              >
                <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3">
                  <RuiCheckbox
                    :model-value="selectedAddressIndices.has(addr.index)"
                    :disabled="deriving"
                    @update:model-value="toggleAddressSelection(addr.index)"
                  />
                </td>
                <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3 font-mono text-sm text-rui-text dark:text-rui-text-dark">
                  {{ addr.index }}
                </td>
                <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3 font-mono text-sm text-rui-text dark:text-rui-text-dark">
                  {{ addr.address }}
                </td>
                <td class="border-b border-rui-grey-200 dark:border-rui-grey-700 px-4 py-3 font-mono text-sm text-rui-text-secondary dark:text-rui-text-secondary-dark">
                  {{ addr.path }}
                </td>
              </tr>

              <!-- Empty state -->
              <tr v-if="!deriving && derivedHardwareAddresses.length === 0">
                <td
                  colspan="4"
                  class="px-4 py-8 text-center text-rui-text-secondary dark:text-rui-text-secondary-dark"
                >
                  No addresses derived yet
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div
          v-if="totalPages > 1 && !deriving"
          class="flex justify-center items-center gap-2 mt-6"
        >
          <RuiButton
            size="sm"
            variant="outlined"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            Previous
          </RuiButton>
          <span class="px-3 py-1 text-sm text-rui-text dark:text-rui-text-dark">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <RuiButton
            size="sm"
            variant="outlined"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Next
          </RuiButton>
        </div>

        <!-- Selected Addresses Summary -->
        <div
          v-if="selectedAddresses.length > 0 && !deriving"
          class="mt-6 p-4 bg-rui-grey-50 dark:bg-rui-grey-800 rounded-lg"
        >
          <h4 class="text-sm font-medium text-rui-text dark:text-rui-text-dark mb-2">
            Selected Addresses ({{ selectedAddresses.length }}):
          </h4>
          <div class="space-y-1 max-h-32 overflow-y-auto">
            <div
              v-for="(address, index) in selectedAddresses"
              :key="address"
              class="text-xs font-mono text-rui-text-secondary dark:text-rui-text-secondary-dark"
            >
              {{ index + 1 }}. {{ address }}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-3 mt-6">
          <RuiButton
            variant="outlined"
            :disabled="deriving"
            @click="showAddressSelection = false"
          >
            Cancel
          </RuiButton>
          <RuiButton
            color="primary"
            :disabled="selectedAddresses.length === 0 || deriving"
            @click="confirmAddressSelection"
          >
            Add Selected Addresses ({{ selectedAddresses.length }})
          </RuiButton>
        </div>
      </div>
    </template>
    <ModuleActivator
      v-if="[Blockchain.ETH, 'evm'].includes(modelValue.chain) && !editMode"
      @update:selection="selectedModules = $event"
    />
    <div class="flex flex-col gap-4">
      <AddressInput
        ref="address"
        v-model:addresses="addresses"
        v-model:error-messages="errors"
        :disabled="loading || editMode"
        :multi="!editMode"
        :show-wallet-import="showWalletImport.value"
      />
      <AccountDataInput
        v-model:tags="tags"
        v-model:label="label"
        :disabled="loading"
      />
    </div>
  </div>
</template>
