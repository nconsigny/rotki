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

// Helper function to parse Trezor error messages
function parseTrezorError(error: any): string {
  const message = error?.message || error?.toString() || '';
  const code = error?.code || error?.error;

  // Trezor Connect specific errors
  if (code === 'Device_CallInProgress' || message.includes('call in progress')) {
    return 'Trezor device is busy. Please wait for the current operation to complete.';
  }

  if (code === 'Device_NotFound' || message.includes('device not found')) {
    return 'Trezor device not found. Please connect your Trezor device and try again.';
  }

  if (code === 'Device_Disconnected' || message.includes('device disconnected')) {
    return 'Trezor device disconnected. Please reconnect your device and try again.';
  }

  if (code === 'Device_UsedElsewhere' || message.includes('used elsewhere')) {
    return 'Trezor device is being used by another application. Please close other wallet applications and try again.';
  }

  if (code === 'Device_Wiped' || message.includes('wiped')) {
    return 'Trezor device has been wiped. Please set up your device again.';
  }

  if (code === 'Failure_PinInvalid' || message.includes('PIN invalid')) {
    return 'Invalid PIN entered. Please enter the correct PIN on your Trezor device.';
  }

  if (code === 'Failure_PinCancelled' || message.includes('PIN cancelled')) {
    return 'PIN entry was cancelled. Please try again and enter your PIN.';
  }

  if (code === 'Failure_ActionCancelled' || message.includes('cancelled') || message.includes('Cancelled')) {
    return 'Action was cancelled on the Trezor device. Please try again and confirm the action.';
  }

  if (code === 'Failure_NotInitialized' || message.includes('not initialized')) {
    return 'Trezor device is not initialized. Please set up your device first.';
  }

  if (message.includes('Forbidden key path') || message.includes('forbidden')) {
    return 'The requested derivation path is not allowed. Please check your device settings.';
  }

  if (message.includes('Passphrase') || code?.includes('Passphrase')) {
    return 'Passphrase required. Please enter your passphrase on the Trezor device.';
  }

  if (message.includes('Bridge') || message.includes('bridge')) {
    return 'Trezor Bridge connection failed. Please install Trezor Bridge or use a supported browser with WebUSB.';
  }

  if (message.includes('popup') || message.includes('Popup')) {
    return 'Trezor Connect popup was blocked or closed. Please allow popups for this site and try again.';
  }

  if (message.includes('Transport') || message.includes('transport')) {
    return 'Connection to Trezor device failed. Please reconnect your device and try again.';
  }

  if (message.includes('handshake') || message.includes('Handshake')) {
    return 'Failed to establish connection with Trezor device. Please reconnect and try again.';
  }

  if (message.includes('timeout') || message.includes('Timeout')) {
    return 'Connection timeout. Please ensure your Trezor device is connected and unlocked.';
  }

  // Default fallback with the original error for debugging
  return message || 'Unknown Trezor error occurred. Please try again.';
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
      
      await TrezorConnect.init({ 
        manifest,
        lazyLoad: true, // Load connect on demand
        connectSrc: undefined, // Use default connect source
        debug: false, // Set to true for debugging
        popup: true, // Use popup mode for better compatibility
      });
      set(ready, true);
      set(isConnecting, false);
    }
    catch (error_: any) {
      console.error('Trezor Connect initialization failed:', error_);
      const userFriendlyMessage = parseTrezorError(error_);
      set(error, userFriendlyMessage);
      set(isConnecting, false);
    }
  });

  // Connect to Trezor device
  async function connectDevice(): Promise<boolean> {
    try {
      set(isConnecting, true);
      set(error, '');

      if (!get(ready)) {
        throw new Error('Trezor Connect is not initialized. Please refresh the page and try again.');
      }

      const features = await TrezorConnect.getFeatures();
      
      if (!features.success) {
        throw new Error(parseTrezorError(features.payload));
      }

      set(deviceInfo, {
        deviceId: features.payload.device_id || 'unknown',
        deviceName: features.payload.label || 'Trezor Device',
        isConnected: true,
      });

      return true;
    }
    catch (error_: any) {
      const userFriendlyMessage = parseTrezorError(error_);
      set(error, userFriendlyMessage);
      console.error('Trezor connection error:', error_);
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
      set(error, '');
    }
    catch (error_: any) {
      console.error('Error disconnecting from Trezor:', error_);
    }
  }

  // Derive an Ethereum address at address index
  const deriveEth = async (addressIndex: number = 0): Promise<string> => {
    if (!get(ready))
      throw new Error('Trezor Connect is not initialized. Please refresh the page and try again.');
    
    const path = `m/44'/60'/0'/0/${addressIndex}`;

    try {
      const result = await TrezorConnect.ethereumGetAddress({
        path,
        showOnTrezor: true,
      });
      
      if (!result.success)
        throw new Error(parseTrezorError(result.payload));

      return result.payload.address;
    } catch (error_: any) {
      const userFriendlyMessage = parseTrezorError(error_);
      console.error('Trezor address derivation error:', error_);
      throw new Error(userFriendlyMessage);
    }
  };

  // Derive multiple Ethereum addresses from Trezor using ethereumGetPublicKey bundle
  async function deriveEthereumAddresses(count: number = 5, startIndex: number = 0): Promise<TrezorAddress[]> {
    try {
      set(isDerivingAddresses, true);
      set(error, '');

      if (!get(ready)) {
        throw new Error('Trezor Connect is not initialized. Please refresh the page and try again.');
      }

      // Create bundle of public key requests - this avoids individual "Export Ethereum address" screens
      const bundle = [];
      for (let i = 0; i < count; i++) {
        const addressIndex = startIndex + i;
        const path = `m/44'/60'/0'/0/${addressIndex}`;
        bundle.push({
          path,
          showOnTrezor: false, // This prevents individual confirmations
        });
      }

      // Get public keys in batch using ethereumGetPublicKey with bundle
      const result = await TrezorConnect.ethereumGetPublicKey({
        bundle,
      });

      if (!result.success) {
        throw new Error(parseTrezorError(result.payload));
      }

      const addresses: TrezorAddress[] = [];
      const { HDNodeWallet } = await import('ethers');

      // Derive addresses from public keys client-side
      for (let i = 0; i < result.payload.length; i++) {
        const publicKeyData = result.payload[i];
        const addressIndex = startIndex + i;
        
        try {
          // Create HD wallet from the public key and derive the address
          const hdWallet = HDNodeWallet.fromExtendedKey(publicKeyData.xpub);
          const address = hdWallet.address;
          
          addresses.push({
            address,
            derivationPath: `m/44'/60'/0'/0/${addressIndex}`,
            index: addressIndex,
          });
        } catch (derivationError: any) {
          console.warn(`Failed to derive address from public key at index ${addressIndex}:`, derivationError);
          // Continue with other addresses instead of failing completely
        }
      }

      if (addresses.length === 0) {
        throw new Error('No addresses could be derived. Please ensure your Trezor device is connected and unlocked.');
      }

      return addresses;
    }
    catch (error_: any) {
      const userFriendlyMessage = parseTrezorError(error_);
      set(error, userFriendlyMessage);
      console.error('Trezor address derivation error:', error_);
      throw new Error(userFriendlyMessage);
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
