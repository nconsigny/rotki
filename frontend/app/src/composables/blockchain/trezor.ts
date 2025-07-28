import TrezorConnect from '@trezor/connect-web';
import { get, set } from '@vueuse/core';
import { onMounted, onUnmounted, readonly, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

const manifest = {
  appName: 'Rotki',
  appUrl: 'https://rotki.com',
  email: 'dev@rotki.io',
};

export interface TrezorAddress {
  address: string;
  derivationPath: string;
  index: number;
}

interface TrezorDeviceInfo {
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
}

export function useTrezor(): {
  ready: Ref<boolean>;
  deviceInfo: Ref<TrezorDeviceInfo | null>;
  isConnecting: Ref<boolean>;
  isDerivingAddresses: Ref<boolean>;
  error: Ref<string>;
  connectDevice: () => Promise<boolean>;
  disconnectDevice: () => Promise<void>;
  deriveEth: (accountIndex?: number) => Promise<string>;
  deriveEthereumAddresses: (count?: number, startIndex?: number) => Promise<TrezorAddress[]>;
  isWebUSBSupported: () => boolean;
} {
  const { t } = useI18n({ useScope: 'global' });
  
  const ready = ref(false);
  const deviceInfo = ref<TrezorDeviceInfo | null>(null);
  const isConnecting = ref(false);
  const isDerivingAddresses = ref(false);
  const error = ref<string>('');

  // Initialize Trezor Connect
  onMounted(async () => {
    try {
      set(isConnecting, true);
      set(error, '');
      
      await TrezorConnect.init({ manifest });
      set(ready, true);
      set(isConnecting, false);
    }
    catch (error_: any) {
      set(error, error_.message || t('trezor.errors.initialization_failed'));
      set(isConnecting, false);
    }
  });

  // Connect to Trezor device
  async function connectDevice(): Promise<boolean> {
    try {
      set(isConnecting, true);
      set(error, '');

      if (!get(ready)) {
        throw new Error(t('trezor.errors.not_initialized'));
      }

      const features = await TrezorConnect.getFeatures();
      
      if (!features.success) {
        throw new Error(features.payload.error || t('trezor.errors.connection_failed'));
      }

      set(deviceInfo, {
        deviceId: features.payload.device_id || 'unknown',
        deviceName: features.payload.label || 'Trezor Device',
        isConnected: true,
      });

      return true;
    }
    catch (error_: any) {
      set(error, error_.message || t('trezor.errors.connection_failed'));
      return false;
    }
    finally {
      set(isConnecting, false);
    }
  }

  // Disconnect from device
  async function disconnectDevice(): Promise<void> {
    try {
      set(deviceInfo, null);
    }
    catch (error_: any) {
      console.error('Error disconnecting from Trezor:', error_);
    }
  }

  // Derive an Ethereum address at address index
  const deriveEth = async (addressIndex: number = 0): Promise<string> => {
    if (!get(ready))
      throw new Error(t('trezor.errors.not_initialized'));
    
    const path = `m/44'/60'/0'/0/${addressIndex}`;

    const result = await TrezorConnect.ethereumGetAddress({
      path,
      showOnTrezor: true,
    });
    
    if (!result.success)
      throw new Error(result.payload.error);

    return result.payload.address;
  };

  // Derive multiple Ethereum addresses from Trezor
  async function deriveEthereumAddresses(count: number = 5, startIndex: number = 0): Promise<TrezorAddress[]> {
    try {
      set(isDerivingAddresses, true);
      set(error, '');

      if (!get(ready)) {
        throw new Error(t('trezor.errors.not_initialized'));
      }

      const addresses: TrezorAddress[] = [];
      
      // Derive addresses in batch for better performance
      const derivationPromises = [];
      for (let i = 0; i < count; i++) {
        const addressIndex = startIndex + i;
        const path = `m/44'/60'/0'/0/${addressIndex}`;
        
                  derivationPromises.push(
            TrezorConnect.ethereumGetAddress({
              path,
              showOnTrezor: false, // Don't show on device for batch operations
            }).then(result => ({
              result,
              addressIndex,
              path,
            })).catch(error => ({
              error,
              addressIndex,
              path,
            }))
          );
      }

      // Wait for all derivations to complete
      const results = await Promise.all(derivationPromises);

      // Process results
      for (const item of results) {
        if ('error' in item) {
          console.warn(`Error deriving address at index ${item.addressIndex}:`, item.error);
          continue;
        }

        const { result, addressIndex, path } = item;
        if (result && result.success) {
          addresses.push({
            address: result.payload.address,
            derivationPath: path,
            index: addressIndex,
          });
        } else {
          console.warn(`Failed to derive address at index ${addressIndex}:`, result?.payload?.error);
        }
      }

      if (addresses.length === 0) {
        throw new Error(t('trezor.errors.no_addresses_derived'));
      }

      return addresses;
    }
    catch (error_: any) {
      set(error, error_.message || t('trezor.errors.address_derivation_failed'));
      throw error_;
    }
    finally {
      set(isDerivingAddresses, false);
    }
  }

  // Check if browser supports WebUSB
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
    deriveEth,
    deriveEthereumAddresses,
    deviceInfo: readonly(deviceInfo),
    disconnectDevice,

    error: readonly(error),
    isConnecting: readonly(isConnecting),
    isDerivingAddresses: readonly(isDerivingAddresses),
    isWebUSBSupported,
    // State
    ready: readonly(ready),
  };
} 
