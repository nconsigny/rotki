# Trezor Hardware Wallet Support for Rotki

This document describes the implementation of Trezor hardware wallet support in Rotki, following the specifications provided for Safe 3/Safe 5 compatibility.

## Overview

The Trezor implementation includes:
- Frontend Vue 3 composable for browser-based address derivation
- Python backend helper for server-side operations
- Demo components for testing and development
- Comprehensive unit tests

## Frontend Implementation

### Core Composable: `useTrezor`

Located at `frontend/app/src/composables/blockchain/trezor.ts`

The composable provides:
- **Initialization**: Automatic TrezorConnect initialization on component mount
- **Device Connection**: Connect to and manage Trezor devices
- **Address Derivation**: Derive Ethereum addresses using BIP-44 paths
- **Browser Compatibility**: Detect WebUSB support and Trezor Bridge requirements

#### Key Features

```typescript
const {
  ready,                    // TrezorConnect initialization status
  deviceInfo,              // Connected device information
  isConnecting,            // Connection state
  isDerivingAddresses,     // Address derivation state
  addresses,               // Array of derived addresses
  error,                   // Error messages
  connectDevice,           // Connect to device
  disconnectDevice,        // Disconnect from device
  deriveEth,              // Derive single Ethereum address
  deriveEthereumAddresses, // Derive multiple addresses
  isWebUSBSupported,      // Check WebUSB support
  isTrezorBridgeNeeded,   // Check if Bridge is needed
} = useTrezor()
```

#### Security Features

- **Always confirm on device**: All address derivations require user confirmation on the Trezor device (`showOnTrezor: true`)
- **No private key exposure**: Only public addresses are derived and stored
- **Secure derivation paths**: Uses standard BIP-44 Ethereum path (`m/44'/60'/0'/0/n`)

### Demo Components

#### Simple Component: `TrezorAddresses.vue`

Basic component following the provided specification:

```vue
<script setup lang="ts">
import { useTrezor } from '@/composables/blockchain/trezor'
const { addresses, deriveEth } = useTrezor()
</script>

<template>
  <div class="space-y-4">
    <button class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
            @click="deriveEth()">
      Derive next address
    </button>

    <ul>
      <li v-for="(addr,i) in addresses" :key="i" class="font-mono text-sm">
        {{ i }} ➜ {{ addr.address }}
      </li>
    </ul>
  </div>
</template>
```

#### Comprehensive Demo: `trezor-demo.vue`

Full-featured demo page located at `frontend/app/src/pages/playground/trezor-demo.vue` with:
- Device connection status
- Browser compatibility indicators
- Address derivation controls
- Address selection and import simulation
- Comprehensive instructions

## Backend Implementation

### Python Module: `rotkehlchen/hardware/trezor.py`

Provides server-side Trezor operations using `trezorlib`:

```python
from rotkehlchen.hardware.trezor import (
    derive_eth_address,           # Derive single address
    derive_multiple_eth_addresses, # Derive multiple addresses
    get_trezor_device_info,       # Get device information
    is_trezor_connected,          # Check connection status
)
```

#### Key Functions

- **`derive_eth_address(index: int = 0) -> str`**: Derive Ethereum address at specific index
- **`derive_multiple_eth_addresses(count: int = 10, start_index: int = 0) -> list[str]`**: Derive multiple addresses
- **`get_trezor_device_info() -> dict[str, str]`**: Get device information (ID, label, model, firmware)
- **`is_trezor_connected() -> bool`**: Check if device is connected

## Browser Compatibility

### Supported Browsers

| Browser | WebUSB Support | Trezor Bridge Required | Status |
|---------|---------------|------------------------|---------|
| Chrome/Chromium | ✅ | ❌ | Full Support |
| Edge | ✅ | ❌ | Full Support |
| Brave | ✅ | ❌ | Full Support |
| Firefox | ❌ | ✅ | Requires Bridge |
| Safari | ❌ | ✅ | Requires Bridge |

### WebUSB vs Trezor Bridge

The implementation automatically detects browser capabilities:
- **WebUSB browsers**: Direct USB communication
- **Non-WebUSB browsers**: Falls back to Trezor Bridge (desktop helper)

## Security Considerations

### Implementation Security

1. **Device Confirmation**: Every address derivation requires physical confirmation on the Trezor device
2. **No Private Key Access**: Only public addresses are derived and stored
3. **Standard Derivation Paths**: Uses canonical BIP-44 Ethereum paths
4. **No Logging of Sensitive Data**: Derivation paths and addresses are not logged together

### User Security Guidelines

1. **Firmware Updates**: Keep Trezor firmware ≥ 2.8.0 for latest security fixes
2. **Physical Confirmation**: Always verify addresses on the device screen
3. **Secure Environment**: Use on trusted computers only
4. **Bridge Security**: Only download Trezor Bridge from official sources

## Testing

### Unit Tests

Comprehensive test suite at `frontend/app/tests/unit/composables/blockchain/trezor.spec.ts`:

- TrezorConnect initialization
- Device connection and error handling
- Address derivation (single and multiple)
- Browser compatibility detection
- State management and cleanup

### Running Tests

```bash
cd frontend/app
pnpm test:unit trezor.spec.ts
```

## Installation Requirements

### Frontend Dependencies

```json
{
  "@trezor/connect-web": "^9.6.2"
}
```

### Python Dependencies

```bash
pip install trezor>=0.14
```

### Vite Configuration

The `@trezor/connect-web` package is included in Vite's `optimizeDeps`:

```typescript
// vite.config.ts
optimizeDeps: {
  include: [
    // ... other deps
    '@trezor/connect-web',
  ],
}
```

## Usage Examples

### Basic Address Derivation

```typescript
// In a Vue component
const { deriveEth, addresses } = useTrezor()

// Derive next address (requires device confirmation)
const address = await deriveEth()
console.log('Derived address:', address)
```

### Multiple Address Derivation

```typescript
// Derive 10 addresses starting from index 0
const addresses = await deriveEthereumAddresses(10)
console.log('Derived addresses:', addresses)
```

### Backend Usage

```python
# In Python backend
from rotkehlchen.hardware.trezor import derive_eth_address

# Derive address at index 0
address = derive_eth_address(0)
print(f"Derived address: {address}")
```

## Safe 3/Safe 5 Compatibility

This implementation fully supports Trezor Safe 3 and Safe 5 devices as they:
- Run the same firmware APIs as Trezor Model T/One
- Are compatible with TrezorConnect v9.x
- Support the same derivation paths and protocols
- Require no additional configuration

## Development Notes

### Code Organization

```
frontend/app/src/
├── composables/blockchain/
│   └── trezor.ts                 # Main composable
├── components/
│   └── TrezorAddresses.vue       # Simple demo component
├── pages/playground/
│   └── trezor-demo.vue          # Comprehensive demo
└── tests/unit/composables/blockchain/
    └── trezor.spec.ts           # Unit tests

rotkehlchen/
└── hardware/
    ├── __init__.py              # Module exports
    └── trezor.py               # Python backend
```

### Future Enhancements

Potential improvements for production use:
1. **Multi-chain Support**: Extend to Bitcoin and other supported chains
2. **Transaction Signing**: Add transaction signing capabilities
3. **Account Management**: Integration with Rotki's account management system
4. **Error Recovery**: Enhanced error handling and recovery mechanisms
5. **Performance Optimization**: Address derivation caching and batching

## Contributing

When contributing to the Trezor implementation:

1. Follow existing code patterns from Ledger implementation
2. Ensure all address derivations require device confirmation
3. Add comprehensive tests for new functionality
4. Update documentation for any API changes
5. Test on multiple browsers and devices

## Troubleshooting

### Common Issues

1. **"Device not found"**: Ensure Trezor is connected and unlocked
2. **"Bridge required"**: Install Trezor Bridge for Firefox/Safari
3. **"User cancelled"**: User declined confirmation on device
4. **WebUSB not supported**: Use Chrome/Edge or install Trezor Bridge

### Debug Mode

Enable debug logging in browser console:
```javascript
localStorage.setItem('debug', 'trezor:*')
```

This implementation provides a solid foundation for Trezor hardware wallet support in Rotki while maintaining security best practices and following the existing codebase patterns. 