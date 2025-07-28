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

// Helper function to parse Ledger error messages
function parseLedgerError(error: any): string {
  const message = error?.message || error?.toString() || '';
  const statusCode = error?.statusCode || error?.returnCode;

  // Common Ledger error codes and their user-friendly messages
  if (statusCode === 0x6985 || message.includes('0x6985')) {
    return 'Transaction rejected by user. Please approve the action on your Ledger device.';
  }
  
  if (statusCode === 0x6982 || message.includes('0x6982')) {
    return 'Ledger device is locked. Please unlock your Ledger device and try again.';
  }
  
  if (statusCode === 0x6a82 || message.includes('0x6a82')) {
    return 'Ethereum app not found. Please open the Ethereum app on your Ledger device.';
  }
  
  if (statusCode === 0x6a80 || message.includes('0x6a80')) {
    return 'Invalid data received. Please ensure your Ledger firmware is up to date.';
  }
  
  if (statusCode === 0x6700 || message.includes('0x6700')) {
    return 'Invalid request length. Please try again or restart the Ledger connection.';
  }

  // Transport/connection errors
  if (message.includes('No device selected') || message.includes('device not found')) {
    return 'No Ledger device found. Please connect your Ledger device and try again.';
  }
  
  if (message.includes('device disconnected') || message.includes('Transport') || message.includes('connection')) {
    return 'Ledger device disconnected. Please reconnect your device and try again.';
  }
  
  if (message.includes('timeout') || message.includes('Timeout')) {
    return 'Connection timeout. Please unlock your Ledger device and open the Ethereum app, then try again.';
  }
  
  if (message.includes('busy') || message.includes('locked')) {
    return 'Ledger device is busy or locked. Please unlock your device and ensure no other applications are using it.';
  }

  if (message.includes('navigator.usb') || message.includes('WebUSB')) {
    return 'WebUSB not supported. Please use Chrome, Edge, or Brave browser with HTTPS connection.';
  }

  // App-specific errors
  if (message.includes('app') && (message.includes('not') || message.includes('close'))) {
    return 'Please open the Ethereum app on your Ledger device and try again.';
  }

  // Default fallback with the original error for debugging
  return message || 'Unknown Ledger error occurred. Please try again.';
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
        throw new Error('WebUSB is not supported in this browser. Please use Chrome, Edge, or Brave with HTTPS connection.');
      }

      // Create transport with timeout
      const transport = await TransportWebUSB.create();
      const ethApp = new Eth(transport);
      
      // Test connection by getting app configuration
      try {
        await ethApp.getAppConfiguration();
      } catch (testError: any) {
        await transport.close();
        throw new Error(parseLedgerError(testError));
      }
      
      set(deviceInfo, {
        ethApp,
        isConnected: true,
        transport,
      });

      return true;
    }
    catch (error_: any) {
      const userFriendlyMessage = parseLedgerError(error_);
      set(error, userFriendlyMessage);
      console.error('Ledger connection error:', error_);
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
      set(error, '');
    }
    catch (error_: any) {
      console.error('Error disconnecting from Ledger:', error_);
    }
  }

  // Derive Ethereum addresses from Ledger
  async function deriveEthereumAddresses(count: number = 5, startIndex: number = 0): Promise<LedgerAddress[]> {
    try {
      set(isDerivingAddresses, true);
      set(error, '');

      const device = get(deviceInfo);

      if (!device?.ethApp) {
        throw new Error('Ledger device not connected. Please connect your Ledger device first.');
      }

      const addresses: LedgerAddress[] = [];
      
      for (let i = 0; i < count; i++) {
        const addressIndex = startIndex + i;
        const derivationPath = `44'/60'/0'/${addressIndex}`;
        
        try {
          const result = await device.ethApp.getAddress(derivationPath, false);
          
          if (result && result.address) {
            addresses.push({
              address: result.address,
              derivationPath: `m/${derivationPath}`,
              index: addressIndex,
            });
          }
        }
        catch (addressError: any) {
          console.warn(`Error deriving address at index ${addressIndex}:`, addressError);
          // For individual address errors, we might want to continue with others
          // but if it's a device/app error, we should stop
          const errorMessage = parseLedgerError(addressError);
          if (errorMessage.includes('unlock') || errorMessage.includes('app') || errorMessage.includes('locked')) {
            throw new Error(errorMessage);
          }
          continue;
        }
      }

      if (addresses.length === 0) {
        throw new Error('No addresses could be derived. Please unlock your Ledger device and open the Ethereum app.');
      }

      return addresses;
    }
    catch (error_: any) {
      const userFriendlyMessage = parseLedgerError(error_);
      set(error, userFriendlyMessage);
      console.error('Ledger address derivation error:', error_);
      throw new Error(userFriendlyMessage);
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
        throw new Error('Ledger device not connected. Please connect your Ledger device first.');
      }

      const derivationPath = `44'/60'/0'/${index}`;
      const result = await device.ethApp.getAddress(derivationPath, true);
      
      return result.address;
    }
    catch (error_: any) {
      const userFriendlyMessage = parseLedgerError(error_);
      set(error, userFriendlyMessage);
      console.error('Ledger address verification error:', error_);
      throw new Error(userFriendlyMessage);
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
