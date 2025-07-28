import Eth from '@ledgerhq/hw-app-eth';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import { get, set } from '@vueuse/core';
import { computed, onUnmounted, readonly, ref, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

export interface LedgerAddress {
  address: string;
  derivationPath: string;
  index: number;
}

export interface LedgerDeviceInfo {
  transport: any;
  ethApp: any;
  isConnected: boolean;
}

export function useLedger(): {
  deviceInfo: Ref<LedgerDeviceInfo | null>;
  isConnecting: Ref<boolean>;
  isDerivingAddresses: Ref<boolean>;
  error: Ref<string>;
  isConnected: ComputedRef<boolean>;
  connectDevice: () => Promise<boolean>;
  disconnectDevice: () => Promise<void>;
  deriveEthereumAddresses: (count?: number, startIndex?: number) => Promise<LedgerAddress[]>;
  deriveAndVerifyAddress: (index?: number) => Promise<string>;
  isWebUSBSupported: () => boolean;
} {
  const { t } = useI18n({ useScope: 'global' });

  const deviceInfo = ref<LedgerDeviceInfo | null>(null);
  const isConnecting = ref(false);
  const isDerivingAddresses = ref(false);
  const error = ref<string>('');

  // Connect to Ledger device
  async function connectDevice(): Promise<boolean> {
    try {
      set(isConnecting, true);
      set(error, '');

      if (!('usb' in navigator)) {
        throw new Error(t('ledger.errors.webusb_not_supported', 'WebUSB is not supported in this browser. Please use Chrome, Edge, or Brave.'));
      }

      const transport = await TransportWebUSB.create();
      const ethApp = new Eth(transport);

      set(deviceInfo, {
        ethApp,
        isConnected: true,
        transport,
      });

      return true;
    }
    catch (error_: any) {
      set(error, error_.message || t('ledger.errors.connection_failed', 'Failed to connect to Ledger device'));
      return false;
    }
    finally {
      set(isConnecting, false);
    }
  }

  // Disconnect from device
  async function disconnectDevice(): Promise<void> {
    try {
      const device = get(deviceInfo);

      if (device?.transport) {
        await device.transport.close();
      }

      set(deviceInfo, null);
    }
    catch (error_: any) {
      console.error('Error disconnecting from Ledger:', error_);
    }
  }

  // Derive Ethereum addresses from Ledger
  async function deriveEthereumAddresses(count: number = 1, startIndex: number = 0): Promise<LedgerAddress[]> {
    try {
      set(isDerivingAddresses, true);
      set(error, '');

      const device = get(deviceInfo);

      if (!device?.ethApp) {
        throw new Error(t('ledger.errors.device_not_connected', 'Ledger device not connected'));
      }

      const addresses: LedgerAddress[] = [];

      for (let i = 0; i < count; i++) {
        const accountIndex = startIndex + i;
        const derivationPath = `44'/60'/${accountIndex}'/0/0`;

        try {
          const result = await device.ethApp.getAddress(derivationPath, false);

          if (result && result.address) {
            addresses.push({
              address: result.address,
              derivationPath: `m/${derivationPath}`,
              index: accountIndex,
            });
          }
        }
        catch (addressError: any) {
          console.warn(`Error deriving address at account ${accountIndex}:`, addressError);
          continue;
        }
      }

      if (addresses.length === 0) {
        throw new Error(t('ledger.errors.no_addresses_derived', 'No addresses could be derived from Ledger. Please ensure your Ledger is unlocked and the Ethereum app is open.'));
      }

      return addresses;
    }
    catch (error_: any) {
      set(error, error_.message || t('ledger.errors.address_derivation_failed', 'Failed to derive addresses from Ledger'));
      throw error_;
    }
    finally {
      set(isDerivingAddresses, false);
    }
  }

  // Derive a single address with user verification on device
  async function deriveAndVerifyAddress(index: number = 0): Promise<string> {
    try {
      set(isDerivingAddresses, true);
      set(error, '');

      const device = get(deviceInfo);

      if (!device?.ethApp) {
        throw new Error(t('ledger.errors.device_not_connected', 'Ledger device not connected'));
      }

      const derivationPath = `44'/60'/${index}'/0/0`;
      const result = await device.ethApp.getAddress(derivationPath, true);

      return result.address;
    }
    catch (error_: any) {
      set(error, error_.message || t('ledger.errors.address_verification_failed', 'Failed to verify address on Ledger'));
      throw error_;
    }
    finally {
      set(isDerivingAddresses, false);
    }
  }

  // Check if WebUSB is supported
  function isWebUSBSupported(): boolean {
    return 'usb' in navigator;
  }

  // Cleanup on unmount
  onUnmounted(() => {
    void disconnectDevice();
  });

  return {
    // Methods
    connectDevice,
    deriveAndVerifyAddress,
    deriveEthereumAddresses,
    // State
    deviceInfo: readonly(deviceInfo),

    disconnectDevice,

    error: readonly(error),
    // Computed
    isConnected: computed(() => get(deviceInfo)?.isConnected ?? false),
    isConnecting: readonly(isConnecting),
    isDerivingAddresses: readonly(isDerivingAddresses),
    isWebUSBSupported,
  };
}
