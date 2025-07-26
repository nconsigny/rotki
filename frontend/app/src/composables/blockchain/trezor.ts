import { ref, onMounted, onUnmounted } from 'vue'
import TrezorConnect from '@trezor/connect-web'

const manifest = {
  email: 'dev@rotki.io',
  appUrl: 'https://rotki.com',
  appName: 'Rotki'
}

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

export function useTrezor() {
  const { t } = useI18n({ useScope: 'global' });
  
  const ready = ref(false);
  const deviceInfo = ref<TrezorDeviceInfo | null>(null);
  const isConnecting = ref(false);
  const isDerivingAddresses = ref(false);
  const addresses = ref<TrezorAddress[]>([]);
  const error = ref<string>('');

  // Initialize Trezor Connect
  onMounted(async () => {
    try {
      set(isConnecting, true);
      set(error, '');
      
      await TrezorConnect.init({ manifest });
      set(ready, true);
      set(isConnecting, false);
    } catch (err: any) {
      set(error, err.message || t('trezor.errors.initialization_failed'));
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

      // TrezorConnect.init already handles device connection
      // We just need to verify the device is accessible
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
    } catch (err: any) {
      set(error, err.message || t('trezor.errors.connection_failed'));
      return false;
    } finally {
      set(isConnecting, false);
    }
  }

  // Disconnect from device
  async function disconnectDevice(): Promise<void> {
    try {
      // TrezorConnect handles disconnection automatically
      set(deviceInfo, null);
      set(addresses, []);
    } catch (err: any) {
      console.error('Error disconnecting from Trezor:', err);
    }
  }

  /**
   * Derive an EVM (ETH/L2) address at account index.
   * Uses the correct BIP-44 path for account-based cryptocurrencies: m/44'/60'/account'/0/0.
   */
  const deriveEth = async (accountIndex?: number): Promise<string> => {
    if (!get(ready)) throw new Error(t('trezor.errors.not_initialized'));
    
    const i = accountIndex ?? get(addresses).length;
    const path = `m/44'/60'/${i}'/0/0`;

    const r = await TrezorConnect.ethereumGetAddress({
      path,
      showOnTrezor: true // **always** confirm on-device
    });
    
    if (!r.success) throw new Error(r.payload.error);

    const newAddress: TrezorAddress = {
      address: r.payload.address,
      derivationPath: path,
      index: i,
    };

    // Update addresses array
    const currentAddresses = get(addresses);
    currentAddresses[i] = newAddress;
    set(addresses, [...currentAddresses]);

    return r.payload.address;
  };

  // Derive multiple Ethereum addresses from Trezor
  async function deriveEthereumAddresses(count: number = 10): Promise<TrezorAddress[]> {
    try {
      set(isDerivingAddresses, true);
      set(error, '');

      if (!get(ready)) {
        throw new Error(t('trezor.errors.not_initialized'));
      }

      const newAddresses: TrezorAddress[] = [];
      
      for (let i = 0; i < count; i++) {
        try {
          const address = await deriveEth(i);
          newAddresses.push({
            address,
            derivationPath: `m/44'/60'/${i}'/0/0`,
            index: i,
          });
        } catch (addressError: any) {
          console.warn(`Error deriving address at account ${i}:`, addressError);
          // Continue with next address instead of failing completely
        }
      }

      if (newAddresses.length === 0) {
        throw new Error(t('trezor.errors.no_addresses_derived'));
      }

      set(addresses, newAddresses);
      return newAddresses;
    } catch (err: any) {
      set(error, err.message || t('trezor.errors.address_derivation_failed'));
      throw err;
    } finally {
      set(isDerivingAddresses, false);
    }
  }

  // Check if browser supports WebUSB (for Chrome/Edge/Brave)
  function isWebUSBSupported(): boolean {
    return 'usb' in navigator;
  }

  // Check if Trezor Bridge is needed (for Firefox/Safari)
  function isTrezorBridgeNeeded(): boolean {
    return !isWebUSBSupported();
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnectDevice();
  });

  return {
    // State
    ready: readonly(ready),
    deviceInfo: readonly(deviceInfo),
    isConnecting: readonly(isConnecting),
    isDerivingAddresses: readonly(isDerivingAddresses),
    addresses: readonly(addresses),
    error: readonly(error),

    // Methods
    connectDevice,
    disconnectDevice,
    deriveEth,
    deriveEthereumAddresses,
    isWebUSBSupported,
    isTrezorBridgeNeeded,
  };
} 