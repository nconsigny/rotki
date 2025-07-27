import { useTrezor } from '@/composables/blockchain/trezor';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

// Mock TrezorConnect
const mockTrezorConnect = {
  init: vi.fn(),
  getFeatures: vi.fn(),
  ethereumGetAddress: vi.fn(),
};

vi.mock('@trezor/connect-web', () => ({
  default: mockTrezorConnect,
}));

// Mock i18n
const mockT = vi.fn((key: string, fallback?: string) => fallback || key);
vi.mock('@/composables/api/i18n', () => ({
  useI18n: () => ({ t: mockT }),
}));

describe('useTrezor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrezorConnect.init.mockResolvedValue(undefined);
    mockTrezorConnect.getFeatures.mockResolvedValue({
      success: true,
      payload: {
        device_id: 'test-device-id',
        label: 'Test Trezor',
        model: 'T',
        major_version: 2,
        minor_version: 4,
        patch_version: 3,
        vendor: 'SatoshiLabs',
      },
    });
    mockTrezorConnect.ethereumGetAddress.mockResolvedValue({
      success: true,
      payload: {
        address: '0x1234567890123456789012345678901234567890',
      },
    });
  });

  it('should initialize TrezorConnect on mount', async () => {
    const TestComponent = {
      template: '<div></div>',
      setup() {
        return useTrezor();
      },
    };

    mount(TestComponent);
    await nextTick();

    expect(mockTrezorConnect.init).toHaveBeenCalledWith({
      email: 'dev@rotki.io',
      appUrl: 'https://rotki.com',
    });
  });

  it('should set ready state to true after successful initialization', async () => {
    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.trezor.ready).toBe(true);
    expect(wrapper.vm.trezor.isConnecting).toBe(false);
  });

  it('should handle initialization error', async () => {
    const initError = new Error('Initialization failed');
    mockTrezorConnect.init.mockRejectedValue(initError);

    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    expect(wrapper.vm.trezor.ready).toBe(false);
    expect(wrapper.vm.trezor.error).toBe('Initialization failed');
  });

  it('should connect to device successfully', async () => {
    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    const result = await wrapper.vm.trezor.connectDevice();

    expect(result).toBe(true);
    expect(mockTrezorConnect.getFeatures).toHaveBeenCalled();
    expect(wrapper.vm.trezor.deviceInfo).toEqual({
      deviceId: 'test-device-id',
      deviceName: 'Test Trezor',
      isConnected: true,
    });
  });

  it('should handle connection error', async () => {
    mockTrezorConnect.getFeatures.mockResolvedValue({
      success: false,
      payload: { error: 'Device not found' },
    });

    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    const result = await wrapper.vm.trezor.connectDevice();

    expect(result).toBe(false);
    expect(wrapper.vm.trezor.error).toBe('Device not found');
  });

  it('should derive Ethereum address successfully', async () => {
    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    const address = await wrapper.vm.trezor.deriveEth(0);

    expect(address).toBe('0x1234567890123456789012345678901234567890');
    expect(mockTrezorConnect.ethereumGetAddress).toHaveBeenCalledWith({
      path: 'm/44\'/60\'/0\'/0/0',
      showOnTrezor: true,
    });
    expect(wrapper.vm.trezor.addresses).toHaveLength(1);
    expect(wrapper.vm.trezor.addresses[0]).toEqual({
      address: '0x1234567890123456789012345678901234567890',
      derivationPath: 'm/44\'/60\'/0\'/0/0',
      index: 0,
    });
  });

  it('should handle address derivation error', async () => {
    mockTrezorConnect.ethereumGetAddress.mockResolvedValue({
      success: false,
      payload: { error: 'User cancelled' },
    });

    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    await expect(wrapper.vm.trezor.deriveEth(0)).rejects.toThrow('User cancelled');
  });

  it('should derive multiple addresses', async () => {
    // Mock multiple successful responses
    mockTrezorConnect.ethereumGetAddress
      .mockResolvedValueOnce({
        success: true,
        payload: { address: '0x1111111111111111111111111111111111111111' },
      })
      .mockResolvedValueOnce({
        success: true,
        payload: { address: '0x2222222222222222222222222222222222222222' },
      })
      .mockResolvedValueOnce({
        success: true,
        payload: { address: '0x3333333333333333333333333333333333333333' },
      });

    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    const addresses = await wrapper.vm.trezor.deriveEthereumAddresses(3);

    expect(addresses).toHaveLength(3);
    expect(addresses[0].address).toBe('0x1111111111111111111111111111111111111111');
    expect(addresses[1].address).toBe('0x2222222222222222222222222222222222222222');
    expect(addresses[2].address).toBe('0x3333333333333333333333333333333333333333');
  });

  it('should detect WebUSB support', () => {
    // Mock navigator.usb
    Object.defineProperty(navigator, 'usb', {
      value: {},
      configurable: true,
    });

    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);

    expect(wrapper.vm.trezor.isWebUSBSupported()).toBe(true);
    expect(wrapper.vm.trezor.isTrezorBridgeNeeded()).toBe(false);
  });

  it('should detect when Trezor Bridge is needed', () => {
    // Remove navigator.usb
    Object.defineProperty(navigator, 'usb', {
      value: undefined,
      configurable: true,
    });

    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);

    expect(wrapper.vm.trezor.isWebUSBSupported()).toBe(false);
    expect(wrapper.vm.trezor.isTrezorBridgeNeeded()).toBe(true);
  });

  it('should disconnect device and clear state', async () => {
    const TestComponent = {
      template: '<div></div>',
      setup() {
        const trezor = useTrezor();
        return { trezor };
      },
    };

    const wrapper = mount(TestComponent);
    await nextTick();

    // First connect and derive some addresses
    await wrapper.vm.trezor.connectDevice();
    await wrapper.vm.trezor.deriveEth(0);

    expect(wrapper.vm.trezor.deviceInfo).toBeTruthy();
    expect(wrapper.vm.trezor.addresses).toHaveLength(1);

    // Then disconnect
    await wrapper.vm.trezor.disconnectDevice();

    expect(wrapper.vm.trezor.deviceInfo).toBeNull();
    expect(wrapper.vm.trezor.addresses).toHaveLength(0);
  });
});
