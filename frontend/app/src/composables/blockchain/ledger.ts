import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import Eth from '@ledgerhq/hw-app-eth';
import { computed, onUnmounted, readonly, ref } from 'vue';
import { get, set } from '@vueuse/core';
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

export function useLedger() {
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

      // Check if WebUSB is supported
      if (!('usb' in navigator)) {
        throw new Error(t('ledger.errors.webusb_not_supported', 'WebUSB is not supported in this browser. Please use Chrome, Edge, or Brave.'));
      }

      console.log('🔌 Connecting to Ledger via WebUSB...');
      
      // Create WebUSB transport
      const transport = await TransportWebUSB.create();
      console.log('✅ Transport created:', transport);
      
      // Create Ethereum app instance
      const ethApp = new Eth(transport);
      console.log('✅ Ethereum app created:', ethApp);
      
      set(deviceInfo, {
        transport,
        ethApp,
        isConnected: true,
      });

      console.log('🎉 Ledger device connected successfully!');
      return true;
    } catch (err: any) {
      console.error('❌ Ledger connection failed:', err);
      set(error, err.message || t('ledger.errors.connection_failed', 'Failed to connect to Ledger device'));
      return false;
    } finally {
      set(isConnecting, false);
    }
  }

  // Disconnect from device
  async function disconnectDevice(): Promise<void> {
    try {
      const device = get(deviceInfo);
      
      if (device?.transport) {
        await device.transport.close();
        console.log('🔌 Ledger transport closed');
      }
      
      set(deviceInfo, null);
    } catch (err: any) {
      console.error('❌ Error disconnecting from Ledger:', err);
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
      
      console.log(`📍 Deriving ${count} Ethereum address(es) from Ledger starting at index ${startIndex}...`);
      
      for (let i = 0; i < count; i++) {
        const accountIndex = startIndex + i;
        // Correct derivation path for account-based cryptocurrencies: m/44'/60'/account'/0/0
        const derivationPath = `44'/60'/${accountIndex}'/0/0`;
        
        try {
          console.log(`🔍 Deriving address at path: m/${derivationPath} (account ${accountIndex})`);
          
          // Use the official Ledger library API
          const result = await device.ethApp.getAddress(derivationPath, false);
          console.log(`✅ Address derived successfully:`, result);
          
          if (result && result.address) {
            addresses.push({
              address: result.address,
              derivationPath: `m/${derivationPath}`,
              index: accountIndex,
            });
            console.log(`🎯 Added address ${accountIndex}: ${result.address}`);
          } else {
            console.warn(`⚠️ Invalid result for account ${accountIndex}:`, result);
          }
        } catch (addressError: any) {
          console.error(`❌ Error deriving address at account ${accountIndex}:`, addressError);
          // Continue with other addresses instead of failing completely
          continue;
        }
      }

      if (addresses.length === 0) {
        throw new Error(t('ledger.errors.no_addresses_derived', 'No addresses could be derived from Ledger. Please ensure your Ledger is unlocked and the Ethereum app is open.'));
      }

      console.log(`🎉 Successfully derived ${addresses.length} address(es)!`);
      return addresses;
    } catch (err: any) {
      console.error('❌ Address derivation failed:', err);
      set(error, err.message || t('ledger.errors.address_derivation_failed', 'Failed to derive addresses from Ledger'));
      throw err;
    } finally {
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

      // Correct derivation path for account-based cryptocurrencies: m/44'/60'/account'/0/0
      const derivationPath = `44'/60'/${index}'/0/0`;
      
      console.log(`🔍 Verifying address at path: m/${derivationPath} (account ${index})`);
      
      // Use display=true to show address on device for user verification
      const result = await device.ethApp.getAddress(derivationPath, true);
      
      console.log(`✅ Address verified on device:`, result);
      
      return result.address;
    } catch (err: any) {
      console.error(`❌ Address verification error:`, err);
      set(error, err.message || t('ledger.errors.address_verification_failed', 'Failed to verify address on Ledger'));
      throw err;
    } finally {
      set(isDerivingAddresses, false);
    }
  }

  // Check if WebUSB is supported
  function isWebUSBSupported(): boolean {
    return 'usb' in navigator;
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnectDevice();
  });

  return {
    // State
    deviceInfo: readonly(deviceInfo),
    isConnecting: readonly(isConnecting),
    isDerivingAddresses: readonly(isDerivingAddresses),
    error: readonly(error),

    // Computed
    isConnected: computed(() => get(deviceInfo)?.isConnected ?? false),

    // Methods
    connectDevice,
    disconnectDevice,
    deriveEthereumAddresses,
    deriveAndVerifyAddress,
    isWebUSBSupported,
  };
} 