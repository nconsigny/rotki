import { ref, onMounted, onUnmounted, readonly } from 'vue'
import { get, set } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import TrezorConnect from '@trezor/connect-web'

const manifest = {
  email: 'dev@rotki.io',
  appUrl: 'https://rotki.com',
  appName: 'Rotki',
}

export interface TrezorAddress {
  address: string
  derivationPath: string
  index: number
}

interface TrezorDeviceInfo {
  deviceId: string
  deviceName: string
  isConnected: boolean
}

export function useTrezor() {
  const { t } = useI18n({ useScope: 'global' })
  
  const ready = ref(false)
  const deviceInfo = ref<TrezorDeviceInfo | null>(null)
  const isConnecting = ref(false)
  const isDerivingAddresses = ref(false)
  const error = ref<string>('')

  // Initialize Trezor Connect
  onMounted(async () => {
    try {
      set(isConnecting, true)
      set(error, '')
      
      await TrezorConnect.init({ manifest })
      set(ready, true)
      set(isConnecting, false)
    } catch (err: any) {
      set(error, err.message || t('trezor.errors.initialization_failed'))
      set(isConnecting, false)
    }
  })

  // Connect to Trezor device
  async function connectDevice(): Promise<boolean> {
    try {
      set(isConnecting, true)
      set(error, '')

      if (!get(ready)) {
        throw new Error(t('trezor.errors.not_initialized'))
      }

      const features = await TrezorConnect.getFeatures()
      
      if (!features.success) {
        throw new Error(features.payload.error || t('trezor.errors.connection_failed'))
      }

      set(deviceInfo, {
        deviceId: features.payload.device_id || 'unknown',
        deviceName: features.payload.label || 'Trezor Device',
        isConnected: true,
      })

      return true
    } catch (err: any) {
      set(error, err.message || t('trezor.errors.connection_failed'))
      return false
    } finally {
      set(isConnecting, false)
    }
  }

  // Disconnect from device
  async function disconnectDevice(): Promise<void> {
    try {
      set(deviceInfo, null)
    } catch (err: any) {
      console.error('Error disconnecting from Trezor:', err)
    }
  }

  // Derive an Ethereum address at account index
  const deriveEth = async (accountIndex: number = 0): Promise<string> => {
    if (!get(ready)) throw new Error(t('trezor.errors.not_initialized'))
    
    const path = `m/44'/60'/${accountIndex}'/0/0`

    const result = await TrezorConnect.ethereumGetAddress({
      path,
      showOnTrezor: true,
    })
    
    if (!result.success) throw new Error(result.payload.error)

    return result.payload.address
  }

  // Derive multiple Ethereum addresses from Trezor
  async function deriveEthereumAddresses(count: number = 10, startIndex: number = 0): Promise<TrezorAddress[]> {
    try {
      set(isDerivingAddresses, true)
      set(error, '')

      if (!get(ready)) {
        throw new Error(t('trezor.errors.not_initialized'))
      }

      const addresses: TrezorAddress[] = []
      
      for (let i = 0; i < count; i++) {
        try {
          const accountIndex = startIndex + i
          const address = await deriveEth(accountIndex)
          addresses.push({
            address,
            derivationPath: `m/44'/60'/${accountIndex}'/0/0`,
            index: accountIndex,
          })
        } catch (addressError: any) {
          console.warn(`Error deriving address at account ${startIndex + i}:`, addressError)
          continue
        }
      }

      if (addresses.length === 0) {
        throw new Error(t('trezor.errors.no_addresses_derived'))
      }

      return addresses
    } catch (err: any) {
      set(error, err.message || t('trezor.errors.address_derivation_failed'))
      throw err
    } finally {
      set(isDerivingAddresses, false)
    }
  }

  // Check if browser supports WebUSB
  function isWebUSBSupported(): boolean {
    return 'usb' in navigator
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnectDevice()
  })

  return {
    // State
    ready: readonly(ready),
    deviceInfo: readonly(deviceInfo),
    isConnecting: readonly(isConnecting),
    isDerivingAddresses: readonly(isDerivingAddresses),
    error: readonly(error),

    // Methods
    connectDevice,
    disconnectDevice,
    deriveEth,
    deriveEthereumAddresses,
    isWebUSBSupported,
  }
}